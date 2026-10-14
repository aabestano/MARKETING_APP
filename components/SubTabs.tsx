"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { moveTab, orderedTabIds, orderedTabs, sectionOf } from "@/lib/nav";
import { uiCopy } from "@/lib/ui-copy";
import type { TabId } from "@/lib/types";
import { CreateBrandSelect } from "./CreateBrandSelect";

export function SubTabs() {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);
  const settings = useStore((s) => s.settings);
  const tabOrder = settings.tabOrder;
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
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 md:px-6">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:block">{uiCopy(section.labelKey, settings.copyOverrides)}</span>
      <nav role="tablist" aria-label={`${uiCopy(section.labelKey, settings.copyOverrides)} sections`} className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((t, index) => {
          const active = t.id === activeTab;
          const label = uiCopy(t.copyKey, settings.copyOverrides);
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
                {label}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-500" />}
              </button>
              {active && (
                <span className="flex items-center gap-0.5 pr-1">
                  <button
                    type="button"
                    aria-label={`Move ${label} left`}
                    title={`Move ${label} left`}
                    disabled={index === 0}
                    onClick={() => shift(t.id, -1)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} right`}
                    title={`Move ${label} right`}
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
      {section.id === "create" && <CreateBrandSelect />}
    </div>
  );
}
