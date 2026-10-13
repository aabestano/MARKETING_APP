"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, Eye, FileSearch, Lightbulb, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { postJson } from "@/lib/client-utils";
import { COHORTS, FOCUS_TYPES, GEN_MODES, TONES, type Campaign, type GenMode, type IdeaCard } from "@/lib/idea-types";
import { isCustomSelectable, UNSCHEDULED_IDEA_LIMIT } from "@/lib/idea-rules";
import { getExclusions, localDateStr } from "@/lib/pipeline";
import { EmptyState, Spinner, useToast } from "./ui";
import { CardBadge, IdeaInspectModal } from "./IdeaInspect";
import { CustomIdeaPicker } from "./CustomIdeaPicker";
import { IdeaFullContentModal } from "./IdeaFullContent";
import type { ServerStatus } from "./AppShell";

const FOCUS_TONE: Record<string, string> = {
  emerald: "accent-emerald-500",
  indigo: "accent-indigo-500",
  amber: "accent-amber-500",
};

export function IdeaGenerator({ status, onOpenSettings }: { status: ServerStatus | null; onOpenSettings: () => void }) {
  const ideaBase = useStore((s) => s.ideaBase);
  const pipeline = useStore((s) => s.pipeline);
  const ideas = useStore((s) => s.generatedIdeas);
  const addGeneratedIdeas = useStore((s) => s.addGeneratedIdeas);
  const patchGeneratedIdea = useStore((s) => s.patchGeneratedIdea);
  const schedule = useStore((s) => s.schedule);
  const settings = useStore((s) => s.settings);
  const setTab = useStore((s) => s.setTab);
  const setStudio = useStore((s) => s.setStudio);
  const toast = useToast();

  const [mode, setMode] = useState<GenMode>("Hybrid");
  const [cohort, setCohort] = useState<string>(COHORTS[0]);
  const [tone, setTone] = useState<string>(TONES[0].value);
  const [focus, setFocus] = useState<string[]>(["Promotional", "Non-Promotional"]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [fullId, setFullId] = useState<string | null>(null);

  const hasKey = !!settings.geminiApiKey || !!status?.gemini;
  const exclusions = useMemo(() => getExclusions(pipeline), [pipeline]);
  const activeResources = useMemo(() => ideaBase.filter((r) => r.active && r.extractedNotes.trim() && !exclusions.sourceIds.includes(r.id)), [ideaBase, exclusions]);
  const scheduledIds = useMemo(() => new Set(pipeline.flatMap((item) => (item.ideaData.id ? [item.ideaData.id] : []))), [pipeline]);
  const visibleIdeas = useMemo(
    () => ideas.filter((idea) => !idea.id || !scheduledIds.has(idea.id)).slice(0, UNSCHEDULED_IDEA_LIMIT),
    [ideas, scheduledIds],
  );
  const selectedResources = useMemo(
    () =>
      selectedIds.flatMap((id) => {
        const resource = ideaBase.find((item) => item.id === id);
        return resource && isCustomSelectable(resource) ? [resource] : [];
      }),
    [selectedIds, ideaBase],
  );

  const generate = async () => {
    if (!focus.length) {
      setError("Select at least one focus type.");
      return;
    }
    if (mode === "Custom Items" && selectedResources.length === 0) {
      setError("Choose at least one Idea Base item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resources =
        mode === "Custom Items"
          ? selectedResources.map((resource) => ({ id: resource.id, name: resource.name, extractedNotes: resource.extractedNotes }))
          : activeResources.map((resource) => ({ id: resource.id, name: resource.name, extractedNotes: resource.extractedNotes }));
      const data = await postJson<{ ideas: IdeaCard[]; source: "gemini" | "fallback"; warnings: string[] }>("/api/generate-ideas", {
        mode,
        cohort,
        tone,
        focusTypes: focus,
        exclusions,
        resources,
        model: settings.geminiModel,
        apiKey: settings.geminiApiKey,
      });
      const before = visibleIdeas.length;
      const saved = addGeneratedIdeas(data.ideas);
      const openAfter = saved.filter((idea) => !idea.id || !scheduledIds.has(idea.id)).length;
      const removed = Math.max(0, before + data.ideas.length - openAfter);
      const warnings = [...data.warnings];
      if (removed > 0) warnings.push(`${removed} oldest unscheduled ${removed === 1 ? "idea was" : "ideas were"} removed to keep the newest 10.`);
      setNotes(warnings);
      toast(`${data.ideas.length} idea${data.ideas.length === 1 ? "" : "s"} generated.`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const inspected = inspectId ? ideas.find((idea) => idea.id === inspectId) : undefined;
  const fullIdea = fullId ? ideas.find((idea) => idea.id === fullId) : undefined;

  const openFull = (idea: IdeaCard) => {
    if (!idea.id) return;
    setInspectId(null);
    setFullId(idea.id);
  };

  const commit = (idea: IdeaCard, date: string, campaign?: Campaign) => {
    schedule(idea, date, campaign);
    setInspectId(null);
    setFullId(null);
    toast(`Scheduled for ${date === localDateStr() ? "today" : date}. Find it on the Calendar.`, "success");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-100">Idea Generator</h1>
          <p className="mt-1 text-sm text-slate-400">Generate campaign ideas from your Idea Base and the cohort you want to reach, then schedule the ones you like.</p>
        </header>

        <section className="card space-y-5 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Campaign generation matrix</h2>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] text-slate-400">
              {exclusions.titles.length} upcoming item{exclusions.titles.length === 1 ? "" : "s"} excluded from suggestions
            </span>
          </div>

          <div>
            <p className="label">Generation mode</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {GEN_MODES.map((m) => (
                <label key={m.value} className={clsx("cursor-pointer rounded-lg border p-3 text-sm transition", mode === m.value ? "border-blue-500/70 bg-blue-500/10" : "border-slate-800 bg-slate-900 hover:border-slate-700")}>
                  <input type="radio" name="gen-mode" className="sr-only" checked={mode === m.value} onChange={() => setMode(m.value)} />
                  <span className="block font-semibold text-slate-100">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{m.hint}</span>
                </label>
              ))}
            </div>
            {mode === "Custom Items" ? (
              <div className="mt-3">
                <CustomIdeaPicker resources={ideaBase} selectedIds={selectedIds} onChange={setSelectedIds} />
              </div>
            ) : mode !== "Pure Random" ? (
              <p className="mt-2 text-xs text-slate-500">
                {activeResources.length} active Idea Base item{activeResources.length === 1 ? "" : "s"} with notes will be used.
                {activeResources.length === 0 && mode === "Idea Base Match" && " Idea Base Match needs at least one."}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="label" htmlFor="gen-cohort">Target cohort</label>
              <select id="gen-cohort" className="input" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                {COHORTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gen-tone">Tone</label>
              <select id="gen-tone" className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="label">Focus types (one idea each)</p>
            <div className="grid gap-2 md:grid-cols-3">
              {FOCUS_TYPES.map((f) => (
                <label key={f.value} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm hover:border-slate-700">
                  <input
                    type="checkbox"
                    className={clsx("mt-0.5 h-4 w-4", FOCUS_TONE[f.tone])}
                    checked={focus.includes(f.value)}
                    onChange={(e) => setFocus((cur) => (e.target.checked ? [...cur, f.value] : cur.filter((x) => x !== f.value)))}
                  />
                  <span>
                    <span className="block font-semibold text-slate-100">{f.value}</span>
                    <span className="block text-xs text-slate-400">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!hasKey && (
            <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                No Gemini API key found, so built-in adherence templates are shown instead of fresh ideas.{" "}
                <button className="underline hover:text-slate-100" onClick={onOpenSettings}>Add a key</button> for AI ideas.
              </p>
            </div>
          )}
          {error && <p role="alert" className="alert-error">{error}</p>}
          <button
            className="btn-primary w-full py-2.5"
            disabled={busy || (mode === "Custom Items" && selectedResources.length === 0)}
            onClick={() => void generate()}
          >
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} {busy ? "Generating ideas…" : visibleIdeas.length ? "Generate new ideas" : "Generate ideas"}
          </button>
        </section>

        {notes.length > 0 && !busy && (
          <ul className="space-y-1 rounded-md border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}

        {visibleIdeas.length === 0 && !busy ? (
          <EmptyState
            icon={<Lightbulb className="h-5 w-5" />}
            title="No ideas yet"
            body="Choose a cohort and focus, then generate. Up to 10 unscheduled ideas stay here. Scheduling one moves it to the Calendar."
            action={<button className="btn-ghost" onClick={() => setTab("idea-base")}>Open Idea Base</button>}
          />
        ) : (
          <section aria-live="polite" className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              Generated ideas <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{visibleIdeas.length}</span>
            </h2>
            {visibleIdeas.length >= UNSCHEDULED_IDEA_LIMIT && (
              <p className="text-xs text-slate-500">The 10 newest unscheduled ideas are kept. Generating more removes the oldest first.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleIdeas.map((idea) => (
                <article key={idea.id ?? idea.title} className="card flex flex-col gap-2 p-4">
                  <CardBadge type={idea.cardType} />
                  <h3 className="text-sm font-semibold text-slate-100">{idea.title}</h3>
                  <p className="line-clamp-4 text-xs text-slate-400">{idea.topicSummary}</p>
                  <p className="text-[11px] text-slate-500">{idea.cohort}</p>
                  <div className="mt-auto flex flex-col gap-2">
                    <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => idea.id && setInspectId(idea.id)}>
                      <Eye className="h-3.5 w-3.5" /> Inspect and schedule
                    </button>
                    <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => openFull(idea)}>
                      <FileSearch className="h-3.5 w-3.5" /> Inspect full idea content
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {inspected && (
        <IdeaInspectModal
          idea={inspected}
          onClose={() => setInspectId(null)}
          onInspectFull={() => openFull(inspected)}
          onSchedule={(date) => commit(inspected, date)}
          extraFooter={
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarCheck className="h-3.5 w-3.5" /> Scheduling removes it from this list
            </span>
          }
        />
      )}
      {fullIdea && (
        <IdeaFullContentModal
          idea={fullIdea}
          onClose={() => setFullId(null)}
          onCache={(campaign) => fullIdea.id && patchGeneratedIdea(fullIdea.id, { campaign })}
          onEdit={(campaign) => {
            setStudio({ campaign, pipelineId: null });
            setFullId(null);
            setTab("idea-studio");
          }}
          onSchedule={(date, campaign) => commit(fullIdea, date, campaign)}
        />
      )}
    </div>
  );
}
