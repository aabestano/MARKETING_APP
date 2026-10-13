"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, Mail, X, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, FileText, Plus, Trash2, Undo2, CheckCircle2, Upload } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { campaignFromIdea, blankCampaign } from "@/lib/campaign";
import { downloadFile } from "@/lib/client-utils";
import { openSavedBlast, openSavedPoster } from "@/lib/design-nav";
import type { IdeaCard, PipelineItem } from "@/lib/idea-types";
import type { SavedBlast } from "@/lib/types";
import type { SavedPoster } from "@/lib/poster-types";
import { PAST_STATUS, buildMonthGrid, localDateStr, pipelineToCsv, pipelineToIcs } from "@/lib/pipeline";
import { EmptyState, Modal, useToast } from "./ui";
import { CardBadge, IdeaInspectModal } from "./IdeaInspect";
import { ImportIdeateModal } from "./ImportIdeateModal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusStyle = (status: string) =>
  status === "Completed"
    ? "border-slate-600/60 bg-slate-700/30 text-slate-400 line-through decoration-slate-500"
    : status === PAST_STATUS
      ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
      : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";

const NEW_IDEA: IdeaCard = {
  cardType: "Promotional",
  sourceId: null,
  title: "New campaign",
  topicSummary: "",
  patientAnnouncement: "",
  patientIntro: "",
  cohort: "All Members",
  offerStrategy: "",
  subjectLines: [],
  coreOutline: [],
  cta: "",
  smsCopy: "",
};

export function Calendar() {
  const pipeline = useStore((s) => s.pipeline);
  const update = useStore((s) => s.updatePipelineItem);
  const remove = useStore((s) => s.removePipelineItem);
  const schedule = useStore((s) => s.schedule);
  const setStudio = useStore((s) => s.setStudio);
  const setTab = useStore((s) => s.setTab);
  const blasts = useStore((s) => s.blasts);
  const posters = useStore((s) => s.posters);
  const unlinkDesign = useStore((s) => s.unlinkDesign);
  const toast = useToast();

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [day, setDay] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month, pipeline), [cursor, pipeline]);
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (delta: number) => setCursor((c) => {
    const d = new Date(c.year, c.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dayItems = day ? pipeline.filter((p) => p.scheduledDate === day) : [];
  const viewing = viewId ? pipeline.find((p) => p.id === viewId) : undefined;

  const openInStudio = (item: PipelineItem) => {
    setStudio({ campaign: item.campaign ?? campaignFromIdea(item.ideaData), pipelineId: item.id });
    setTab("idea-studio");
  };

  const stats = {
    scheduled: pipeline.filter((p) => p.status === "Scheduled").length,
    released: pipeline.filter((p) => p.status === PAST_STATUS).length,
    done: pipeline.filter((p) => p.status === "Completed").length,
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Calendar</h1>
            <p className="mt-1 text-sm text-slate-400">
              {stats.scheduled} scheduled · {stats.released} released · {stats.done} completed
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import from IDEAte
            </button>
            <button className="btn-ghost" disabled={!pipeline.length} onClick={() => downloadFile("campaign-calendar.csv", pipelineToCsv(pipeline), "text/csv")}>
              <Download className="h-4 w-4" /> CSV
            </button>
            <button className="btn-ghost" disabled={!pipeline.length} onClick={() => downloadFile("campaign-calendar.ics", pipelineToIcs(pipeline), "text/calendar")}>
              <Download className="h-4 w-4" /> iCal
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost px-2 py-1.5" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-ghost py-1.5 text-xs" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>Today</button>
            <button className="btn-ghost px-2 py-1.5" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800">
          <div className="grid grid-cols-7 bg-slate-900 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-800">
            {cells.map((c, i) =>
              c.date ? (
                <button
                  key={c.date}
                  onClick={() => setDay(c.date)}
                  aria-label={`${c.date}${c.items.length ? `, ${c.items.length} item${c.items.length > 1 ? "s" : ""}` : ""}`}
                  className={clsx("flex min-h-[4.5rem] flex-col gap-1 bg-slate-950 p-1.5 text-left transition hover:bg-slate-900 md:min-h-[6.5rem]", c.isToday && "ring-1 ring-inset ring-blue-500")}
                >
                  <span className={clsx("text-xs font-medium", c.isToday ? "text-blue-400" : "text-slate-400")}>{c.day}</span>
                  {c.items.slice(0, 2).map((it) => (
                    <span key={it.id} className={clsx("hidden truncate rounded border px-1 py-px text-[10px] md:block", statusStyle(it.status))}>
                      {it.ideaData.title}
                    </span>
                  ))}
                  {c.items.length > 0 && (
                    <span className="flex gap-0.5 md:hidden">
                      {c.items.slice(0, 4).map((it) => (
                        <span key={it.id} className={clsx("h-1.5 w-1.5 rounded-full", it.status === "Completed" ? "bg-slate-500" : it.status === PAST_STATUS ? "bg-amber-400" : "bg-emerald-400")} />
                      ))}
                    </span>
                  )}
                  {c.items.length > 2 && <span className="hidden text-[10px] text-slate-500 md:block">+{c.items.length - 2} more</span>}
                </button>
              ) : (
                <div key={`pad-${i}`} className="min-h-[4.5rem] bg-slate-950/60 md:min-h-[6.5rem]" />
              ),
            )}
          </div>
        </div>

        {pipeline.length === 0 && (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Nothing scheduled yet"
            body="Schedule an idea from the Idea Generator, click a day to add a campaign, or import your pipeline from the old IDEAte app."
            action={
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => setTab("idea-generator")}>Open Idea Generator</button>
                <button className="btn-ghost" onClick={() => setImportOpen(true)}>Import from IDEAte</button>
              </div>
            }
          />
        )}
      </div>

      {day && (
        <Modal
          title={new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          description={day === localDateStr() ? "Today" : undefined}
          onClose={() => setDay(null)}
          footer={
            <button
              className="btn-ghost"
              onClick={() => {
                const item = schedule(NEW_IDEA, day, blankCampaign());
                setDay(null);
                openInStudio(useStore.getState().pipeline.find((p) => p.id === item.id) ?? item);
              }}
            >
              <Plus className="h-4 w-4" /> Add a campaign on this day
            </button>
          }
        >
          {dayItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No campaigns on this day.</p>
          ) : (
            <ul className="space-y-3">
              {dayItems.map((it) => (
                <li key={it.id} className="card space-y-2.5 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardBadge type={it.ideaData.cardType} />
                    <span className={clsx("rounded border px-1.5 py-px text-[10px] font-medium", statusStyle(it.status).replace(" line-through decoration-slate-500", ""))}>{it.status}</span>
                    {it.campaign && <span className="text-[10px] text-slate-500">Studio content saved</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">{it.ideaData.title}</h3>
                  {it.ideaData.topicSummary && <p className="line-clamp-2 text-xs text-slate-400">{it.ideaData.topicSummary}</p>}
                  <LinkedDesigns
                    item={it}
                    blasts={blasts}
                    posters={posters}
                    onOpenBlast={(b) => { setDay(null); openSavedBlast(b); }}
                    onOpenPoster={(p) => { setDay(null); openSavedPoster(p); }}
                    onUnlink={(link) => unlinkDesign(it.id, link)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-ghost py-1.5 text-xs" onClick={() => setViewId(it.id)}>
                      <Eye className="h-3.5 w-3.5" /> View idea
                    </button>
                    <button
                      className="btn-primary py-1.5 text-xs"
                      onClick={() => {
                        setDay(null);
                        openInStudio(it);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" /> Open in Idea Studio
                    </button>
                    {it.status === "Completed" ? (
                      <button className="btn-ghost py-1.5 text-xs" onClick={() => update(it.id, { status: "Scheduled" })}>
                        <Undo2 className="h-3.5 w-3.5" /> Reopen
                      </button>
                    ) : (
                      <button className="btn-success py-1.5 text-xs" onClick={() => update(it.id, { status: "Completed" })}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                      </button>
                    )}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                      Move to
                      <input
                        type="date"
                        className="input w-auto py-1 text-xs"
                        value={it.scheduledDate}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          update(it.id, { scheduledDate: e.target.value, ...(it.status === PAST_STATUS && e.target.value >= localDateStr() ? { status: "Scheduled" } : {}) });
                          setDay(e.target.value);
                        }}
                      />
                    </label>
                    <button
                      className="btn-danger px-2.5 py-1.5"
                      aria-label={`Remove ${it.ideaData.title}`}
                      onClick={() => {
                        if (window.confirm(`Remove “${it.ideaData.title}” from the calendar?`)) {
                          remove(it.id);
                          toast("Removed from the calendar.", "info");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {viewing && (
        <IdeaInspectModal
          idea={viewing.ideaData}
          onClose={() => setViewId(null)}
          extraFooter={
            <button
              className="btn-primary"
              onClick={() => {
                setViewId(null);
                setDay(null);
                openInStudio(viewing);
              }}
            >
              <FileText className="h-4 w-4" /> Open in Idea Studio
            </button>
          }
        />
      )}
      {importOpen && <ImportIdeateModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function LinkedDesigns({
  item,
  blasts,
  posters,
  onOpenBlast,
  onOpenPoster,
  onUnlink,
}: {
  item: PipelineItem;
  blasts: SavedBlast[];
  posters: SavedPoster[];
  onOpenBlast: (b: SavedBlast) => void;
  onOpenPoster: (p: SavedPoster) => void;
  onUnlink: (link: { blastId?: string; posterId?: string }) => void;
}) {
  const linkedBlasts = (item.blastIds ?? []).map((id) => blasts.find((b) => b.id === id)).filter((b): b is SavedBlast => !!b);
  const linkedPosters = (item.posterIds ?? []).map((id) => posters.find((p) => p.id === id)).filter((p): p is SavedPoster => !!p);
  if (!linkedBlasts.length && !linkedPosters.length) return null;
  return (
    <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-900/60 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Designs for this campaign</p>
      <ul className="space-y-1">
        {linkedBlasts.map((b) => (
          <li key={b.id} className="flex items-center gap-2 text-xs">
            <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <button className="min-w-0 flex-1 truncate text-left text-slate-200 hover:text-blue-300" onClick={() => onOpenBlast(b)}>{b.name}</button>
            <button className="rounded p-0.5 text-slate-500 hover:text-red-300" aria-label={`Unlink ${b.name}`} onClick={() => onUnlink({ blastId: b.id })}><X className="h-3 w-3" /></button>
          </li>
        ))}
        {linkedPosters.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
            <button className="min-w-0 flex-1 truncate text-left text-slate-200 hover:text-blue-300" onClick={() => onOpenPoster(p)}>{p.name}</button>
            <button className="rounded p-0.5 text-slate-500 hover:text-red-300" aria-label={`Unlink ${p.name}`} onClick={() => onUnlink({ posterId: p.id })}><X className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
