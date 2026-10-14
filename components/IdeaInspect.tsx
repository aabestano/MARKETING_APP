"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, ClipboardCopy } from "lucide-react";
import clsx from "clsx";
import { cardBadge } from "@/lib/idea-gen";
import type { IdeaCard } from "@/lib/idea-types";
import { copyText } from "@/lib/client-utils";
import { ideaAssetText, localDateStr } from "@/lib/pipeline";
import { Modal, useToast } from "./ui";

export const BADGE_STYLES = {
  promo: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  edu: "border-indigo-500/50 bg-indigo-500/10 text-indigo-400",
  resource: "border-amber-500/50 bg-amber-500/10 text-amber-400",
} as const;

export function CardBadge({ type }: { type: string }) {
  return <span className={clsx("rounded border px-1.5 py-px text-[10px] font-semibold", BADGE_STYLES[cardBadge(type)])}>{type}</span>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

export function IdeaInspectModal({
  idea,
  onClose,
  onSchedule,
  extraFooter,
}: {
  idea: IdeaCard;
  onClose: () => void;
  /** when provided, shows the scheduling drawer */
  onSchedule?: (date: string) => void;
  extraFooter?: ReactNode;
}) {
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [date, setDate] = useState(localDateStr());
  const sms = idea.smsCopy ?? "";

  return (
    <Modal
      size="wide"
      title={idea.title}
      description={`${idea.cohort} · ${idea.offerStrategy || "No offer strategy"}`}
      onClose={onClose}
      footer={
        <>
          {extraFooter}
          <button
            className="btn-ghost"
            onClick={async () => toast((await copyText(ideaAssetText(idea))) ? "Campaign asset copied." : "Clipboard unavailable.", "info")}
          >
            <ClipboardCopy className="h-4 w-4" /> Copy asset
          </button>
          {onSchedule && (
            <button className="btn-success" onClick={() => setDrawer((d) => !d)}>
              <CalendarPlus className="h-4 w-4" /> Schedule to calendar
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <CardBadge type={idea.cardType} />
        </div>
        <Block title="Topic summary">
          <p className="leading-relaxed text-slate-300">{idea.topicSummary}</p>
        </Block>
        {idea.patientAnnouncement && (
          <Block title="Announcement">
            <p className="text-slate-300">{idea.patientAnnouncement}</p>
          </Block>
        )}
        {idea.subjectLines?.length > 0 && (
          <Block title="A/B subject lines">
            <ul className="list-disc space-y-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 p-3 pl-7 text-indigo-300">
              {idea.subjectLines.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Block>
        )}
        {idea.coreOutline?.length > 0 && (
          <Block title="Core outline">
            <ol className="list-decimal space-y-1.5 rounded-md border border-slate-800 bg-slate-900 p-3 pl-7 text-slate-300">
              {idea.coreOutline.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Block>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Block title="Call to action">
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-200">{idea.cta}</p>
          </Block>
          <Block title="SMS copy">
            <div className="rounded-md border border-slate-800 bg-slate-900 p-3 text-slate-300">
              <p>{sms}</p>
              <p className={clsx("mt-2 font-mono text-xs", sms.length > 160 ? "text-red-400" : "text-slate-500")}>{sms.length}/160</p>
            </div>
          </Block>
        </div>

        {drawer && onSchedule && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <label className="label" htmlFor="schedule-date">Send date</label>
            <div className="flex flex-wrap gap-2">
              <input id="schedule-date" type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn-success" disabled={!date} onClick={() => onSchedule(date)}>
                <CalendarPlus className="h-4 w-4" /> Confirm
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">It appears on the Calendar and the Idea Generator will avoid repeating it.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
