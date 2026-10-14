"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { displayAppName } from "@/lib/app-name";
import { useStore } from "@/lib/store";
import {
  buildExport,
  exportFilename,
  parseWorkspaceExport,
  summarizeExport,
  type ImportMode,
  type WorkspaceExport,
} from "@/lib/workspace-io";
import { formatBytes } from "@/lib/client-utils";
import { useToast } from "./ui";

export function WorkspaceBackup() {
  const importWorkspace = useStore((s) => s.importWorkspace);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: string; size: number; payload: WorkspaceExport } | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [error, setError] = useState<string | null>(null);

  const doExport = () => {
    const s = useStore.getState();
    const payload = buildExport({
      brandBooks: s.brandBooks,
      assets: s.assets,
      blasts: s.blasts,
      posters: s.posters,
      ideaBase: s.ideaBase,
      pipeline: s.pipeline,
      settings: s.settings,
      theme: s.theme,
    });
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${formatBytes(blob.size)}. API keys are not included.`, "success");
  };

  const onFile = async (file: File) => {
    setError(null);
    try {
      const payload = parseWorkspaceExport(await file.text(), displayAppName(useStore.getState().settings.displayName));
      setPending({ file: file.name, size: file.size, payload });
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    importWorkspace(pending.payload.data, mode);
    toast(mode === "replace" ? "Workspace replaced from import." : "Import merged into your workspace.", "success");
    setPending(null);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-200">Workspace backup</h3>
      <p className="text-xs text-slate-500">
        Export brand books, assets (including fonts), saved blasts and posters, the Idea Base, and the calendar as one file to move to another browser or teammate. API keys are never included. These
        buttons apply immediately, without Save settings.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={doExport}>
          <Download className="h-4 w-4" /> Export workspace
        </button>
        <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import workspace
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="alert-error">{error}</p>}
      {pending && (
        <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm">
          <p className="font-medium text-slate-100">
            {pending.file} <span className="font-normal text-slate-500">({formatBytes(pending.size)})</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Contains {summarizeExport(pending.payload.data).map((s) => `${s.count} ${s.label}`).join(", ")}.
          </p>
          <div className="mt-2 space-y-1.5 text-xs text-slate-300">
            <label className="flex items-start gap-2">
              <input type="radio" name="import-mode" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-0.5" />
              <span>
                <strong>Merge</strong> — add to what&apos;s here; items with the same ID are updated.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-0.5" />
              <span>
                <strong>Replace</strong> — erase everything in this workspace, then load the file.
              </span>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className={mode === "replace" ? "btn-danger" : "btn-primary"} onClick={confirmImport}>
              {mode === "replace" ? "Replace workspace" : "Merge import"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
