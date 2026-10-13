"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CUSTOM_ITEMS_HELPER, CUSTOM_SELECTION_LIMIT, isCustomSelectable, needsAnalysis } from "@/lib/idea-rules";
import type { IdeaResource } from "@/lib/idea-types";

export function CustomIdeaPicker({
  resources,
  selectedIds,
  onChange,
}: {
  resources: IdeaResource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () => resources.filter((resource) => !needle || `${resource.name} ${resource.tags.join(" ")} ${resource.extractedNotes}`.toLowerCase().includes(needle)),
    [resources, needle],
  );
  const atLimit = selectedIds.length >= CUSTOM_SELECTION_LIMIT;

  const toggle = (resource: IdeaResource) => {
    if (!isCustomSelectable(resource)) return;
    if (selectedIds.includes(resource.id)) {
      onChange(selectedIds.filter((id) => id !== resource.id));
      return;
    }
    if (atLimit) return;
    onChange([...selectedIds, resource.id]);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">{CUSTOM_ITEMS_HELPER}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          id="custom-idea-search"
          className="input min-w-[12rem] flex-1"
          placeholder="Search scratch ideas and files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search Idea Base items"
        />
        <p className="text-sm font-medium text-slate-200">{selectedIds.length} of 10 selected</p>
      </div>
      {resources.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-800 px-3 py-6 text-center text-sm text-slate-500">The Idea Base is empty. Add a scratch idea or analyze an uploaded file first.</p>
      ) : shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-800 px-3 py-6 text-center text-sm text-slate-500">Nothing matches that search.</p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800 p-2">
          {shown.map((resource) => {
            const blocked = needsAnalysis(resource);
            const checked = selectedIds.includes(resource.id);
            const disabled = blocked || (atLimit && !checked);
            return (
              <li key={resource.id}>
                <label className={clsx("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2", disabled ? "cursor-not-allowed border-slate-800 opacity-70" : "border-slate-800 hover:border-slate-700", checked && "border-blue-500/60 bg-blue-500/10")}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-blue-500"
                    checked={checked}
                    disabled={disabled}
                    aria-label={`Select ${resource.name}`}
                    title={blocked ? "Analyze this file in the Idea Base before selecting it." : atLimit && !checked ? "Choose up to 10." : undefined}
                    onChange={() => toggle(resource)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">{resource.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {!resource.active && <span className="rounded border border-slate-700 px-1.5 py-px text-[10px] font-medium text-slate-400">Inactive</span>}
                      {blocked && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-300">Needs analysis</span>
                      )}
                    </span>
                    {blocked && <span className="mt-1 block text-[11px] text-slate-500">Analyze this file in the Idea Base before selecting it.</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
