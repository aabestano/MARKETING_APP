"use client";

import { useMemo } from "react";
import { brandSwatches, expandHex } from "@/lib/poster-colors";
import { resolveBrandTokens } from "@/lib/brand-tokens";
import { EMAIL_COLOR_FIELDS, copyColorToBrandTokens, emailContrastWarnings, type EmailColorKey } from "@/lib/email-colors";
import { useStore } from "@/lib/store";
import type { BrandBook, BrandTokens } from "@/lib/types";

const hexOr = (value: string | undefined, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : fallback);

/** Edits the selected brand book's email colors. Copy fills those token fields, not individual email blocks. */
export function EmailColorControls({ book }: { book: BrandBook | null }) {
  const updateBrandTokens = useStore((s) => s.updateBrandTokens);
  const tokens = book?.tokens;
  const resolved = useMemo(() => resolveBrandTokens({ tokens }), [tokens]);
  const swatches = useMemo(() => brandSwatches(resolved), [resolved]);
  const warnings = useMemo(() => (book ? emailContrastWarnings(tokens) : []), [book, tokens]);

  const setField = (key: EmailColorKey, color: string) => {
    if (!book) return;
    updateBrandTokens(book.id, { ...tokens, [key]: expandHex(color) });
  };

  const copyField = (key: EmailColorKey) => {
    if (!book) return;
    const color = hexOr(tokens?.[key], resolved[key]);
    updateBrandTokens(book.id, copyColorToBrandTokens({ ...tokens }, expandHex(color)));
  };

  if (!book) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <h3 className="text-sm font-semibold text-slate-200">Colors</h3>
        <p className="mt-1 text-xs text-slate-500">Choose a brand book to edit its email colors. These colors apply to the whole email.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Colors</h3>
        <p className="mt-1 text-xs text-slate-500">These colors belong to {book.name}. Copy fills the brand token fields, and the email uses them the next time it compiles. Saving is never blocked.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {EMAIL_COLOR_FIELDS.map((field) => {
          const value = hexOr(tokens?.[field.key], resolved[field.key]);
          return (
            <div key={field.key} className="space-y-1.5 rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={field.label}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
                {field.label}
              </label>
              {swatches.length > 0 && (
                <div className="flex flex-wrap gap-1" role="group" aria-label={`${field.label} brand swatches`}>
                  {swatches.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={`${swatch.label} ${swatch.hex}`}
                      aria-label={`${field.label}: ${swatch.label}`}
                      className="h-5 w-5 rounded border border-slate-600"
                      style={{ background: swatch.hex }}
                      onClick={() => setField(field.key, swatch.hex)}
                    />
                  ))}
                </div>
              )}
              <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300" onClick={() => copyField(field.key)}>
                Copy to all token fields
              </button>
            </div>
          );
        })}
      </div>
      {warnings.length > 0 && (
        <ul role="status" className="space-y-1 text-xs text-amber-200">
          {warnings.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
