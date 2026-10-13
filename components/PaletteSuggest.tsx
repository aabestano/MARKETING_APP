"use client";

import { useState } from "react";
import type { BrandAsset, BrandTokens } from "@/lib/types";
import { evidenceLine, type PaletteProposal } from "@/lib/palette";
import { Spinner, useToast } from "./ui";

const ROLE_LABELS: { key: keyof BrandTokens; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "textColor", label: "Text" },
  { key: "mutedColor", label: "Muted text" },
  { key: "borderColor", label: "Border" },
  { key: "canvasBg", label: "Canvas background" },
  { key: "containerBg", label: "Container background" },
];

export function PaletteSuggest({ assets, onApply }: { assets: BrandAsset[]; onApply: (tokens: BrandTokens) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<PaletteProposal | null>(null);

  const suggest = async () => {
    setBusy(true);
    try {
      const { readPalette } = await import("@/lib/palette-read");
      const next = await readPalette(assets);
      setProposal(next);
      if (!next.ready) toast(next.summary, "info");
    } catch {
      toast("The palette could not be read. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const roles = proposal?.ready ? ROLE_LABELS.filter((role) => proposal.tokens[role.key]) : [];

  return (
    <div className="mt-3">
      <button type="button" className="btn-ghost" onClick={() => void suggest()} disabled={busy}>
        {busy ? <Spinner /> : null}
        Suggest palette from assets
      </button>
      {proposal && (
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs text-slate-300">{proposal.summary}</p>
          {roles.length > 0 && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {roles.map((role) => {
                const hex = proposal.tokens[role.key] as string;
                return (
                  <li key={role.key} className="flex items-center gap-2 text-xs text-slate-200">
                    <span className="h-4 w-4 shrink-0 rounded border border-slate-700" style={{ backgroundColor: hex }} />
                    <span>
                      {role.label} <span className="font-mono text-slate-400">{hex}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {proposal.ready && (
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={() => {
                onApply(proposal.tokens);
                toast("Palette applied to this brand book.", "success");
              }}
            >
              Apply palette
            </button>
          )}
          <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-[11px] text-slate-400">
            {proposal.samples.map((sample) => (
              <li key={sample.assetId}>{evidenceLine(sample)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
