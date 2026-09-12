import { NextResponse } from "next/server";
import { INITIAL_TASKS } from "@/lib/tasks";
import type { DynamoTask, PrStatus } from "@/lib/types";

type GitHubLabel = { name?: string | null };
type GitHubPull = {
  state?: "open" | "closed";
  merged_at?: string | null;
  title?: string;
  html_url?: string;
  labels?: GitHubLabel[];
};
type GitHubRepo = {
  name?: string;
};

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dynamo-control-dashboard",
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}
async function getCurrentForkNames() {
  const response = await fetch(
    "https://api.github.com/users/AshishDev-16/repos?per_page=100&type=owner",
    {
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const repos =
    (await response.json()) as GitHubRepo[];

  return new Set(
    repos
      .map((repo) => repo.name)
      .filter(
        (name): name is string =>
          Boolean(name)
      )
  );
}
async function syncTask(task: DynamoTask, currentForkNames: Set<string> | null): Promise<DynamoTask> {
  const url = `https://api.github.com/repos/handshake-project-dynamo/${task.repo}/pulls/${task.prNumber}`;
  const response = await fetch(url, { headers, cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${task.repo} #${task.prNumber}: GitHub ${response.status}`);
  }

  const pull = (await response.json()) as GitHubPull;
  const labels = (pull.labels ?? [])
    .map((label) => label.name?.trim())
    .filter((label): label is string => Boolean(label));

  const merged = Boolean(pull.merged_at);
  const prStatus: PrStatus = merged ? "Merged" : pull.state === "open" ? "Open" : "Closed";

  return {
    ...task,
    prTitle: pull.title || task.prTitle,
    prUrl: pull.html_url || task.prUrl,
    prStatus,
    merged,
    accepted: labels.some((label) => label.toLowerCase() === "accepted"),
    labels,
    forkExists:
      currentForkNames
        ? currentForkNames.has(task.repo)
        : task.forkExists,
  };
}

export async function GET() {
  const currentForkNames =
    await getCurrentForkNames();

  const settled =
    await Promise.allSettled(
      INITIAL_TASKS.map(
        (task) =>
          syncTask(
            task,
            currentForkNames
          )
      )
    );
  const errors: string[] = [];

  const tasks = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    const fallback =
      INITIAL_TASKS[index];

    return {
      ...fallback,

      forkExists:
        currentForkNames
          ? currentForkNames.has(
            fallback.repo
          )
          : fallback.forkExists,
    };
  });

  return NextResponse.json({
    tasks,
    syncedAt: new Date().toISOString(),
    partial: errors.length > 0,
    errors,
    authenticated: Boolean(process.env.GITHUB_TOKEN),
  });
}
