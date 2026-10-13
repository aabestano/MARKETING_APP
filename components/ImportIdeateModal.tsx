"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Modal, useToast } from "./ui";
import { readAsText } from "@/lib/client-utils";
import { parseIdeateExport } from "@/lib/pipeline";
import { useStore } from "@/lib/store";

const SNIPPET = `copy(localStorage.getItem('bestLifePipelineDBv4'))`;

export function ImportIdeateModal({ onClose }: { onClose: () => void }) {
  const importIdeate = useStore((s) => s.importIdeate);
  const updateSettings = useStore((s) => s.updateSettings);
  const toast = useToast();
  const [text, setText] = useState("");
  const [withKey, setWithKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let preview: ReturnType<typeof parseIdeateExport> | null = null;
  if (text.trim()) {
    try {
      preview = parseIdeateExport(text);
    } catch {
      preview = null;
    }
  }

  const apply = () => {
    try {
      const data = parseIdeateExport(text);
      const result = importIdeate({ ideaBase: data.ideaBase, pipeline: data.pipeline });
      if (withKey) updateSettings({ ...(data.apiKey ? { geminiApiKey: data.apiKey } : {}), ...(data.model ? { geminiModel: data.model } : {}) });
      toast(`Imported ${result.resources} Idea Base item${result.resources === 1 ? "" : "s"} and ${result.items} calendar item${result.items === 1 ? "" : "s"}. Items already here were skipped.`, "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  };

  return (
    <Modal
      title="Import from older IDEAte versions"
      description="Brings over your Idea Base and calendar pipeline. Nothing is overwritten; items with the same ID are skipped."
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!preview} onClick={apply}>Import</button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-300">
        <ol className="list-decimal space-y-1.5 pl-5 text-slate-400">
          <li>Open the old IDEAte app in your browser and press F12 to open the console.</li>
          <li>Paste this and press Enter. It copies your data to the clipboard.</li>
        </ol>
        <pre className="select-all overflow-x-auto rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-200">{SNIPPET}</pre>
        <ol start={3} className="list-decimal space-y-1.5 pl-5 text-slate-400">
          <li>Paste it below, or choose a saved .json or .txt file.</li>
        </ol>
        <textarea
          className="input h-40 font-mono text-xs"
          placeholder='{"ideaBase":[…],"pipeline":[…]}'
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
        <label className="btn-ghost inline-flex cursor-pointer">
          <FileUp className="h-4 w-4" /> Choose file
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await readAsText(f));
              e.target.value = "";
            }}
          />
        </label>
        {text.trim() && !preview && <p className="alert-error">That doesn&apos;t look like IDEAte data. Paste exactly what the command copied.</p>}
        {preview && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            Found {preview.ideaBase.length} Idea Base item{preview.ideaBase.length === 1 ? "" : "s"} and {preview.pipeline.length} calendar item{preview.pipeline.length === 1 ? "" : "s"}.
            {preview.apiKey && (
              <label className="mt-2 flex items-center gap-2 text-slate-200">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} />
                Also copy my Gemini API key and model (stays in this browser, never exported)
              </label>
            )}
          </div>
        )}
        {error && <p className="alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
