"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { CATEGORY_STYLES, useStore } from "@/lib/store";
import { BLAST_CATEGORIES, type BlastCategory, type SavedBlast } from "@/lib/types";
import type { SavedPoster } from "@/lib/poster-types";
import { describeSize } from "@/lib/poster-sizes";
import { openSavedBlast, openSavedPoster } from "@/lib/design-nav";
import { downloadFile, openHtmlInNewTab, timeAgo } from "@/lib/client-utils";
import { slugify } from "@/lib/html";
import { EmailPreview } from "./EmailPreview";
import { EmptyState, Modal, useToast } from "./ui";

type Filter = "All" | BlastCategory;
type Kind = "all" | "email" | "poster";

export function DesignRepository() {
  const blasts = useStore((s) => s.blasts);
  const posters = useStore((s) => s.posters);
  const deleteBlast = useStore((s) => s.deleteBlast);
  const deletePoster = useStore((s) => s.deletePoster);
  const setTab = useStore((s) => s.setTab);
  const setDesignMode = useStore((s) => s.setDesignMode);
  const [kind, setKind] = useState<Kind>("all");
  const [filter, setFilter] = useState<Filter>("All");
  const [openId, setOpenId] = useState<string | null>(null);

  const showEmails = kind !== "poster";
  const showPosters = kind !== "email" && filter === "All";
  const filtered = useMemo(() => (filter === "All" ? blasts : blasts.filter((b) => b.category === filter)), [blasts, filter]);
  const opened = blasts.find((b) => b.id === openId) ?? null;
  const counts = (c: Filter) => (c === "All" ? blasts.length : blasts.filter((b) => b.category === c).length);
  const total = blasts.length + posters.length;
  const visibleCount = (showEmails ? filtered.length : 0) + (showPosters ? posters.length : 0);

  const kinds: { id: Kind; label: string; count: number }[] = [
    { id: "all", label: "All designs", count: total },
    { id: "email", label: "Emails", count: blasts.length },
    { id: "poster", label: "Posters", count: posters.length },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-100">Design Repository</h1>
          <p className="mt-1 text-sm text-slate-400">Everything you saved from the Design Studio. Open a poster to keep editing, or inspect an email to tweak its HTML.</p>
        </header>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="inline-flex rounded-md border border-slate-800 bg-slate-900 p-0.5" role="tablist" aria-label="Design type">
            {kinds.map((k) => (
              <button
                key={k.id}
                role="tab"
                aria-selected={kind === k.id}
                onClick={() => setKind(k.id)}
                className={clsx("rounded px-3 py-1.5 text-xs font-medium", kind === k.id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200")}
              >
                {k.label} <span className="ml-1 text-slate-500">{k.count}</span>
              </button>
            ))}
          </div>
          {showEmails && blasts.length > 0 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter emails by category">
              {(["All", ...BLAST_CATEGORIES] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    "rounded-full border px-3 py-1 text-xs transition",
                    filter === f ? "border-blue-500/60 bg-blue-500/15 text-slate-100" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200",
                  )}
                >
                  {f === "All" ? "All emails" : f} <span className="ml-1 text-slate-500">{counts(f)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {total === 0 ? (
          <EmptyState
            icon={<Archive className="h-5 w-5" />}
            title="No saved designs yet"
            body="Design an email or a poster in the Design Studio and press Save to keep it here."
            action={
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => { setDesignMode("email"); setTab("design-studio"); }}>Email Designer</button>
                <button className="btn-ghost" onClick={() => { setDesignMode("poster"); setTab("design-studio"); }}>Poster Illustrator</button>
              </div>
            }
          />
        ) : visibleCount === 0 ? (
          <EmptyState icon={<Archive className="h-5 w-5" />} title="Nothing here" body="No saved designs match this filter." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {showPosters &&
              posters.map((p) => (
                <PosterCard
                  key={p.id}
                  poster={p}
                  onOpen={() => openSavedPoster(p)}
                  onDelete={() => {
                    if (window.confirm(`Delete “${p.name}”?`)) deletePoster(p.id);
                  }}
                />
              ))}
            {showEmails &&
              filtered.map((b) => (
                <BlastCard
                  key={b.id}
                  blast={b}
                  onOpen={() => setOpenId(b.id)}
                  onDelete={() => {
                    if (window.confirm(`Delete “${b.name}”?`)) deleteBlast(b.id);
                  }}
                />
              ))}
          </div>
        )}
      </div>
      {opened && <InspectorModal blast={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PosterCard({ poster, onOpen, onDelete }: { poster: SavedPoster; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:border-slate-700">
      <button onClick={onOpen} className="relative flex h-48 items-center justify-center overflow-hidden border-b border-slate-800 bg-[#e2e8f0] text-left" aria-label={`Open ${poster.name}`}>
        {poster.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster.thumbnail} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-slate-400" />
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{poster.name}</h3>
          <span className="shrink-0 rounded border border-fuchsia-500/50 bg-fuchsia-500/10 px-1.5 py-px text-[10px] font-medium text-fuchsia-300">Poster</span>
        </div>
        <p className="text-xs text-slate-400">{describeSize(poster.size)}</p>
        <p className="text-xs text-slate-500">
          {poster.brandBookName} · updated {timeAgo(poster.updatedAt)}
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={onOpen}>
            <Pencil className="h-3.5 w-3.5" /> Open in Design Studio
          </button>
          <button className="btn-danger px-2.5 py-1.5" aria-label={`Delete ${poster.name}`} onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function BlastCard({ blast, onOpen, onDelete }: { blast: SavedBlast; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:border-slate-700">
      <button onClick={onOpen} className="relative block h-48 overflow-hidden border-b border-slate-800 bg-[#e2e8f0] text-left" aria-label={`Open ${blast.name}`}>
        <iframe
          title={`${blast.name} thumbnail`}
          srcDoc={blast.html}
          sandbox=""
          tabIndex={-1}
          className="pointer-events-none absolute left-1/2 top-0 h-[800px] w-[640px] origin-top -translate-x-1/2 scale-[0.5] bg-white"
          loading="lazy"
        />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{blast.name}</h3>
          <span className={clsx("shrink-0 rounded border px-1.5 py-px text-[10px] font-medium", CATEGORY_STYLES[blast.category])}>{blast.category}</span>
        </div>
        {blast.subject && <p className="line-clamp-1 text-xs text-slate-400">Subject: {blast.subject}</p>}
        <p className="text-xs text-slate-500">
          {blast.brandBookName} · updated {timeAgo(blast.updatedAt)}
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={onOpen}>
            <Pencil className="h-3.5 w-3.5" /> Inspect
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-xs" title="Open in Email Designer" aria-label={`Open ${blast.name} in Email Designer`} onClick={() => openSavedBlast(blast)}>
            <Mail className="h-3.5 w-3.5" />
          </button>
          <button className="btn-danger px-2.5 py-1.5" aria-label={`Delete ${blast.name}`} onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function InspectorModal({ blast, onClose }: { blast: SavedBlast; onClose: () => void }) {
  const updateBlast = useStore((s) => s.updateBlast);
  const toast = useToast();
  const [tab, setTab] = useState<"editor" | "render">("editor");
  const [draft, setDraft] = useState(blast.html);
  const [name, setName] = useState(blast.name);
  const [category, setCategory] = useState<BlastCategory>(blast.category);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewHtml, setPreviewHtml] = useState(blast.html);
  const dirty = draft !== blast.html || name !== blast.name || category !== blast.category;

  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(draft), 400);
    return () => clearTimeout(t);
  }, [draft]);

  const base = slugify(name);

  return (
    <Modal
      size="xl"
      title={name || "Untitled blast"}
      description={`${blast.brandBookName} · saved ${new Date(blast.createdAt).toLocaleString()}`}
      onClose={onClose}
      footer={
        tab === "editor" ? (
          <>
            <button className="btn-ghost" onClick={() => { downloadFile(`${base}.txt`, draft, "text/plain"); }}>
              <FileText className="h-4 w-4" /> Save as .TXT
            </button>
            <button className="btn-ghost" onClick={() => { downloadFile(`${base}.html`, draft, "text/html"); }}>
              <Download className="h-4 w-4" /> Download .HTML
            </button>
            <button
              className="btn-success"
              disabled={!dirty}
              onClick={() => {
                updateBlast(blast.id, { html: draft, name: name.trim() || blast.name, category });
                toast("Saved blast updated.", "success");
              }}
            >
              <Save className="h-4 w-4" /> Update Saved Blast
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={() => iframeRef.current?.contentWindow?.print()}>
              <Printer className="h-4 w-4" /> Print
            </button>
            <button className="btn-primary" onClick={() => !openHtmlInNewTab(draft) && toast("Pop-up blocked. Allow pop-ups to render in a new tab.", "error")}>
              <ExternalLink className="h-4 w-4" /> Render in a new tab
            </button>
          </>
        )
      }
    >
      <div className="flex h-[68vh] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-slate-800 bg-slate-900 p-0.5">
            {([
              ["editor", "Live HTML Editor", Pencil],
              ["render", "Visual Render", Mail],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium", tab === id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200")}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {tab === "editor" && (
            <>
              <input aria-label="Blast name" className="input max-w-xs py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
              <select aria-label="Category" className="input w-auto py-1.5" value={category} onChange={(e) => setCategory(e.target.value as BlastCategory)}>
                {BLAST_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {draft !== blast.html && (
                <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100" onClick={() => setDraft(blast.html)}>
                  <RefreshCw className="h-3 w-3" /> Revert edits
                </button>
              )}
            </>
          )}
        </div>
        {tab === "editor" ? (
          <textarea
            aria-label="HTML editor"
            spellCheck={false}
            className="input min-h-0 flex-1 resize-none font-mono text-[12.5px] leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <EmailPreview ref={iframeRef} html={previewHtml} title={`${name} render`} className="flex-1" />
        )}
      </div>
    </Modal>
  );
}
