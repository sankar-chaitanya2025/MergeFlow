import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { pullRequests, reviews } from "~/server/db/schema";
import { generatePullRequestReview } from "~/server/ai/review";

export const reviewRouter = createTRPCRouter({
  /**
   * Generates an AI review for a specific Pull Request and persists it.
   */
  generateReview: protectedProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Load the Pull Request and Repository context
      const pr = await ctx.db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.pullRequestId),
        with: {
          repository: true,
        },
      });

      if (!pr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pull request not found.",
        });
      }

      // Security Check: Ensure the user actually owns the connected repository
      if (pr.repository.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this repository.",
        });
      }

      // Placeholder for Diff fetching (will be implemented in a subsequent milestone)
      const diffPlaceholder = "diff --git a/example.ts b/example.ts\n+ console.log('Hello World');";

      // 2. Call the orchestration layer
      let generatedReview;
      try {
        generatedReview = await generatePullRequestReview({
          repositoryFullName: pr.repository.fullName,
          pullRequestTitle: pr.title,
          authorUsername: pr.authorUsername,
          sourceBranch: pr.sourceBranch,
          targetBranch: pr.targetBranch,
          diff: diffPlaceholder,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "AI generation failed.",
          cause: error,
        });
      }

      // 3. Persist the generated review as an immutable snapshot
      try {
        const [persistedReview] = await ctx.db
          .insert(reviews)
          .values({
            pullRequestId: pr.id,
            summary: generatedReview.summary,
            riskLevel: generatedReview.riskLevel,
            riskReasoning: generatedReview.riskReasoning,
            aiProvider: generatedReview.aiProvider,
            modelVersion: generatedReview.modelVersion,
            metadata: generatedReview.metadata,
          })
          .returning();

        return persistedReview;
      } catch (error) {
        console.error("Failed to persist AI review:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI review generated successfully, but database persistence failed.",
          cause: error,
        });
      }
    }),

  /**
   * Retrieves the latest AI review for a Pull Request.
   */
  getLatestReview: protectedProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Load PR and verify ownership
      const pr = await ctx.db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.pullRequestId),
        with: { repository: true },
      });

      if (!pr) throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found." });
      if (pr.repository.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
      }

      // Fetch the newest review using the created_at index
      const latestReview = await ctx.db.query.reviews.findFirst({
        where: eq(reviews.pullRequestId, input.pullRequestId),
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      });

      return latestReview ?? null;
    }),

  /**
   * Retrieves all historical AI reviews for a Pull Request, sorted newest to oldest.
   */
  getReviewHistory: protectedProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Load PR and verify ownership
      const pr = await ctx.db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.pullRequestId),
        with: { repository: true },
      });

      if (!pr) throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found." });
      if (pr.repository.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
      }

      // Fetch all reviews ordered by created_at DESC
      const history = await ctx.db.query.reviews.findMany({
        where: eq(reviews.pullRequestId, input.pullRequestId),
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      });

      return history;
    }),
});
