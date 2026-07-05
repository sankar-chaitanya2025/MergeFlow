import { auth } from "~/server/auth";
import { AuthCard } from "~/app/_components/auth-card";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 font-sans">
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-8 rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            MergeFlow
          </h1>
          <p className="text-base text-zinc-400">
            AI-powered Pull Request Reviews
          </p>
        </div>

        <div className="h-px w-full bg-zinc-800" />

        <AuthCard session={session} />
      </div>
    </main>
  );
}
