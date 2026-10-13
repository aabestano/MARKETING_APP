"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarPlus, PenLine } from "lucide-react";
import clsx from "clsx";
import { campaignFromIdea } from "@/lib/campaign";
import type { Campaign, IdeaCard } from "@/lib/idea-types";
import { localDateStr } from "@/lib/pipeline";
import { Modal } from "./ui";

type ContentTab = "email" | "poster";

const TABS: { id: ContentTab; label: string }[] = [
  { id: "email", label: "Email content" },
  { id: "poster", label: "Poster content" },
];

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-200">{children}</div>
    </div>
  );
}

function SampleBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

function EmailSample({ campaign }: { campaign: Campaign }) {
  const email = campaign.email;
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="bg-blue-700 px-4 py-5 text-white">
          <p className="text-lg font-semibold leading-snug">{email.heroHeadline}</p>
          {email.announcement && <p className="mt-2 text-sm text-blue-100">{email.announcement}</p>}
        </div>
        <div className="space-y-3 bg-slate-900 px-4 py-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{email.introBody}</p>
          {email.cards.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-3">
              {email.cards.map((card) => (
                <li key={card.title} className="rounded-md border border-slate-800 bg-slate-950 p-2">
                  <p className="text-xs font-semibold text-slate-100">{card.icon} {card.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{card.subtext}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{campaign.ctaLabel}</p>
        </div>
      </div>
      {email.steps.length > 0 && (
        <SampleBlock label="Ordering steps">
          {email.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.details}`).join("\n")}
        </SampleBlock>
      )}
    </div>
  );
}

function PosterSample({ campaign }: { campaign: Campaign }) {
  const poster = campaign.poster;
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="bg-slate-800 px-4 py-5">
          <p className="text-lg font-semibold leading-snug text-slate-50">{poster.headline}</p>
          {poster.subheading && <p className="mt-1 text-sm text-slate-300">{poster.subheading}</p>}
        </div>
        <div className="space-y-3 bg-slate-900 px-4 py-4 text-sm text-slate-200">
          {poster.stepsText && <p className="whitespace-pre-line">{poster.stepsText}</p>}
          {poster.pointsText && <p className="whitespace-pre-line">{poster.pointsText}</p>}
          {poster.callout && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">{poster.callout}</p>}
          {poster.footer && <p className="text-xs text-slate-400">{poster.footer}</p>}
        </div>
      </div>
      {poster.disclaimer && <SampleBlock label="Disclaimer">{poster.disclaimer}</SampleBlock>}
    </div>
  );
}

export function IdeaFullContentModal({
  idea,
  onClose,
  onEdit,
  onSchedule,
  onCache,
}: {
  idea: IdeaCard;
  onClose: () => void;
  onEdit: (campaign: Campaign) => void;
  onSchedule: (date: string, campaign: Campaign) => void;
  onCache?: (campaign: Campaign) => void;
}) {
  const campaign = idea.campaign ?? campaignFromIdea(idea);
  const [tab, setTab] = useState<ContentTab>("email");
  const [drawer, setDrawer] = useState(false);
  const [date, setDate] = useState(localDateStr());
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const fromKey = useRef(false);
  const cached = useRef(false);

  useEffect(() => {
    if (cached.current || idea.campaign || !idea.id) return;
    cached.current = true;
    onCache?.(campaignFromIdea(idea));
  }, [idea, onCache]);

  useEffect(() => {
    if (!fromKey.current) return;
    fromKey.current = false;
    buttons.current[tab === "email" ? 0 : 1]?.focus();
  }, [tab]);

  const move = (next: ContentTab) => {
    fromKey.current = true;
    setTab(next);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tab === "email" ? 0 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(TABS[(index + 1) % TABS.length].id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(TABS[(index - 1 + TABS.length) % TABS.length].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      move("email");
    } else if (event.key === "End") {
      event.preventDefault();
      move("poster");
    }
  };

  return (
    <Modal
      size="wide"
      title="Full idea content"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={() => onEdit(campaign)}>
            <PenLine className="h-4 w-4" /> Edit in Idea Studio
          </button>
          <button type="button" className="btn-success" onClick={() => setDrawer((open) => !open)}>
            <CalendarPlus className="h-4 w-4" /> Schedule to Calendar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          To edit the content, commit the idea to your calendar or edit in the Idea Studio
        </p>
        <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-2">
          <SummaryItem label="Title">{idea.title}</SummaryItem>
          <SummaryItem label="Cohort">{idea.cohort}</SummaryItem>
          <SummaryItem label="Offer">{idea.offerStrategy || "No offer strategy"}</SummaryItem>
          <SummaryItem label="Subject lines">
            {idea.subjectLines.length ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {idea.subjectLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500">No subject lines</span>
            )}
          </SummaryItem>
        </div>

        <div className="relative px-1 pt-3">
          <div role="tablist" aria-label="Full idea content" className="relative z-20 flex items-end">
            {TABS.map((item, index) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    buttons.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`idea-full-${item.id}`}
                  aria-controls={`idea-full-panel-${item.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  onKeyDown={onTabKey}
                  className={clsx(
                    "relative min-w-0 max-w-[16rem] rounded-t-lg border px-3 py-2 text-sm font-semibold sm:px-4",
                    index > 0 && "-ml-4",
                    selected
                      ? "z-30 -mt-2 border-slate-700 border-b-slate-950 bg-slate-950 text-slate-100"
                      : "z-10 border-slate-800 bg-slate-900 text-slate-400",
                  )}
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id={`idea-full-panel-${tab}`}
            aria-labelledby={`idea-full-${tab}`}
            className="relative z-20 -mt-px rounded-lg border border-slate-700 bg-slate-950 p-4"
          >
            {tab === "email" ? <EmailSample campaign={campaign} /> : <PosterSample campaign={campaign} />}
          </div>
        </div>

        {drawer && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <label className="label" htmlFor="full-schedule-date">Send date</label>
            <div className="flex flex-wrap gap-2">
              <input id="full-schedule-date" type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
              <button type="button" className="btn-success" disabled={!date} onClick={() => onSchedule(date, campaign)}>
                <CalendarPlus className="h-4 w-4" /> Confirm
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Scheduling removes it from the generated ideas list and adds it to the Calendar.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
