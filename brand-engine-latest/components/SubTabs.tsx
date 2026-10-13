"use client";

import clsx from "clsx";
import { useStore } from "@/lib/store";
import { sectionOf } from "@/lib/nav";

export function SubTabs() {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);
  const section = sectionOf(activeTab);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 md:px-6">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:block">{section.label}</span>
      <nav role="tablist" aria-label={`${section.label} sections`} className="flex gap-1 overflow-x-auto">
        {section.tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={clsx(
                "relative whitespace-nowrap px-3 py-3 text-sm font-medium transition",
                active ? "text-slate-100" : "text-slate-500 hover:text-slate-300",
              )}
            >
              {t.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-500" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
