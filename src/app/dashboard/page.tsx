import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { overview, recentReviews, repositories } = await api.dashboard.getDashboardOverview();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              MergeFlow Dashboard
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Welcome back, {session.user.name}. Here's your PR risk overview.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/repositories"
              className="rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Manage Repositories
            </Link>
            <Link
              href="/api/auth/signout"
              className="rounded-md bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-gray-800 dark:hover:bg-zinc-200"
            >
              Sign Out
            </Link>
          </div>
        </header>

        {/* Overview Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Connected Repos" value={overview.totalRepositories} />
          <MetricCard title="Total Pull Requests" value={overview.totalPullRequests} />
          <MetricCard title="AI Reviews" value={overview.totalReviews} />
          <MetricCard title="Critical Risks" value={overview.riskCounts.CRITICAL} variant="critical" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Risk Distribution */}
          <section className="lg:col-span-1 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Risk Distribution</h2>
            <div className="space-y-4">
              <RiskBar label="CRITICAL" count={overview.riskCounts.CRITICAL} total={overview.totalReviews} color="bg-red-500" />
              <RiskBar label="HIGH" count={overview.riskCounts.HIGH} total={overview.totalReviews} color="bg-orange-500" />
              <RiskBar label="MEDIUM" count={overview.riskCounts.MEDIUM} total={overview.totalReviews} color="bg-yellow-500" />
              <RiskBar label="LOW" count={overview.riskCounts.LOW} total={overview.totalReviews} color="bg-green-500" />
            </div>
          </section>

          {/* Recent Activity */}
          <section className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Recent Activity</h2>
            {recentReviews.length === 0 ? (
              <p className="text-gray-500 dark:text-zinc-400 text-sm">No reviews generated yet.</p>
            ) : (
              <div className="space-y-4">
                {recentReviews.map((review) => (
                  <Link href={`/dashboard/reviews/${review.pullRequestId}`} key={review.id} className="block group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{review.repoFullName}</span>
                          <span className="text-gray-300 dark:text-zinc-700">•</span>
                          <span className="text-xs text-gray-400 dark:text-zinc-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {review.prTitle}
                        </h3>
                      </div>
                      <div className="shrink-0">
                        <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                          review.riskLevel === "CRITICAL" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : review.riskLevel === "HIGH" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          : review.riskLevel === "MEDIUM" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                          {review.riskLevel}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Repository Overview */}
        <section className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm overflow-hidden">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Repository Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-zinc-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800/50 dark:text-zinc-300">
                <tr>
                  <th scope="col" className="px-6 py-3 rounded-l-lg">Repository Name</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3 text-right">Pull Requests</th>
                  <th scope="col" className="px-6 py-3 text-right">Reviews</th>
                  <th scope="col" className="px-6 py-3 text-right rounded-r-lg">Last Synced</th>
                </tr>
              </thead>
              <tbody>
                {repositories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No repositories connected yet.
                    </td>
                  </tr>
                ) : (
                  repositories.map((repo) => (
                    <tr key={repo.id} className="bg-white dark:bg-transparent border-b dark:border-zinc-800 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {repo.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          repo.status === "CONNECTED" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                            : "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          {repo.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{repo.prCount}</td>
                      <td className="px-6 py-4 text-right font-medium">{repo.reviewCount}</td>
                      <td className="px-6 py-4 text-right text-xs">
                        {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : "Never"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

// Internal Helper Components
function MetricCard({ title, value, variant = "default" }: { title: string; value: number; variant?: "default" | "critical" }) {
  return (
    <div className={`p-6 rounded-xl border shadow-sm flex flex-col justify-center ${
      variant === "critical" 
        ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50" 
        : "border-gray-200 bg-white dark:bg-zinc-900/40 dark:border-zinc-800"
    }`}>
      <h3 className={`text-sm font-medium mb-2 ${variant === "critical" ? "text-red-800 dark:text-red-400" : "text-gray-500 dark:text-zinc-400"}`}>
        {title}
      </h3>
      <p className={`text-3xl font-bold ${variant === "critical" ? "text-red-900 dark:text-red-300" : "text-gray-900 dark:text-white"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-gray-700 dark:text-zinc-300">{label}</span>
        <span className="text-gray-500 dark:text-zinc-400">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}
