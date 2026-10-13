"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { ASSET_FOLDERS, ASSET_PURPOSES, normalizePurposes, togglePurpose, type AssetFolder } from "@/lib/assets";
import type { AssetPurpose } from "@/lib/types";

/** Checkbox pair: pick Email Design, Poster Illustration, or both. The last remaining box can't be cleared. */
export function PurposePicker({
  value,
  onChange,
  compact = false,
  idPrefix,
}: {
  value: AssetPurpose[];
  onChange: (next: AssetPurpose[]) => void;
  compact?: boolean;
  idPrefix: string;
}) {
  const current = normalizePurposes(value);
  return (
    <fieldset>
      {!compact && <legend className="label">Use these assets for</legend>}
      <div className={clsx("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
        {ASSET_PURPOSES.map((p) => {
          const checked = current.includes(p.id);
          const locked = checked && current.length === 1;
          return (
            <label
              key={p.id}
              htmlFor={`${idPrefix}-${p.id}`}
              title={locked ? "Every asset needs at least one use. Tick the other option first." : undefined}
              className={clsx(
                "inline-flex select-none items-center gap-1.5 rounded-md border transition",
                compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
                locked ? "cursor-not-allowed" : "cursor-pointer",
                checked ? "border-blue-500/60 bg-blue-500/10 text-blue-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700",
              )}
            >
              <input
                id={`${idPrefix}-${p.id}`}
                type="checkbox"
                className="sr-only"
                checked={checked}
                aria-disabled={locked}
                onChange={() => onChange(togglePurpose(current, p.id))}
              />
              <span
                aria-hidden
                className={clsx(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                  checked ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600",
                )}
              >
                {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {p.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FolderTabs({
  value,
  onChange,
  counts,
}: {
  value: AssetFolder;
  onChange: (f: AssetFolder) => void;
  counts: Record<AssetFolder, number>;
}) {
  return (
    <div role="tablist" aria-label="Asset folders" className="inline-flex flex-wrap rounded-md border border-slate-800 bg-slate-900 p-0.5">
      {ASSET_FOLDERS.map((f) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={value === f.id}
          onClick={() => onChange(f.id)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition",
            value === f.id ? "bg-slate-800 text-slate-100 shadow" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {f.label}
          <span className="rounded-full bg-slate-950 px-1.5 text-[10px] text-slate-400">{counts[f.id]}</span>
        </button>
      ))}
    </div>
  );
}
