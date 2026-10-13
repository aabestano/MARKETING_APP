"use client";

import { Mail, Image as ImageIcon } from "lucide-react";
import { Link2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Segmented } from "./ui";
import { BlastGenerator } from "./BlastGenerator";
import { PosterIllustrator } from "./PosterIllustrator";
import type { ServerStatus } from "./AppShell";

export function DesignStudio({ status, onOpenSettings }: { status: ServerStatus | null; onOpenSettings: () => void }) {
  const mode = useStore((s) => s.designMode);
  const setMode = useStore((s) => s.setDesignMode);
  const pipeline = useStore((s) => s.pipeline);
  const emailLink = useStore((s) => s.workspace.pipelineId);
  const posterLink = useStore((s) => s.poster.pipelineId);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const updatePoster = useStore((s) => s.updatePoster);
  const linkId = mode === "email" ? emailLink : posterLink;
  const linkedItem = linkId ? pipeline.find((p) => p.id === linkId) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2 md:px-6">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "email", label: "Email Designer", icon: <Mail className="h-3.5 w-3.5" /> },
            { value: "poster", label: "Poster Illustrator", icon: <ImageIcon className="h-3.5 w-3.5" /> },
          ]}
        />
        <p className="text-xs text-slate-500">
          {mode === "email"
            ? "Blueprint to Mailchimp-ready MJML. Uses brand assets tagged Email Design."
            : "Prompt to print-ready posters and social graphics. Uses assets tagged Poster Illustration."}
        </p>
      </div>
      {linkedItem && (
        <div className="flex shrink-0 items-center gap-2 border-b border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-200 md:px-6">
          <Link2 className="h-3.5 w-3.5" />
          <span className="min-w-0 truncate">
            For calendar item “{linkedItem.ideaData.title}” ({linkedItem.scheduledDate}). What you save here is attached to it.
          </span>
          <button
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-blue-300 hover:text-slate-100"
            onClick={() => (mode === "email" ? updateWorkspace({ pipelineId: null }) : updatePoster({ pipelineId: null }))}
          >
            <X className="h-3 w-3" /> Detach
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {mode === "email" ? <BlastGenerator status={status} onOpenSettings={onOpenSettings} /> : <PosterIllustrator status={status} onOpenSettings={onOpenSettings} />}
      </div>
    </div>
  );
}
