"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { linesToSteps, stepsToLines } from "@/lib/poster-spec";
import type { PosterSection, PosterSpec, PosterTheme } from "@/lib/poster-types";

const THEME_FIELDS: { key: keyof PosterTheme; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent and button" },
  { key: "onPrimary", label: "Text on primary" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Cards" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
];

const SECTION_LABEL: Record<PosterSection["type"], string> = {
  steps: "Steps and flowchart",
  bullets: "Key points",
  callout: "Callout",
  stats: "Stats",
};

const statsToLines = (items: { value: string; label: string }[]) => items.map((i) => `${i.value} | ${i.label}`).join("\n");
const linesToStats = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const [value, ...rest] = l.split("|");
      return { value: value.trim().slice(0, 16), label: rest.join("|").trim().slice(0, 60) };
    })
    .filter((i) => i.value);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function PosterEditor({
  spec,
  revision,
  onChange,
  onStructureChange,
  brandTheme,
}: {
  spec: PosterSpec;
  /** bumped when text-area editors must re-read the spec (reorder, add, remove, regenerate) */
  revision: number;
  onChange: (spec: PosterSpec) => void;
  onStructureChange: (spec: PosterSpec) => void;
  brandTheme: PosterTheme;
}) {
  const setSection = (i: number, section: PosterSection) => onChange({ ...spec, sections: spec.sections.map((s, idx) => (idx === i ? section : s)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= spec.sections.length) return;
    const next = [...spec.sections];
    [next[i], next[j]] = [next[j], next[i]];
    onStructureChange({ ...spec, sections: next });
  };
  const remove = (i: number) => onStructureChange({ ...spec, sections: spec.sections.filter((_, idx) => idx !== i) });
  const add = (type: PosterSection["type"]) => {
    const fresh: PosterSection =
      type === "steps"
        ? { type, style: "flowchart", title: "How it works", items: [{ label: "First step" }, { label: "Second step" }] }
        : type === "bullets"
          ? { type, title: "Key points", items: ["Point one", "Point two"] }
          : type === "callout"
            ? { type, title: "Good to know", body: "Add the note you want highlighted." }
            : { type, title: "At a glance", items: [{ value: "50%", label: "Caption" }] };
    onStructureChange({ ...spec, sections: [...spec.sections, fresh] });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3">
        <Field label="Headline">
          <textarea rows={2} className="input" value={spec.headline} onChange={(e) => onChange({ ...spec, headline: e.target.value })} />
        </Field>
        <Field label="Subheading">
          <textarea rows={2} className="input" value={spec.subheading ?? ""} onChange={(e) => onChange({ ...spec, subheading: e.target.value || undefined })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand name">
            <input className="input" value={spec.header.brandName ?? ""} onChange={(e) => onChange({ ...spec, header: { ...spec.header, brandName: e.target.value || undefined } })} />
          </Field>
          <Field label="Tagline">
            <input className="input" value={spec.header.tagline ?? ""} onChange={(e) => onChange({ ...spec, header: { ...spec.header, tagline: e.target.value || undefined } })} />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Sections</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SECTION_LABEL) as PosterSection["type"][]).map((t) => (
              <button key={t} className="btn-ghost px-2 py-1 text-xs" onClick={() => add(t)} disabled={spec.sections.length >= 6}>
                <Plus className="h-3 w-3" /> {SECTION_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {spec.sections.length === 0 && <p className="text-xs text-slate-500">No sections yet. Add steps, key points, a callout or stats.</p>}
        {spec.sections.map((s, i) => (
          <div key={`${revision}-${i}-${s.type}`} className="card space-y-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{SECTION_LABEL[s.type]}</span>
              <div className="flex items-center gap-1">
                <button className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30" aria-label="Move section up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30" aria-label="Move section down" disabled={i === spec.sections.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-red-950/60 hover:text-red-300" aria-label="Remove section" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input className="input py-1.5" placeholder="Section title (optional)" value={s.title ?? ""} onChange={(e) => setSection(i, { ...s, title: e.target.value || undefined })} />
            {s.type === "steps" && (
              <>
                <select className="input py-1.5" value={s.style} onChange={(e) => setSection(i, { ...s, style: e.target.value as "flowchart" | "numbered" })}>
                  <option value="flowchart">Flowchart (connected boxes)</option>
                  <option value="numbered">Numbered cards</option>
                </select>
                <textarea
                  rows={Math.min(10, Math.max(4, s.items.length + 1))}
                  className="input font-mono text-[12.5px]"
                  defaultValue={stepsToLines(s.items)}
                  onChange={(e) => setSection(i, { ...s, items: linesToSteps(e.target.value) })}
                />
                <p className="text-[11px] text-slate-500">One step per line. Add detail with <code>Label :: detail</code>. Make a yes or no decision with <code>Label ?? yes outcome || no outcome</code>.</p>
              </>
            )}
            {s.type === "bullets" && (
              <textarea
                rows={Math.min(10, Math.max(3, s.items.length + 1))}
                className="input text-[13px]"
                defaultValue={s.items.join("\n")}
                onChange={(e) => setSection(i, { ...s, items: e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 12) })}
              />
            )}
            {s.type === "callout" && <textarea rows={3} className="input text-[13px]" value={s.body} onChange={(e) => setSection(i, { ...s, body: e.target.value })} />}
            {s.type === "stats" && (
              <>
                <textarea rows={3} className="input font-mono text-[12.5px]" defaultValue={statsToLines(s.items)} onChange={(e) => setSection(i, { ...s, items: linesToStats(e.target.value) })} />
                <p className="text-[11px] text-slate-500">One per line as <code>value | caption</code>, e.g. <code>20% | off every refill</code>.</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Call to action</h3>
          {spec.cta ? (
            <button className="text-xs text-slate-400 hover:text-red-300" onClick={() => onChange({ ...spec, cta: undefined })}>Remove</button>
          ) : (
            <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => onChange({ ...spec, cta: { label: "Learn more", url: undefined, showQr: false } })}>Add</button>
          )}
        </div>
        {spec.cta && (
          <div className="grid gap-2">
            <input className="input py-1.5" aria-label="Button label" placeholder="Button label" value={spec.cta.label} onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, label: e.target.value } })} />
            <input
              className="input py-1.5"
              aria-label="Link"
              placeholder="https://…"
              value={spec.cta.url ?? ""}
              onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, url: e.target.value.trim() || undefined } })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={spec.cta.showQr} disabled={!spec.cta.url} onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, showQr: e.target.checked } })} />
              Show a QR code for the link
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <Field label="Footer">
          <textarea rows={2} className="input text-[13px]" value={spec.footer?.text ?? ""} onChange={(e) => onChange({ ...spec, footer: { ...spec.footer, text: e.target.value || undefined } })} />
        </Field>
        <Field label="Disclaimer">
          <textarea rows={2} className="input text-[13px]" value={spec.footer?.disclaimer ?? ""} onChange={(e) => onChange({ ...spec, footer: { ...spec.footer, disclaimer: e.target.value || undefined } })} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Colors</h3>
          <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => onChange({ ...spec, theme: brandTheme })}>Reset to brand</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
              <input
                type="color"
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                value={/^#[0-9a-f]{6}$/i.test(spec.theme[f.key]) ? spec.theme[f.key] : "#000000"}
                onChange={(e) => onChange({ ...spec, theme: { ...spec.theme, [f.key]: e.target.value } })}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
