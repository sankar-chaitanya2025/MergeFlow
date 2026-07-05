import Link from "next/link";
import { type Session } from "next-auth";

export function AuthCard({ session }: { session: Session | null }) {
  if (session?.user) {
    return (
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="flex items-center gap-4">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User Avatar"}
              className="h-12 w-12 rounded-full border border-zinc-700"
            />
          )}
          <h2 className="text-xl font-medium text-zinc-100">
            👋 Welcome, {session.user.name ?? "Developer"}
          </h2>
        </div>
        
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex-1 rounded-md bg-white px-6 py-2.5 text-center text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/api/auth/signout"
            className="flex-1 rounded-md border border-zinc-700 bg-transparent px-6 py-2.5 text-center text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Sign Out
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Link
        href="/api/auth/signin"
        className="w-full rounded-md bg-white px-8 py-3 text-center text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 sm:w-auto"
      >
        Continue with GitHub
      </Link>
    </div>
  );
}
