import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts, repositories, pullRequests } from "~/server/db/schema";

// Configuration for sync policy (enforces SFR-8)
const SYNC_CLOSED_PR_COUNT = 10;
const SYNC_OPEN_PR_COUNT = 100;

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
  head: { ref: string };
  base: { ref: string };
}

async function fetchDiscoveredPRs(db: any, userId: string, repositoryIds?: string[]) {
  // 1. Fetch user access token
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!account?.access_token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No GitHub access token found.",
    });
  }

  // 2. Resolve repositories (must be CONNECTED and belong to user)
  const conditions = [
    eq(repositories.userId, userId),
    eq(repositories.connectionStatus, "CONNECTED"),
  ];

  if (repositoryIds && repositoryIds.length > 0) {
    conditions.push(inArray(repositories.id, repositoryIds));
  }

  const connectedRepos = await db.query.repositories.findMany({
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
        `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls?state=open&per_page=${SYNC_OPEN_PR_COUNT}`,
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
          mergedAt: pr.merged_at,
          sourceBranch: pr.head?.ref ?? "unknown",
          targetBranch: pr.base?.ref ?? "unknown",
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

  return { discoveredPRs, failedRepos };
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
    .query(async ({ ctx, input }) => {
      return fetchDiscoveredPRs(ctx.db, ctx.session.user.id, input.repositoryIds);
    }),

  /**
   * Discovers and persists PRs into the PostgreSQL database.
   * Uses an idempotent UPSERT strategy.
   */
  syncPullRequests: protectedProcedure
    .input(
      z.object({
        repositoryIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      const { discoveredPRs, failedRepos } = await fetchDiscoveredPRs(
        ctx.db,
        ctx.session.user.id,
        input.repositoryIds
      );

      let inserted = 0;
      let updated = 0;
      const syncedRepositories = new Set<string>();

      // Group PRs by repository to process them independently (Failure isolation)
      const prsByRepo = discoveredPRs.reduce((acc, pr) => {
        if (!acc[pr.repositoryId]) acc[pr.repositoryId] = [];
        acc[pr.repositoryId].push(pr);
        return acc;
      }, {} as Record<string, typeof discoveredPRs>);

      for (const [repoId, prs] of Object.entries(prsByRepo)) {
        try {
          // Identify existing PRs to accurately count inserts vs. updates
          const existing = await ctx.db.query.pullRequests.findMany({
            where: and(
              eq(pullRequests.repositoryId, repoId),
              inArray(
                pullRequests.githubPrNumber,
                prs.map((p) => p.number)
              )
            ),
            columns: { githubPrNumber: true },
          });
          
          const existingNumbers = new Set(existing.map((p) => p.githubPrNumber));

          for (const pr of prs) {
            if (existingNumbers.has(pr.number)) updated++;
            else inserted++;
          }

          const valuesToUpsert = prs.map((pr) => ({
            repositoryId: pr.repositoryId,
            githubPrNumber: pr.number,
            title: pr.title,
            authorUsername: pr.authorLogin,
            status: pr.state,
            sourceBranch: pr.sourceBranch,
            targetBranch: pr.targetBranch,
            linesAdded: 0,    // Lines added/removed requires detailed PR fetch. Defaulting to 0 in list view.
            linesRemoved: 0,
            filesChanged: 0,
            githubCreatedAt: new Date(pr.createdAt),
            githubUpdatedAt: new Date(pr.updatedAt),
            githubMergedAt: pr.mergedAt ? new Date(pr.mergedAt) : null,
            syncedAt: new Date(),
          }));

          // Idempotent UPSERT enforcing DI-P2
          await ctx.db
            .insert(pullRequests)
            .values(valuesToUpsert)
            .onConflictDoUpdate({
              target: [pullRequests.repositoryId, pullRequests.githubPrNumber],
              set: {
                title: sql`EXCLUDED.title`,
                status: sql`EXCLUDED.status`,
                githubUpdatedAt: sql`EXCLUDED.github_updated_at`,
                githubMergedAt: sql`EXCLUDED.github_merged_at`,
                syncedAt: sql`EXCLUDED.synced_at`,
              },
            });

          // Update the repository's last synced timestamp
          await ctx.db
            .update(repositories)
            .set({ lastSyncedAt: new Date() })
            .where(eq(repositories.id, repoId));

          syncedRepositories.add(repoId);
        } catch (error) {
          console.error(`Failed to persist PRs for repo ${repoId}:`, error);
          failedRepos.push({
            repositoryId: repoId,
            fullName: "Unknown (DB Error)",
            error: error instanceof Error ? error.message : "Database UPSERT failed",
          });
        }
      }

      return {
        syncedRepositories: syncedRepositories.size,
        syncedPullRequests: discoveredPRs.length,
        inserted,
        updated,
        failedRepositories: failedRepos,
        durationMs: Date.now() - startTime,
      };
    }),
});
