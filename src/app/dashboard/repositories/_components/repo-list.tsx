"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";

export function RepoList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());

  const utils = api.useUtils();
  const { data: repos, isLoading, isError, error } = api.repository.listAccessibleRepos.useQuery();

  const connectMutation = api.repository.connectRepositories.useMutation({
    onSuccess: () => {
      setSelectedRepoIds(new Set());
      void utils.repository.listAccessibleRepos.invalidate();
    },
  });

  const disconnectMutation = api.repository.disconnectRepository.useMutation({
    onSuccess: () => {
      void utils.repository.listAccessibleRepos.invalidate();
    },
  });

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    return repos.filter((repo) =>
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [repos, searchQuery]);

  const toggleSelection = (githubRepoId: string) => {
    const nextSet = new Set(selectedRepoIds);
    if (nextSet.has(githubRepoId)) {
      nextSet.delete(githubRepoId);
    } else {
      nextSet.add(githubRepoId);
    }
    setSelectedRepoIds(nextSet);
  };

  const handleConnectSelected = () => {
    if (!repos || selectedRepoIds.size === 0) return;
    
    const reposToConnect = Array.from(selectedRepoIds)
      .map((id) => repos.find((r) => r.githubRepoId === id))
      .filter(Boolean)
      .map((repo) => ({
        githubRepoId: repo!.githubRepoId,
        fullName: repo!.fullName,
        owner: repo!.owner,
        name: repo!.name,
        isPrivate: repo!.isPrivate,
        language: repo!.language,
      }));

    connectMutation.mutate(reposToConnect);
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-400 animate-pulse">Loading repositories...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-sm text-red-400">Failed to load repositories: {error.message}</p>
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-400">No repositories found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 sm:max-w-xs"
        />
        
        <button
          onClick={handleConnectSelected}
          disabled={selectedRepoIds.size === 0 || connectMutation.isPending}
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connectMutation.isPending ? "Connecting..." : `Connect Selected (${selectedRepoIds.size})`}
        </button>
      </div>

      {/* Error displays for mutations */}
      {connectMutation.isError && (
        <p className="text-sm text-red-400">Failed to connect: {connectMutation.error.message}</p>
      )}
      {disconnectMutation.isError && (
        <p className="text-sm text-red-400">Failed to disconnect: {disconnectMutation.error.message}</p>
      )}

      {/* Repo List */}
      <div className="flex flex-col gap-2">
        {filteredRepos.map((repo) => {
          const isConnected = repo.connectionStatus === "CONNECTED";
          const isSelected = selectedRepoIds.has(repo.githubRepoId);

          return (
            <div
              key={repo.githubRepoId}
              className={`flex items-center justify-between rounded-lg border p-4 transition ${
                isConnected
                  ? "border-emerald-900/50 bg-emerald-950/10"
                  : isSelected
                  ? "border-zinc-600 bg-zinc-800/50"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-4">
                {!isConnected && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(repo.githubRepoId)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-white focus:ring-zinc-600 focus:ring-offset-zinc-950"
                  />
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{repo.fullName}</span>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{repo.isPrivate ? "Private" : "Public"}</span>
                    {repo.language && (
                      <>
                        <span>•</span>
                        <span>{repo.language}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {isConnected ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Connected
                    </span>
                    <button
                      onClick={() => disconnectMutation.mutate({ repositoryId: repo.internalId! })}
                      disabled={disconnectMutation.isPending}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-zinc-500">Not Connected</span>
                )}
              </div>
            </div>
          );
        })}

        {filteredRepos.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-500">
            No repositories match your search.
          </div>
        )}
      </div>
    </div>
  );
}
