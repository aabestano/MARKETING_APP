"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  bannerEligible,
  insertSection,
  isBlockHidden,
  isSectionKey,
  layoutOf,
  moveInBanner,
  moveInOrder,
  normalizeLayout,
  removeSection,
  sectionIndex,
  setInBanner,
  SLOT_ROLE,
  type PosterBlockKey,
  type PosterLayout,
} from "@/lib/poster-blocks";
import { linesToSteps, stepsToLines } from "@/lib/poster-spec";
import type { PosterSection, PosterSpec, PosterTheme } from "@/lib/poster-types";

const THEME_FIELDS: { key: keyof PosterTheme; label: string }[] = [
  { key: "primary", label: "Banner background" },
  { key: "accent", label: "Accent and button" },
  { key: "onPrimary", label: "Banner text" },
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

const BLOCK_LABEL: Record<string, string> = {
  brand: "Brand row",
  headline: "Headline",
  subheading: "Subheading",
  illustration: "Illustration",
  cta: "Call to action",
  footer: "Footer",
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function MoveButtons({ name, upDisabled, downDisabled, onUp, onDown }: { name: string; upDisabled: boolean; downDisabled: boolean; onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30" aria-label={`Move ${name} up`} disabled={upDisabled} onClick={onUp}>
        <ArrowUp className="h-3.5 w-3.5" /> Move up
      </button>
      <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30" aria-label={`Move ${name} down`} disabled={downDisabled} onClick={onDown}>
        <ArrowDown className="h-3.5 w-3.5" /> Move down
      </button>
    </div>
  );
}

export function PosterEditor({
  spec,
  revision,
  onChange,
  onStructureChange,
  brandTheme,
  illustrationEditor,
}: {
  spec: PosterSpec;
  /** bumped when text-area editors must re-read the spec (reorder, add, remove, regenerate) */
  revision: number;
  onChange: (spec: PosterSpec) => void;
  onStructureChange: (spec: PosterSpec) => void;
  brandTheme: PosterTheme;
  illustrationEditor?: ReactNode;
}) {
  const layout = layoutOf(spec);
  const [adding, setAdding] = useState(false);
  const withLayout = (next: PosterLayout, sections = spec.sections) => ({ ...spec, sections, layout: next });
  const setHidden = (key: PosterBlockKey, hide: boolean) => {
    if (isSectionKey(key)) {
      const index = sectionIndex(key);
      const sections = spec.sections.map((section, i) => (i === index ? { ...section, hidden: hide || undefined } : section));
      onChange({ ...spec, sections });
      return;
    }
    const current = spec.hiddenBlocks ?? [];
    const hiddenBlocks = hide ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key);
    onChange({ ...spec, hiddenBlocks: hiddenBlocks.length ? hiddenBlocks : undefined });
  };

  const setSection = (i: number, section: PosterSection) => {
    const sections = spec.sections.map((s, idx) => (idx === i ? section : s));
    const next = { ...spec, sections, layout: normalizeLayout(layout, sections) };
    if (spec.sections[i]?.type !== section.type) onStructureChange(next);
    else onChange(next);
  };
  const remove = (i: number) => onStructureChange(withLayout(removeSection(layout, i, spec.sections.filter((_, idx) => idx !== i)), spec.sections.filter((_, idx) => idx !== i)));
  const add = (type: PosterSection["type"]) => {
    const fresh: PosterSection =
      type === "steps"
        ? { type, style: "flowchart", title: "How it works", items: [{ label: "First step" }, { label: "Second step" }] }
        : type === "bullets"
          ? { type, title: "Key points", items: ["Point one", "Point two"] }
          : type === "callout"
            ? { type, title: "Good to know", body: "Add the note you want highlighted." }
            : { type, title: "At a glance", items: [{ value: "50%", label: "Caption" }] };
    const sections = [...spec.sections, fresh];
    onStructureChange(withLayout(insertSection(layout, sections), sections));
  };

  const blockName = (key: PosterBlockKey) => {
    if (!isSectionKey(key)) return BLOCK_LABEL[key] ?? "Block";
    const section = spec.sections[sectionIndex(key)];
    return section ? SECTION_LABEL[section.type] : "Section";
  };

  const bannerToggle = (key: PosterBlockKey, slot?: number) => {
    if (!bannerEligible(key, spec.sections)) return null;
    const on = layout.banner.includes(key);
    const full = !on && layout.banner.length >= 4;
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-xs text-slate-300" title={full ? "The banner already has four blocks." : undefined}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-500"
            checked={on}
            disabled={full}
            onChange={(e) => onStructureChange(withLayout(setInBanner(layout, key, e.target.checked, spec.sections)))}
          />
          Banner styling
        </label>
        {slot !== undefined && <p className="text-[11px] text-slate-500">Slot {slot + 1}, {SLOT_ROLE[slot]}</p>}
      </div>
    );
  };

  const sectionBody = (i: number) => {
    const s = spec.sections[i];
    if (!s) return null;
    return (
      <div className="space-y-2.5">
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
    );
  };

  const blockFields = (key: PosterBlockKey) => {
    if (key === "brand") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand name">
            <input className="input" value={spec.header.brandName ?? ""} onChange={(e) => onChange({ ...spec, header: { ...spec.header, brandName: e.target.value || undefined } })} />
          </Field>
          <Field label="Tagline">
            <input className="input" value={spec.header.tagline ?? ""} onChange={(e) => onChange({ ...spec, header: { ...spec.header, tagline: e.target.value || undefined } })} />
          </Field>
        </div>
      );
    }
    if (key === "headline") {
      return (
        <Field label="Headline">
          <textarea rows={2} className="input" value={spec.headline} onChange={(e) => onChange({ ...spec, headline: e.target.value })} />
        </Field>
      );
    }
    if (key === "subheading") {
      return (
        <Field label="Subheading">
          <textarea rows={2} className="input" value={spec.subheading ?? ""} onChange={(e) => onChange({ ...spec, subheading: e.target.value || undefined })} />
        </Field>
      );
    }
    if (key === "illustration") return illustrationEditor ?? <p className="text-xs text-slate-500">Choose or draw a picture for this block.</p>;
    if (key === "cta") {
      return (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Button</span>
            {spec.cta ? (
              <button type="button" className="text-xs text-slate-400 hover:text-red-300" onClick={() => onChange({ ...spec, cta: undefined })}>Remove</button>
            ) : (
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300" onClick={() => onChange({ ...spec, cta: { label: "Learn more", url: undefined, showQr: false } })}>Add</button>
            )}
          </div>
          {spec.cta && (
            <>
              <input className="input py-1.5" aria-label="Button label" placeholder="Button label" value={spec.cta.label} onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, label: e.target.value } })} />
              <input className="input py-1.5" aria-label="Link" placeholder="https://…" value={spec.cta.url ?? ""} onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, url: e.target.value.trim() || undefined } })} />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={spec.cta.showQr} disabled={!spec.cta.url} onChange={(e) => onChange({ ...spec, cta: { ...spec.cta!, showQr: e.target.checked } })} />
                Show a QR code for the link
              </label>
            </>
          )}
        </div>
      );
    }
    if (key === "footer") {
      return (
        <div className="grid gap-3">
          <Field label="Footer">
            <textarea rows={2} className="input text-[13px]" value={spec.footer?.text ?? ""} onChange={(e) => onChange({ ...spec, footer: { ...spec.footer, text: e.target.value || undefined } })} />
          </Field>
          <Field label="Disclaimer">
            <textarea rows={2} className="input text-[13px]" value={spec.footer?.disclaimer ?? ""} onChange={(e) => onChange({ ...spec, footer: { ...spec.footer, disclaimer: e.target.value || undefined } })} />
          </Field>
        </div>
      );
    }
    return sectionBody(sectionIndex(key));
  };

  const blockCard = (key: PosterBlockKey, move: { index: number; count: number; onMove: (dir: -1 | 1) => void }, slot?: number) => {
    const name = blockName(key) ?? "Block";
    const sectionAt = isSectionKey(key) ? sectionIndex(key) : -1;
    const shown = !isBlockHidden(spec, key);
    return (
      <div key={`${revision}-${key}`} className={clsx("card space-y-2.5 p-3", !shown && "opacity-70")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-500"
                aria-label={`Show ${name} on the poster`}
                checked={shown}
                onChange={(e) => setHidden(key, !e.target.checked)}
              />
              Show on the poster
            </label>
            <MoveButtons name={name} upDisabled={move.index === 0} downDisabled={move.index === move.count - 1} onUp={() => move.onMove(-1)} onDown={() => move.onMove(1)} />
            {sectionAt >= 0 && (
              <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-950/60 hover:text-red-300" aria-label={`Remove ${name}`} onClick={() => remove(sectionAt)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {bannerToggle(key, slot)}
        {shown ? (
          blockFields(key)
        ) : (
          <p className="text-xs text-slate-500">This section is left out of the poster and downloads. Turn it on to include it again.</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Blocks</h3>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-expanded={adding} onClick={() => setAdding((open) => !open)} disabled={spec.sections.length >= 6}>
            <Plus className="h-3 w-3" /> Add section
          </button>
        </div>
        {adding && (
          <div className="flex flex-wrap gap-1.5" role="menu" aria-label="Section types">
            {(Object.keys(SECTION_LABEL) as PosterSection["type"][]).map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  add(t);
                  setAdding(false);
                }}
              >
                {SECTION_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        {spec.sections.length === 0 && <p className="text-xs text-slate-500">No sections yet. Add steps, key points, a callout, or stats.</p>}

        {layout.order.map((item, index) => {
          if (item === "banner") {
            return (
              <div key={`${revision}-banner`} className="space-y-2.5 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Banner</span>
                  <MoveButtons
                    name="Banner"
                    upDisabled={index === 0}
                    downDisabled={index === layout.order.length - 1}
                    onUp={() => onStructureChange(withLayout(moveInOrder(layout, index, -1)))}
                    onDown={() => onStructureChange(withLayout(moveInOrder(layout, index, 1)))}
                  />
                </div>
                {layout.banner.length === 0 && <p className="text-xs text-slate-500">The banner is empty. Turn Banner styling on for a block to fill it.</p>}
                <div className="space-y-2.5">
                  {layout.banner.map((key, slot) =>
                    blockCard(
                      key,
                      {
                        index: slot,
                        count: layout.banner.length,
                        onMove: (dir) => onStructureChange(withLayout(moveInBanner(layout, slot, dir))),
                      },
                      slot,
                    ),
                  )}
                </div>
              </div>
            );
          }
          return blockCard(item, {
            index,
            count: layout.order.length,
            onMove: (dir) => onStructureChange(withLayout(moveInOrder(layout, index, dir))),
          });
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Colors</h3>
          <button type="button" className="text-xs text-blue-400 hover:text-blue-300" onClick={() => onChange({ ...spec, theme: brandTheme })}>Reset to brand</button>
        </div>
        <p className="text-[11px] text-slate-500">Banner background and Banner text color the whole banner. Section titles and step numbers use Banner background too.</p>
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
