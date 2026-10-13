"use client";

import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText, FileUp, Lightbulb, Loader2, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { downscaleDataUrl, postJson, readAsDataUrl, readAsText, formatBytes } from "@/lib/client-utils";
import { MAX_ANALYZE_BYTES, analysisMode, dataUrlBytes } from "@/lib/resource-files";
import { COHORTS, MAX_RESOURCE_FILE_BYTES, MONTHS, SOURCE_TYPES, type IdeaResource } from "@/lib/idea-types";
import { SAMPLE_RESOURCES } from "@/lib/pipeline";
import { EmptyState, Modal, Segmented, Spinner, useToast } from "./ui";
import { ImportIdeateModal } from "./ImportIdeateModal";
import type { ServerStatus } from "./AppShell";

const needsAnalysis = (r: IdeaResource) => r.inputType === "file" && !r.extractedNotes.trim();

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function openDataUrl(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function IdeaBase({ status, onOpenSettings }: { status: ServerStatus | null; onOpenSettings: () => void }) {
  const resources = useStore((s) => s.ideaBase);
  const addResource = useStore((s) => s.addResource);
  const updateResource = useStore((s) => s.updateResource);
  const deleteResource = useStore((s) => s.deleteResource);
  const loadSample = useStore((s) => s.loadSampleResources);
  const settings = useStore((s) => s.settings);
  const toast = useToast();

  const [mode, setMode] = useState<"note" | "file">("note");
  const [importOpen, setImportOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cohortF, setCohortF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const hasKey = !!settings.geminiApiKey || !!status?.gemini;

  const analyze = async (r: IdeaResource) => {
    if (!r.fileData) return;
    if (!hasKey) {
      toast("AI analysis needs a Gemini API key.", "error");
      onOpenSettings();
      return;
    }
    const mode = analysisMode(r.fileExt, dataUrlBytes(r.fileData));
    if (mode === "too-large" || mode === "unsupported") {
      toast(
        mode === "too-large"
          ? `This PDF is over ${formatBytes(MAX_ANALYZE_BYTES)}, which is the most AI analysis can read. Open it and type or paste the key points as notes instead.`
          : "AI analysis supports PDF and PNG/JPG files. Add notes by hand for this file.",
        "error",
      );
      return;
    }
    setBusyIds((s) => new Set(s).add(r.id));
    try {
      const fileData = mode === "shrink" ? await downscaleDataUrl(r.fileData, { maxEdge: 1800, quality: 0.82 }) : r.fileData;
      const { notes } = await postJson<{ notes: string }>("/api/analyze-resource", { fileData, model: settings.geminiModel, apiKey: settings.geminiApiKey });
      updateResource(r.id, { extractedNotes: notes });
      toast(`Analyzed “${r.name}”.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Analysis failed.", "error");
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return resources.filter((r) => {
      if (needle && !`${r.name} ${r.tags.join(" ")} ${r.extractedNotes}`.toLowerCase().includes(needle)) return false;
      if (cohortF && r.cohort !== cohortF) return false;
      if (typeF && r.sourceType !== typeF) return false;
      if (statusF === "active" && !r.active) return false;
      if (statusF === "paused" && r.active) return false;
      if (statusF === "needs" && !needsAnalysis(r)) return false;
      if (statusF === "ready" && needsAnalysis(r)) return false;
      return true;
    });
  }, [resources, q, cohortF, typeF, statusF]);

  const opened = resources.find((r) => r.id === openId) ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Idea Base</h1>
            <p className="mt-1 text-sm text-slate-400">Your source material: scratch notes and uploaded documents. Active items feed the Idea Generator.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import from IDEAte
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                loadSample(SAMPLE_RESOURCES());
                toast("Sample ideas added.", "success");
              }}
            >
              <Lightbulb className="h-4 w-4" /> Load sample ideas
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <AddResource
            mode={mode}
            onMode={setMode}
            onAdd={(r) => {
              const created = addResource(r);
              toast(`Added “${created.name}” to the Idea Base.`, "success");
              return created;
            }}
          />

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="input pl-9" placeholder="Search title, tags or notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Idea Base" />
              </div>
              <select className="input w-auto" aria-label="Filter by cohort" value={cohortF} onChange={(e) => setCohortF(e.target.value)}>
                <option value="">All cohorts</option>
                {COHORTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className="input w-auto" aria-label="Filter by source type" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
                <option value="">All sources</option>
                {[...SOURCE_TYPES, "Scratch Idea"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className="input w-auto" aria-label="Filter by status" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="needs">Needs analysis</option>
                <option value="ready">Analyzed</option>
              </select>
            </div>

            {resources.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="Your Idea Base is empty"
                body="Add a scratch note or upload a document on the left. You can also load two sample ideas, or import everything from the old IDEAte app."
                action={
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => loadSample(SAMPLE_RESOURCES())}>Load sample ideas</button>
                    <button className="btn-ghost" onClick={() => setImportOpen(true)}>Import from IDEAte</button>
                  </div>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Search className="h-5 w-5" />} title="Nothing matches" body="Try clearing a filter or searching for something else." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((r) => (
                  <article key={r.id} className={clsx("card flex flex-col gap-2 p-4", !r.active && "opacity-60")}>
                    <div className="flex items-start justify-between gap-2">
                      <button className="min-w-0 text-left" onClick={() => setOpenId(r.id)}>
                        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100 hover:text-blue-300">{r.name}</h3>
                      </button>
                      <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400" title="Active items are used by the Idea Generator">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-blue-500" checked={r.active} onChange={(e) => updateResource(r.id, { active: e.target.checked })} />
                        Active
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
                      <span className="rounded border border-slate-700 px-1.5 py-px text-slate-300">{r.sourceType}</span>
                      <span className="rounded border border-slate-700 px-1.5 py-px text-slate-400">{r.cohort}</span>
                      {r.targetMonth !== "Any" && <span className="rounded border border-slate-700 px-1.5 py-px text-slate-400">{r.targetMonth}</span>}
                      {needsAnalysis(r) ? (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-amber-300">
                          {analysisMode(r.fileExt, dataUrlBytes(r.fileData)) === "too-large" ? "Needs notes" : "Needs analysis"}
                        </span>
                      ) : (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-emerald-300">Analyzed</span>
                      )}
                    </div>
                    <p className="line-clamp-3 whitespace-pre-line text-xs text-slate-400">{r.extractedNotes || "No notes yet. Open this item to run AI analysis or type the key points."}</p>
                    {r.tags.length > 0 && <p className="text-[11px] text-slate-500">{r.tags.map((t) => `#${t}`).join("  ")}</p>}
                    <div className="mt-auto flex gap-2 pt-1">
                      <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={() => setOpenId(r.id)}>
                        <FileText className="h-3.5 w-3.5" /> Details
                      </button>
                      {needsAnalysis(r) && analysisMode(r.fileExt, dataUrlBytes(r.fileData)) !== "too-large" && (
                        <button className="btn-ghost py-1.5 text-xs" disabled={busyIds.has(r.id)} onClick={() => void analyze(r)}>
                          {busyIds.has(r.id) ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />} Analyze
                        </button>
                      )}
                      <button
                        className="btn-danger px-2.5 py-1.5"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => window.confirm(`Delete “${r.name}” from the Idea Base?`) && deleteResource(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {opened && (
        <ResourceModal
          resource={opened}
          busy={busyIds.has(opened.id)}
          onAnalyze={() => void analyze(opened)}
          onClose={() => setOpenId(null)}
        />
      )}
      {importOpen && <ImportIdeateModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function AddResource({ mode, onMode, onAdd }: { mode: "note" | "file"; onMode: (m: "note" | "file") => void; onAdd: (r: Omit<IdeaResource, "id" | "dateAdded">) => IdeaResource }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<string>(SOURCE_TYPES[0]);
  const [month, setMonth] = useState("Any");
  const [cohort, setCohort] = useState<string>(COHORTS[0]);
  const [tags, setTags] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setNotes("");
    setFile(null);
    setTags("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const common = {
      name: name.trim(),
      targetMonth: month,
      cohort,
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      active,
    };
    if (mode === "note") {
      if (!notes.trim()) return;
      onAdd({ ...common, inputType: "scratch", sourceType: "Scratch Idea", extractedNotes: notes.trim() });
      reset();
      return;
    }
    if (!file) return;
    if (file.size > MAX_RESOURCE_FILE_BYTES) {
      toast(`That file is ${formatBytes(file.size)}. Keep uploads under ${formatBytes(MAX_RESOURCE_FILE_BYTES)}.`, "error");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const fileData = await readAsDataUrl(file);
      let extracted = "";
      if (ext === "txt") extracted = (await readAsText(file)).trim().slice(0, 6000);
      else if (ext === "html" || ext === "htm") extracted = stripHtml(await readAsText(file)).slice(0, 6000);
      onAdd({ ...common, inputType: "file", sourceType, fileName: file.name, fileExt: ext, fileData, extractedNotes: extracted });
      reset();
    } catch {
      toast("Could not read that file.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card h-fit space-y-3 p-4">
      <Segmented
        value={mode}
        onChange={onMode}
        options={[
          { value: "note", label: "Scratch note", icon: <Plus className="h-3.5 w-3.5" /> },
          { value: "file", label: "Upload file", icon: <FileUp className="h-3.5 w-3.5" /> },
        ]}
      />
      <div>
        <label className="label" htmlFor="res-name">Title</label>
        <input id="res-name" required className="input" placeholder={mode === "note" ? "e.g. Hypertension refill incentive drive" : "e.g. 2026 DOH chronic illness calendar"} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {mode === "note" ? (
        <div>
          <label className="label" htmlFor="res-notes">Notes</label>
          <textarea id="res-notes" required rows={6} className="input text-[13px]" placeholder="Key talking points, copy hooks, copay tiers…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="res-file">File <span className="normal-case text-slate-500">(up to {formatBytes(MAX_RESOURCE_FILE_BYTES)})</span></label>
          <input
            id="res-file"
            required
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.html,.htm,.txt"
            className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-100"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
          <p className="mt-1 text-[11px] text-slate-500">TXT and HTML are read automatically. For PDFs and images, run AI analysis afterwards to extract notes (PDFs over {formatBytes(MAX_ANALYZE_BYTES)} can be stored but need notes added by hand).</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {mode === "file" && (
          <div className="col-span-2">
            <label className="label" htmlFor="res-type">Source type</label>
            <select id="res-type" className="input py-1.5" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="res-month">Target month</label>
          <select id="res-month" className="input py-1.5" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="res-cohort">Cohort</label>
          <select id="res-cohort" className="input py-1.5" value={cohort} onChange={(e) => setCohort(e.target.value)}>
            {COHORTS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="res-tags">Tags</label>
        <input id="res-tags" className="input py-1.5" placeholder="adherence, diabetes, copay" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active (use in the Idea Generator)
      </label>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to Idea Base
      </button>
    </form>
  );
}

function ResourceModal({ resource: r, busy, onAnalyze, onClose }: { resource: IdeaResource; busy: boolean; onAnalyze: () => void; onClose: () => void }) {
  const update = useStore((s) => s.updateResource);
  const toast = useToast();
  const [notes, setNotes] = useState(r.extractedNotes);
  const dirty = notes !== r.extractedNotes;

  return (
    <Modal
      size="lg"
      title={r.name}
      description={`${r.sourceType} · ${r.cohort} · added ${new Date(r.dateAdded).toLocaleDateString()}`}
      onClose={onClose}
      footer={
        <>
          {r.fileData && (
            <button className="btn-ghost" onClick={() => void openDataUrl(r.fileData!)}>
              <ExternalLink className="h-4 w-4" /> Open file
            </button>
          )}
          <button className="btn-primary" disabled={!dirty} onClick={() => {
              update(r.id, { extractedNotes: notes });
              toast("Notes saved.", "success");
            }}>
            Save notes
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="label" htmlFor="res-edit-notes">Notes the generator will use</label>
        <textarea id="res-edit-notes" rows={10} className="input text-[13px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {r.inputType === "file" && r.fileData && (
          <button className="btn-ghost" disabled={busy} onClick={onAnalyze}>
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} {r.extractedNotes ? "Re-analyze with AI" : "Analyze with AI"}
          </button>
        )}
        {r.tags.length > 0 && <p className="text-xs text-slate-500">{r.tags.map((t) => `#${t}`).join("  ")}</p>}
      </div>
    </Modal>
  );
}
