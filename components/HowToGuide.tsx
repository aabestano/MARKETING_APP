"use client";

import { useRef, useState } from "react";
import { BookOpen, ExternalLink, Settings2 } from "lucide-react";
import clsx from "clsx";
import { GUIDE_KEYS, GUIDE_SEGMENTS, WORKSPACE_DRIVE_URL, type GuideSegmentId } from "@/lib/how-to";

export function HowToGuide({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [segment, setSegment] = useState<GuideSegmentId>("setup");
  const scroller = useRef<HTMLDivElement>(null);
  const current = GUIDE_SEGMENTS.find((item) => item.id === segment) ?? GUIDE_SEGMENTS[0];
  const choose = (id: GuideSegmentId) => {
    setSegment(id);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-3 px-4 pt-4 md:px-8">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
              <BookOpen className="h-5 w-5 text-blue-400" /> How to Use IDEAte
            </h1>
            <p className="mt-1 text-sm text-slate-400">Start here on a first visit. Work top to bottom, or open the section you are in.</p>
          </div>
        </div>
        <nav role="tablist" aria-label="How to Use IDEAte" className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-2 md:px-6">
          {GUIDE_SEGMENTS.map((item, index) => {
            const active = item.id === segment;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`guide-tab-${item.id}`}
                aria-selected={active}
                aria-controls={`guide-panel-${item.id}`}
                onClick={() => choose(item.id)}
                className={clsx("relative whitespace-nowrap px-3 py-3 text-sm font-medium transition", active ? "text-slate-100" : "text-slate-500 hover:text-slate-300")}
              >
                <span className="mr-1.5 text-slate-500">{index + 1}</span>
                {item.label}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div
        role="tabpanel"
        id={`guide-panel-${current.id}`}
        aria-labelledby={`guide-tab-${current.id}`}
        className="mx-auto max-w-4xl space-y-4 p-4 md:p-8"
      >
        <p className="text-sm text-slate-400">{current.intro}</p>
        {current.cards.map((card) => (
          <article key={card.id} className="card space-y-4 p-4 md:p-5">
            <header>
              <h2 className="text-base font-semibold text-slate-100">{card.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{card.purpose}</p>
            </header>
            {card.groups.map((group) => (
              <section key={group.title ?? card.id} className="space-y-2">
                {group.title && <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3>}
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={`${item.name ?? ""}-${item.text}`} className="text-sm leading-relaxed text-slate-300">
                      {item.name && <span className="font-semibold text-slate-100">{item.name}. </span>}
                      {item.text}
                      {item.code && (
                        <code className="mt-1.5 block overflow-x-auto rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">{item.code}</code>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {card.id === "keys" && (
              <div className="space-y-2">
                {GUIDE_KEYS.map((key) => (
                  <div key={key.id} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                    <p className="text-sm font-semibold text-slate-100">{key.label}</p>
                    <p className="text-xs text-slate-400">{key.powers}</p>
                    <p className="mt-1 text-xs text-slate-300">Paste in {key.where}.</p>
                  </div>
                ))}
                <p className="text-xs text-slate-500">Also fill From name, From email, and Default test recipient. The from address has to be a sender Resend has already verified, or the test send fails.</p>
              </div>
            )}
            {card.id === "workspace" && (
              <a href={WORKSPACE_DRIVE_URL} target="_blank" rel="noreferrer" className="btn-primary">
                <ExternalLink className="h-4 w-4" /> Open Google Drive
              </a>
            )}
            {card.id === "settings" && (
              <button type="button" className="btn-ghost" onClick={onOpenSettings}>
                <Settings2 className="h-4 w-4" /> Open API and Mail Settings
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
