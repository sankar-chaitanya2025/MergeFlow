import { notFound, redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function ReviewHistoryPage({
  params,
}: {
  params: { pullRequestId: string };
}) {
  const session = await auth();
  if (!session) redirect("/");

  let history;
  try {
    history = await api.review.getReviewHistory({
      pullRequestId: params.pullRequestId,
    });
  } catch (error) {
    console.error("Failed to fetch review history", error);
    return notFound();
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          No Reviews Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          This Pull Request has not been analyzed by the AI yet.
        </p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-12">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          AI Review History
        </h1>
        <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
          A complete, immutable timeline of AI analyses for this Pull Request.
        </p>
      </header>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
        {history.map((review, index) => {
          const isLatest = index === 0;

          return (
            <div
              key={review.id}
              className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}
            >
              {/* Timeline dot */}
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                  isLatest
                    ? "bg-blue-500 border-blue-100 dark:border-blue-900"
                    : "bg-gray-300 border-white dark:border-gray-800 dark:bg-gray-600"
                }`}
              >
                {isLatest && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                )}
              </div>

              {/* Card */}
              <div
                className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl shadow-lg transition-transform duration-300 hover:-translate-y-1 ${
                  isLatest
                    ? "bg-white dark:bg-gray-800 border-2 border-blue-500/20"
                    : "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                      review.riskLevel === "CRITICAL"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : review.riskLevel === "HIGH"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                        : review.riskLevel === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {review.riskLevel} RISK
                  </span>
                  {isLatest && (
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      LATEST REVIEW
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Summary
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {review.summary}
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                    Risk Reasoning
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm italic">
                    {review.riskReasoning}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    <span className="capitalize">{review.aiProvider}</span>
                    <span className="opacity-50">•</span>
                    <span>{review.modelVersion}</span>
                  </div>
                  <time dateTime={review.createdAt.toISOString()}>
                    {review.createdAt.toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
