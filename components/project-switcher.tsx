"use client";

import { GitFork, Sparkles } from "lucide-react";

export function ProjectSwitcher({
  active,
  onDynamo,
  onLumiere,
}: {
  active: "dynamo" | "lumiere";
  onDynamo: () => void;
  onLumiere: () => void;
}) {
  const toggleProject = () => {
    active === "dynamo" ? onLumiere() : onDynamo();
  };

  return (
    <div className="project-switch3d-slot">
      <button
        type="button"
        className={`project-switch3d ${active}`}
        onClick={toggleProject}
        aria-label={
          active === "dynamo"
            ? "Switch to Lumière"
            : "Switch to Dynamo"
        }
        title={
          active === "dynamo"
            ? "Switch to Lumière"
            : "Switch to Dynamo"
        }
      >
        <span className="project-switch3d-track-left">
          <GitFork size={11} strokeWidth={2.3} />
        </span>

        <span className="project-switch3d-track-right">
          <Sparkles size={11} strokeWidth={2.3} />
        </span>

        <span className="project-switch3d-knob">
          {active === "dynamo" ? (
            <GitFork size={14} strokeWidth={2.5} />
          ) : (
            <Sparkles size={14} strokeWidth={2.5} />
          )}
        </span>
      </button>
    </div>
  );
}