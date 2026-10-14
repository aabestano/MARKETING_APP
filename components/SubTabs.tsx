"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { moveTab, orderedTabIds, orderedTabs, sectionOf } from "@/lib/nav";
import type { TabId } from "@/lib/types";

export function SubTabs() {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);
  const tabOrder = useStore((s) => s.settings.tabOrder);
  const updateSettings = useStore((s) => s.updateSettings);
  const section = sectionOf(activeTab);
  const tabs = orderedTabs(section.id, tabOrder);

  const shift = (id: TabId, dir: -1 | 1) => {
    const ids = orderedTabIds(section.id, tabOrder);
    const next = moveTab(ids, id, dir);
    if (next === ids) return;
    updateSettings({ tabOrder: { ...tabOrder, [section.id]: next } });
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 md:px-6">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:block">{section.label}</span>
      <nav role="tablist" aria-label={`${section.label} sections`} className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((t, index) => {
          const active = t.id === activeTab;
          return (
            <div key={t.id} className="flex items-center">
              <button
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
              {active && (
                <span className="flex items-center gap-0.5 pr-1">
                  <button
                    type="button"
                    aria-label={`Move ${t.label} left`}
                    title={`Move ${t.label} left`}
                    disabled={index === 0}
                    onClick={() => shift(t.id, -1)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${t.label} right`}
                    title={`Move ${t.label} right`}
                    disabled={index === tabs.length - 1}
                    onClick={() => shift(t.id, 1)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
