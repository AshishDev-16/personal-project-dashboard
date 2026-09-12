import { NextResponse } from "next/server";

import { INITIAL_TASKS } from "@/lib/tasks";

import type {
  DynamoTask,
  PrStatus,
} from "@/lib/types";


const GITHUB_USER = "AshishDev-16";

const DYNAMO_ORG =
  "handshake-project-dynamo";


type GitHubLabel = {
  name?: string | null;
};


type GitHubPull = {
  state?: "open" | "closed";

  merged_at?: string | null;

  title?: string;

  html_url?: string;

  labels?: GitHubLabel[];
};


type GitHubSearchItem = {
  number: number;

  title?: string;

  html_url?: string;

  state?: "open" | "closed";

  repository_url?: string;

  labels?: GitHubLabel[];
};


type GitHubSearchResponse = {
  total_count?: number;

  items?: GitHubSearchItem[];
};


const headers: Record<
  string,
  string
> = {
  Accept:
    "application/vnd.github+json",

  "X-GitHub-Api-Version":
    "2022-11-28",

  "User-Agent":
    "dynamo-control-dashboard",
};


if (process.env.GITHUB_TOKEN) {
  headers.Authorization =
    `Bearer ${process.env.GITHUB_TOKEN}`;
}


/*
 * Convert Dynamo repository slugs
 * into readable dashboard categories.
 */
function categoryFromRepo(
  repo: string
) {
  const slug = repo.replace(
    /^dynamo-[a-f0-9]+-/,
    ""
  );

  const known:
    Record<string, string> = {
      "machine-learning-and-ai":
        "Machine Learning & AI",

      "data-processing-and-etl":
        "Data Processing & ETL",

      "file-and-media-operations":
        "File & Media Operations",

      security:
        "Security",

      "build-dependency-and-release-management":
        "Build / Dependency / Release",

      "data-science-and-reporting":
        "Data Science & Reporting",

      "model-training-and-ml-infrastructure":
        "Model Training & ML Infrastructure",

      "systems-infrastructure-and-operations":
        "Systems / Infrastructure / Ops",

      "debugging-and-repair":
        "Debugging & Repair",
    };

  if (known[slug]) {
    return known[slug];
  }

  /*
   * Generic fallback for future Dynamo
   * categories we have never seen before.
   */
  return slug
    .replaceAll("-and-", " & ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


/*
 * Search GitHub for EVERY Dynamo PR
 * created by Ashish.
 *
 * This is what allows task #17, #18,
 * etc. to appear without editing
 * lib/tasks.ts manually.
 */
async function discoverGithubTasks():
  Promise<DynamoTask[]> {

  const query =
    `is:pr author:${GITHUB_USER} org:${DYNAMO_ORG}`;

  const url =
    "https://api.github.com/search/issues?" +
    new URLSearchParams({
      q: query,

      per_page: "100",

      sort: "created",

      order: "desc",
    }).toString();

  const response =
    await fetch(url, {
      headers,

      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `GitHub PR discovery failed (${response.status})`
    );
  }

  const data =
    (await response.json()) as
      GitHubSearchResponse;

  const tasks: DynamoTask[] = [];

  for (const item of data.items ?? []) {
    const repo =
      item.repository_url
        ?.split("/")
        .pop();

    if (
      !repo ||
      !repo.startsWith("dynamo-")
    ) {
      continue;
    }

    const labels =
      (item.labels ?? [])
        .map((label) =>
          label.name?.trim()
        )
        .filter(
          (label): label is string =>
            Boolean(label)
        );

    tasks.push({
      repo,

      category:
        categoryFromRepo(repo),

      prNumber:
        item.number,

      prTitle:
        item.title ??
        "Dynamo submission",

      forkUrl:
        `https://github.com/${GITHUB_USER}/${repo}`,

      prUrl:
        item.html_url ??
        `https://github.com/${DYNAMO_ORG}/${repo}/pull/${item.number}`,

      /*
       * Closed is temporary here.
       * syncTask() below checks whether
       * a closed PR was actually merged.
       */
      prStatus:
        item.state === "open"
          ? "Open"
          : "Closed",

      merged: false,

      accepted:
        labels.some(
          (label) =>
            label.toLowerCase() ===
            "accepted"
        ),

      labels,

      /*
       * Kept only for compatibility with
       * our existing DynamoTask type.
       * We no longer use forkExists for
       * the dashboard's merged count.
       */
      forkExists: true,
    });
  }

  return tasks;
}


/*
 * INITIAL_TASKS now acts as historical
 * storage/fallback only.
 *
 * This matters because paid Dynamo task
 * repositories can later disappear from
 * GitHub. We still want those historical
 * records and credits in the dashboard.
 */
function mergeTaskSources(
  discovered: DynamoTask[]
) {
  const tasks =
    new Map<string, DynamoTask>();

  for (
    const task of INITIAL_TASKS
  ) {
    const key =
      `${task.repo}#${task.prNumber}`;

    tasks.set(
      key,
      task
    );
  }

  for (
    const task of discovered
  ) {
    const key =
      `${task.repo}#${task.prNumber}`;

    const historical =
      tasks.get(key);

    tasks.set(
      key,
      {
        ...historical,

        ...task,
      }
    );
  }

  return [...tasks.values()];
}


/*
 * Get current PR truth from the
 * upstream Dynamo repository.
 */
async function syncTask(
  task: DynamoTask
): Promise<DynamoTask> {

  const url =
    `https://api.github.com/repos/${DYNAMO_ORG}/${task.repo}/pulls/${task.prNumber}`;

  const response =
    await fetch(url, {
      headers,

      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `${task.repo} #${task.prNumber}: GitHub ${response.status}`
    );
  }

  const pull =
    (await response.json()) as
      GitHubPull;

  const labels =
    (pull.labels ?? [])
      .map((label) =>
        label.name?.trim()
      )
      .filter(
        (label): label is string =>
          Boolean(label)
      );

  const merged =
    Boolean(
      pull.merged_at
    );

  const prStatus:
    PrStatus =
      merged
        ? "Merged"
        : pull.state === "open"
          ? "Open"
          : "Closed";

  return {
    ...task,

    prTitle:
      pull.title ||
      task.prTitle,

    prUrl:
      pull.html_url ||
      task.prUrl,

    prStatus,

    merged,

    accepted:
      labels.some(
        (label) =>
          label.toLowerCase() ===
          "accepted"
      ),

    labels,

    forkExists: true,
  };
}


export async function GET() {
  const errors: string[] = [];

  let discovered:
    DynamoTask[] = [];

  try {
    discovered =
      await discoverGithubTasks();
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }


  /*
   * Static records + everything currently
   * discovered from GitHub.
   */
  const sourceTasks =
    mergeTaskSources(
      discovered
    );


  const settled =
    await Promise.allSettled(
      sourceTasks.map(
        (task) =>
          syncTask(task)
      )
    );


  const tasks =
    settled.map(
      (result, index) => {

        if (
          result.status ===
          "fulfilled"
        ) {
          return result.value;
        }

        errors.push(
          result.reason instanceof Error
            ? result.reason.message
            : String(
                result.reason
              )
        );

        /*
         * If GitHub deleted an old paid
         * task repo, preserve our historical
         * record instead of deleting it.
         */
        return {
          ...sourceTasks[index],

          forkExists: false,
        };
      }
    );


  return NextResponse.json({
    tasks,

    discovered:
      discovered.length,

    syncedAt:
      new Date().toISOString(),

    partial:
      errors.length > 0,

    errors,

    authenticated:
      Boolean(
        process.env.GITHUB_TOKEN
      ),
  });
}