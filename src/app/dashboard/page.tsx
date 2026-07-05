import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { user } = session;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
      <div className="flex w-full max-w-2xl flex-col gap-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <Link
            href="/api/auth/signout"
            className="rounded-md border border-zinc-700 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Sign Out
          </Link>
        </div>

        <div className="flex items-center gap-6 py-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Avatar"}
              className="h-20 w-20 rounded-full border border-zinc-700"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-2xl font-bold">
              {user.name?.charAt(0) ?? "U"}
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-white">
              {user.name ?? "Developer"}
            </h2>
            {user.email && (
              <p className="text-sm text-zinc-400">{user.email}</p>
            )}
            <div className="mt-2 inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
              Authenticated
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
