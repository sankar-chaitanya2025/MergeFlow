import { postRouter } from "~/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

import { pullRequestRouter } from "~/server/api/routers/pull-request";
import { repositoryRouter } from "~/server/api/routers/repository";
import { reviewRouter } from "~/server/api/routers/review";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  repository: repositoryRouter,
  pullRequest: pullRequestRouter,
  review: reviewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
