import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { RepoList } from "./_components/repo-list";

export default async function RepositoriesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Prefetch the repositories on the server for faster initial load
  void api.repository.listAccessibleRepos.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-zinc-950 p-4 font-sans text-zinc-100">
        <div className="w-full max-w-4xl py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Repositories
            </h1>
            <p className="mt-2 text-zinc-400">
              Select which GitHub repositories you want MergeFlow to monitor.
            </p>
          </div>
          
          <RepoList />
        </div>
      </main>
    </HydrateClient>
  );
}
