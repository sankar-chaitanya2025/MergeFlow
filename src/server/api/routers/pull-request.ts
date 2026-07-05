import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts, repositories } from "~/server/db/schema";

// Configuration for sync policy (enforces SFR-8)
const SYNC_CLOSED_PR_COUNT = 10;

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

export const pullRequestRouter = createTRPCRouter({
  /**
   * Discovers PRs from GitHub for the given repositories (or all connected ones)
   * following the sync policy (Open + Last N Closed).
   * Does NOT persist data to the database.
   */
  discoverPullRequests: protectedProcedure
    .input(
      z.object({
        repositoryIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch user access token
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.userId, ctx.session.user.id),
      });

      if (!account?.access_token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No GitHub access token found.",
        });
      }

      // 2. Resolve repositories (must be CONNECTED and belong to user)
      const conditions = [
        eq(repositories.userId, ctx.session.user.id),
        eq(repositories.connectionStatus, "CONNECTED"),
      ];

      if (input.repositoryIds && input.repositoryIds.length > 0) {
        conditions.push(inArray(repositories.id, input.repositoryIds));
      }

      const connectedRepos = await ctx.db.query.repositories.findMany({
        where: and(...conditions),
      });

      if (connectedRepos.length === 0) {
        return { discoveredPRs: [], failedRepos: [] };
      }

      const discoveredPRs = [];
      const failedRepos = [];

      // 3. Fetch PRs from GitHub for each repository
      for (const repo of connectedRepos) {
        try {
          const headers = {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/vnd.github.v3+json",
          };

          // Fetch Open PRs
          const openRes = await fetch(
            `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls?state=open&per_page=100`,
            { headers }
          );

          if (openRes.status === 403 || openRes.status === 429) {
             throw new Error("Rate limit exceeded");
          }
          if (!openRes.ok) {
            throw new Error(`GitHub API error: ${openRes.statusText}`);
          }

          const openPRs = (await openRes.json()) as GitHubPR[];

          // Fetch latest Closed/Merged PRs
          const closedRes = await fetch(
            `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls?state=closed&sort=updated&direction=desc&per_page=${SYNC_CLOSED_PR_COUNT}`,
            { headers }
          );

          if (!closedRes.ok) {
            throw new Error(`GitHub API error: ${closedRes.statusText}`);
          }

          const closedPRs = (await closedRes.json()) as GitHubPR[];

          const combinedPRs = [...openPRs, ...closedPRs];

          // 4. Normalize to DTO
          for (const pr of combinedPRs) {
            // Determine our specific domain state
            let derivedState: "OPEN" | "CLOSED" | "MERGED" = "OPEN";
            if (pr.state === "closed") {
              derivedState = pr.merged_at ? "MERGED" : "CLOSED";
            }

            discoveredPRs.push({
              githubPrId: pr.id.toString(),
              repositoryId: repo.id,
              number: pr.number,
              title: pr.title,
              state: derivedState,
              authorLogin: pr.user.login,
              authorAvatarUrl: pr.user.avatar_url,
              url: pr.html_url,
              createdAt: pr.created_at,
              updatedAt: pr.updated_at,
            });
          }
        } catch (error) {
          console.error(`Failed to sync repo ${repo.fullName}:`, error);
          failedRepos.push({
            repositoryId: repo.id,
            fullName: repo.fullName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        discoveredPRs,
        failedRepos,
      };
    }),
});
