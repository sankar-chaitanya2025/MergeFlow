import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { pullRequests, repositories, reviews } from "~/server/db/schema";

export const dashboardRouter = createTRPCRouter({
  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Execute aggregations natively in PostgreSQL to prevent N+1 queries
    const [
      connectedReposCountRes,
      totalPrsCountRes,
      riskDistribution,
      recentReviews,
      repositoriesOverview
    ] = await Promise.all([
      // 1. Total connected repositories for the user
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(repositories)
        .where(eq(repositories.userId, userId)),

      // 2. Total PRs across all connected repositories
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(eq(repositories.userId, userId)),

      // 3. Risk distribution (aggregating reviews for the user's PRs)
      ctx.db
        .select({
          riskLevel: reviews.riskLevel,
          count: sql<number>`count(*)`
        })
        .from(reviews)
        .innerJoin(pullRequests, eq(reviews.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(eq(repositories.userId, userId))
        .groupBy(reviews.riskLevel),

      // 4. Latest 5 AI reviews
      ctx.db
        .select({
          id: reviews.id,
          pullRequestId: reviews.pullRequestId,
          riskLevel: reviews.riskLevel,
          summary: reviews.summary,
          createdAt: reviews.createdAt,
          prTitle: pullRequests.title,
          repoFullName: repositories.fullName,
        })
        .from(reviews)
        .innerJoin(pullRequests, eq(reviews.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
        .where(eq(repositories.userId, userId))
        .orderBy(desc(reviews.createdAt))
        .limit(5),

      // 5. Repository overview stats
      ctx.db
        .select({
          id: repositories.id,
          name: repositories.fullName,
          status: repositories.connectionStatus,
          lastSyncedAt: repositories.lastSyncedAt,
          prCount: sql<number>`count(distinct ${pullRequests.id})`,
          reviewCount: sql<number>`count(distinct ${reviews.id})`
        })
        .from(repositories)
        .leftJoin(pullRequests, eq(repositories.id, pullRequests.repositoryId))
        .leftJoin(reviews, eq(pullRequests.id, reviews.pullRequestId))
        .where(eq(repositories.userId, userId))
        .groupBy(repositories.id)
    ]);

    const connectedReposCount = Number(connectedReposCountRes[0]?.count ?? 0);
    const totalPrsCount = Number(totalPrsCountRes[0]?.count ?? 0);
    const totalReviews = riskDistribution.reduce((acc, curr) => acc + Number(curr.count), 0);

    const riskCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    riskDistribution.forEach((dist) => {
      if (dist.riskLevel in riskCounts) {
        riskCounts[dist.riskLevel as keyof typeof riskCounts] = Number(dist.count);
      }
    });

    return {
      overview: {
        totalRepositories: connectedReposCount,
        totalPullRequests: totalPrsCount,
        totalReviews,
        riskCounts,
      },
      recentReviews,
      repositories: repositoriesOverview.map(repo => ({
        ...repo,
        prCount: Number(repo.prCount),
        reviewCount: Number(repo.reviewCount),
      }))
    };
  }),
});
