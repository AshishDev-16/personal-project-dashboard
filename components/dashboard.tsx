"use client";

import { useState } from "react";
import type { DynamoTask } from "@/lib/types";
import { DynamoDashboard } from "@/components/dynamo-dashboard";
import { LumiereDashboard } from "@/components/lumiere-dashboard";

export function Dashboard({ initialTasks }: { initialTasks: DynamoTask[] }) {
  const [project, setProject] = useState<"dynamo" | "lumiere">("dynamo");

  if (project === "lumiere") {
    return <LumiereDashboard onSwitchProject={() => setProject("dynamo")} />;
  }

  return <DynamoDashboard initialTasks={initialTasks} onSwitchProject={() => setProject("lumiere")} />;
}
