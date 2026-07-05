import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts, repositories } from "~/server/db/schema";

interface GitHubRepoResponse {
  id: number;
  full_name: string;
  owner: { login: string };
  name: string;
  private: boolean;
  language: string | null;
}

export const repositoryRouter = createTRPCRouter({
  /**
   * Fetch repos from GitHub and match against our DB to indicate connection status.
   */
  listAccessibleRepos: protectedProcedure.query(async ({ ctx }) => {
    // 1. Fetch GitHub access token from the database
    const account = await ctx.db.query.accounts.findFirst({
      where: eq(accounts.userId, ctx.session.user.id),
    });

    if (!account?.access_token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No GitHub access token found for the user.",
      });
    }

    // 2. Fetch user's repositories from GitHub API
    const response = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `GitHub API error: ${response.statusText}`,
      });
    }

    const githubRepos = (await response.json()) as GitHubRepoResponse[];

    // 3. Fetch user's connected repositories from our database
    const dbRepos = await ctx.db.query.repositories.findMany({
      where: eq(repositories.userId, ctx.session.user.id),
    });

    // 4. Merge data: tag GitHub repos with their current DB connection status
    return githubRepos.map((ghRepo) => {
      const dbRepo = dbRepos.find(
        (dbR) => dbR.githubRepoId === ghRepo.id.toString()
      );
      
      return {
        githubRepoId: ghRepo.id.toString(),
        fullName: ghRepo.full_name,
        owner: ghRepo.owner.login,
        name: ghRepo.name,
        isPrivate: ghRepo.private,
        language: ghRepo.language,
        connectionStatus: dbRepo?.connectionStatus ?? "DISCONNECTED",
        internalId: dbRepo?.id ?? null,
      };
    });
  }),

  /**
   * Persist a selection of repositories into our database as CONNECTED.
   * If already present (disconnected), upserts to CONNECTED.
   */
  connectRepositories: protectedProcedure
    .input(
      z.array(
        z.object({
          githubRepoId: z.string(),
          fullName: z.string(),
          owner: z.string(),
          name: z.string(),
          isPrivate: z.boolean(),
          language: z.string().nullable().optional(),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      if (input.length === 0) return [];

      const valuesToInsert = input.map((repo) => ({
        userId: ctx.session.user.id,
        githubRepoId: repo.githubRepoId,
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        isPrivate: repo.isPrivate,
        language: repo.language ?? null,
        connectionStatus: "CONNECTED",
      }));

      // Perform an idempotent UPSERT. If it exists, reconnect it.
      await ctx.db
        .insert(repositories)
        .values(valuesToInsert)
        .onConflictDoUpdate({
          target: [repositories.userId, repositories.githubRepoId],
          set: { connectionStatus: "CONNECTED" },
        });

      return { success: true, count: input.length };
    }),

  /**
   * Disconnect a repository so it stops syncing.
   * Requires the internal repository ID.
   */
  disconnectRepository: protectedProcedure
    .input(z.object({ repositoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(repositories)
        .set({ connectionStatus: "DISCONNECTED" })
        .where(
          and(
            eq(repositories.id, input.repositoryId),
            eq(repositories.userId, ctx.session.user.id) // Security: prevent IDOR
          )
        );

      return { success: true };
    }),
});
