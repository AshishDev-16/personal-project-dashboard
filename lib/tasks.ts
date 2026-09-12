import type { DynamoTask } from "./types";

const owner = "AshishDev-16";
const upstream = "handshake-project-dynamo";

function task(
  repo: string,
  category: string,
  prNumber: number,
  prTitle: string,
  prStatus: "Merged" | "Open" | "Closed",
): DynamoTask {
  return {
    repo,
    category,
    prNumber,
    prTitle,
    forkUrl: `https://github.com/${owner}/${repo}`,
    prUrl: `https://github.com/${upstream}/${repo}/pull/${prNumber}`,
    prStatus,
    merged: prStatus === "Merged",
    accepted: true,
    labels: ["accepted"],
    forkExists: true,
  };
}

export const INITIAL_TASKS: DynamoTask[] = [
  task("dynamo-605c03f-machine-learning-and-ai", "Machine Learning & AI", 5, "Fix protected_ground_truth finding from #2: secure checkpoint verification", "Merged"),
  task("dynamo-5aec725-data-processing-and-etl", "Data Processing & ETL", 4, "Fix coherent_contract finding from #2: define ordering and seal verifier inputs", "Merged"),
  task("dynamo-d087904-machine-learning-and-ai", "Machine Learning & AI", 3, "Fix coherent_contract and sound_verifier findings from #2: pin CV allocation", "Merged"),
  task("dynamo-e9a49c7-file-and-media-operations", "File & Media Operations", 4, "Fix coherent_contract finding from #2: publish candidate family", "Merged"),
  task("dynamo-4ae2617-security", "Security", 5, "Fix coherent_contract finding from #3: require exact decryption", "Merged"),
  task("dynamo-8a61c92-file-and-media-operations", "File & Media Operations", 6, "Redesign audio conformer task for issue #2", "Merged"),
  task("dynamo-06d0dc3-build-dependency-and-release-management", "Build / Dependency / Release", 5, "Submission", "Merged"),
  task("dynamo-f39879e-data-science-and-reporting", "Data Science & Reporting", 4, "Fix protected_ground_truth finding from #2: pin panel integrity", "Merged"),
  task("dynamo-abc4902-model-training-and-ml-infrastructure", "Model Training & ML Infrastructure", 6, "Fix coherent_contract finding from #4: restore exact decimal semantics", "Merged"),
  task("dynamo-8b973c1-systems-infrastructure-and-operations", "Systems / Infrastructure / Ops", 5, "Fix protected_ground_truth finding from #3: restore verifier-owned workload utilities", "Merged"),
  task("dynamo-af85abc-machine-learning-and-ai", "Machine Learning & AI", 5, "Fix protected_ground_truth finding from #4: isolate verifier records", "Open"),
  task("dynamo-1b33109-build-dependency-and-release-management", "Build / Dependency / Release", 4, "Fix sound_verifier finding: allow empty macro values for protected build inputs", "Open"),
  task("dynamo-06740f6-machine-learning-and-ai", "Machine Learning & AI", 5, "Fix sound verifier finding from #4: cover default priority", "Open"),
  task("dynamo-aa5a477-data-science-and-reporting", "Data Science & Reporting", 5, "Align renderer CPU limit with contract", "Open"),
  task("dynamo-7426a35-systems-infrastructure-and-operations", "Systems / Infrastructure / Ops", 5, "Fix coherent_contract finding from #4: define tie order and preserve input order", "Open"),
  task("dynamo-2d0d4c3-security", "Security", 4, "Fix malformed sensor and symlink coverage", "Open"),
];
