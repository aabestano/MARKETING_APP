"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ClipboardCopy, FileText, Image as ImageIcon, Lightbulb, Mail, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import {
  BRAND_CONNECTORS,
  blankCampaign,
  buildEmailBlueprint,
  buildEmailDirectives,
  buildPosterBrief,
  buildPosterPromptText,
  buildStandaloneHtmlPrompt,
  campaignFromIdea,
  tableMatrix,
} from "@/lib/campaign";
import { copyText } from "@/lib/client-utils";
import { fillPosterFromDirective, isBlankDirective } from "@/lib/poster-directive";
import { COHORTS, type BrandMode, type Campaign, type EmailContent, type PosterContent } from "@/lib/idea-types";
import { Segmented, useToast } from "./ui";
import { CardBadge } from "./IdeaInspect";

type Section = "basics" | "email" | "poster";

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input py-1.5" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, rows = 3, hint, id }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; id?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} className="input text-[13px] leading-relaxed" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Group({ title, enabled, onToggle, children }: { title: string; enabled?: boolean; onToggle?: (v: boolean) => void; children?: ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {onToggle && (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={!!enabled} onChange={(e) => onToggle(e.target.checked)} />
            Include
          </label>
        )}
      </div>
      {(onToggle ? enabled : true) && children}
    </section>
  );
}

function MenuButton({ label, icon, items }: { label: string; icon: ReactNode; items: { label: string; hint: string; icon: ReactNode; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon} {label} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-xl">
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-900"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                <span className="mt-0.5 text-slate-400">{it.icon}</span>
                <span>
                  <span className="block text-sm font-medium text-slate-100">{it.label}</span>
                  <span className="block text-xs text-slate-500">{it.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function IdeaStudio() {
  const studio = useStore((s) => s.studio);
  const setStudio = useStore((s) => s.setStudio);
  const updateCampaign = useStore((s) => s.updateCampaign);
  const pipeline = useStore((s) => s.pipeline);
  const updatePipelineItem = useStore((s) => s.updatePipelineItem);
  const ideas = useStore((s) => s.generatedIdeas);
  const workspace = useStore((s) => s.workspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const books = useStore((s) => s.brandBooks);
  const poster = useStore((s) => s.poster);
  const updatePoster = useStore((s) => s.updatePoster);
  const setDesignMode = useStore((s) => s.setDesignMode);
  const setTab = useStore((s) => s.setTab);
  const toast = useToast();
  const [section, setSection] = useState<Section>("basics");

  const c = studio.campaign;
  const linked = studio.pipelineId ? pipeline.find((p) => p.id === studio.pipelineId) : undefined;
  const savedRef = useRef(linked?.campaign);

  useEffect(() => {
    if (!c || !linked) return;
    if (savedRef.current === c) return;
    const t = setTimeout(() => {
      savedRef.current = c;
      updatePipelineItem(linked.id, { campaign: c, ideaData: { ...linked.ideaData, title: c.title.trim() || linked.ideaData.title } });
    }, 700);
    return () => clearTimeout(t);
  }, [c, linked, updatePipelineItem]);

  const set = (patch: Partial<Campaign>) => updateCampaign((x) => ({ ...x, ...patch }));
  const setEmail = (patch: Partial<EmailContent>) => updateCampaign((x) => ({ ...x, email: { ...x.email, ...patch } }));
  const setPoster = (patch: Partial<PosterContent>) => updateCampaign((x) => ({ ...x, poster: { ...x.poster, ...patch } }));

  if (!c) {
    const upcoming = [...pipeline].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 8);
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
          <header>
            <h1 className="text-xl font-semibold text-slate-100">Idea Studio</h1>
            <p className="mt-1 text-sm text-slate-400">Turn an idea into full campaign content: one set of basics, then the email copy and the poster copy. Send either to the Design Studio, or copy a ready-made prompt.</p>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            <button className="card flex flex-col items-start gap-2 p-4 text-left transition hover:border-blue-500/60" onClick={() => setStudio({ campaign: blankCampaign(), pipelineId: null })}>
              <FileText className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-semibold text-slate-100">Start from the template</span>
              <span className="text-xs text-slate-400">The ForwardMG and Best Life campaign, ready to edit.</span>
            </button>
            <div className="card space-y-2 p-4 md:col-span-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><CalendarDays className="h-4 w-4 text-emerald-400" /> From a calendar item</h2>
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing scheduled yet. Schedule an idea from the Idea Generator, or add a campaign on the Calendar.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {upcoming.map((p) => (
                    <li key={p.id}>
                      <button
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-800"
                        onClick={() => setStudio({ campaign: p.campaign ?? campaignFromIdea(p.ideaData), pipelineId: p.id })}
                      >
                        <span className="truncate text-slate-200">{p.ideaData.title}</span>
                        <span className="shrink-0 text-xs text-slate-500">{p.scheduledDate}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="card space-y-2 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Lightbulb className="h-4 w-4 text-amber-400" /> From a generated idea</h2>
            {ideas.length === 0 ? (
              <p className="text-xs text-slate-500">No generated ideas right now. Create some in the Idea Generator.</p>
            ) : (
              <ul className="grid gap-1 md:grid-cols-2">
                {ideas.map((idea, i) => (
                  <li key={i}>
                    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-800" onClick={() => setStudio({ campaign: campaignFromIdea(idea), pipelineId: null })}>
                      <CardBadge type={idea.cardType} />
                      <span className="truncate text-slate-200">{idea.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  const copy = async (text: string, what: string) => toast((await copyText(text)) ? `${what} prompt copied. Paste it into your AI tool.` : "Clipboard unavailable.", "info");

  const sendEmail = () => {
    if (workspace.html && !window.confirm("Replace the email you are working on? Save it to the repository first if you want to keep it.")) return;
    const header = buildEmailDirectives(c);
    const rest = workspace.directives.split("\n").filter((l) => !l.startsWith("Header Layout Directive:")).join("\n").trim();
    const wanted = [c.brand1, c.brand2].map((b) => b.trim().toLowerCase()).filter(Boolean);
    const book = books.find((b) => wanted.includes(b.name.trim().toLowerCase()));
    updateWorkspace({ blueprint: buildEmailBlueprint(c), directives: [header, rest].filter(Boolean).join("\n"), pipelineId: linked?.id ?? null, mjml: "", html: "", warnings: [], source: null, ...(book ? { brandBookId: book.id } : {}) });
    setDesignMode("email");
    setTab("design-studio");
    toast("Sent to the Email Designer. Pick a brand book and press Generate Blast.", "success");
  };

  const sendPoster = () => {
    if (poster.spec && !poster.savedId && !window.confirm("Replace the poster you are working on? Save it to the repository first if you want to keep it.")) return;
    const wanted = [c.brand1, c.brand2].map((b) => b.trim().toLowerCase()).filter(Boolean);
    const book = books.find((b) => wanted.includes(b.name.trim().toLowerCase()));
    updatePoster({ prompt: buildPosterBrief(c), spec: null, source: null, warnings: [], savedId: null, pipelineId: linked?.id ?? null });
    if (book) updateWorkspace({ brandBookId: book.id });
    setDesignMode("poster");
    setTab("design-studio");
    toast("Sent to the Poster Illustrator. Press Generate poster.", "success");
  };

  const e = c.email;
  const p = c.poster;
  const cols = e.tableHeaders.length;
  const rows = e.tableRows.length;
  const rebuildTable = (nc: number, nr: number) => {
    const t = tableMatrix(nc, nr, { headers: e.tableHeaders, rows: e.tableRows });
    setEmail({ tableHeaders: t.headers, tableRows: t.rows });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-100">{c.title || "Untitled campaign"}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              {linked ? (
                <>
                  <CalendarDays className="h-3 w-3" /> Saved to the calendar item on {linked.scheduledDate} automatically
                </>
              ) : (
                "Not linked to a calendar item"
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MenuButton
              label="Copy prompt"
              icon={<ClipboardCopy className="h-4 w-4" />}
              items={[
                { label: "Email Designer prompt", hint: "Full prompt for any AI to write the email HTML", icon: <Mail className="h-4 w-4" />, onSelect: () => void copy(buildStandaloneHtmlPrompt(c), "Email Designer") },
                { label: "Poster Illustrator prompt", hint: "Prompt for any AI design tool", icon: <ImageIcon className="h-4 w-4" />, onSelect: () => void copy(buildPosterPromptText(c), "Poster Illustrator") },
              ]}
            />
            <MenuButton
              label="Send to Design Studio"
              icon={<Send className="h-4 w-4" />}
              items={[
                { label: "Email Designer", hint: "Fills the 11-section blueprint and header directive", icon: <Mail className="h-4 w-4" />, onSelect: sendEmail },
                { label: "Poster Illustrator", hint: "Fills the poster brief", icon: <ImageIcon className="h-4 w-4" />, onSelect: sendPoster },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pb-3 md:px-8">
          <Segmented<Section>
            value={section}
            onChange={setSection}
            options={[
              { value: "basics", label: "Basics" },
              { value: "email", label: "Email content", icon: <Mail className="h-3.5 w-3.5" /> },
              { value: "poster", label: "Poster content", icon: <ImageIcon className="h-3.5 w-3.5" /> },
            ]}
          />
          <div className="flex items-center gap-3 text-xs">
            <button
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100"
              onClick={() => window.confirm("Reset all content to the ForwardMG template? Your edits will be replaced.") && setStudio({ campaign: blankCampaign() })}
            >
              <RotateCcw className="h-3 w-3" /> Reset to template
            </button>
            <button className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100" onClick={() => setStudio({ campaign: null, pipelineId: null })}>
              <X className="h-3 w-3" /> Close
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
        {section === "basics" && (
          <>
            <Group title="Campaign">
              <Text label="Campaign title" value={c.title} onChange={(v) => set({ title: v })} />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Type</label>
                  <select className="input py-1.5" value={c.cardType} onChange={(ev) => set({ cardType: ev.target.value })}>
                    {["Promotional", "Non-Promotional", "Non-promotional (Resource)", "Seasonal"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                    {!["Promotional", "Non-Promotional", "Non-promotional (Resource)", "Seasonal"].includes(c.cardType) && <option>{c.cardType}</option>}
                  </select>
                </div>
                <div>
                  <label className="label">Cohort</label>
                  <select className="input py-1.5" value={c.cohort} onChange={(ev) => set({ cohort: ev.target.value })}>
                    {COHORTS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                    {!(COHORTS as readonly string[]).includes(c.cohort) && <option>{c.cohort}</option>}
                  </select>
                </div>
              </div>
            </Group>
            <Group title="Brand header">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Layout</label>
                  <select className="input py-1.5" value={c.brandMode} onChange={(ev) => set({ brandMode: ev.target.value as BrandMode })}>
                    <option value="single">Single brand</option>
                    <option value="co2">Co-branded (2 logos)</option>
                    <option value="co3">Co-branded (3 logos)</option>
                  </select>
                </div>
                {c.brandMode !== "single" && (
                  <div>
                    <label className="label">Connector text</label>
                    <select className="input py-1.5" value={c.brandConnector} onChange={(ev) => set({ brandConnector: ev.target.value })}>
                      {BRAND_CONNECTORS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className={clsx("grid gap-3", c.brandMode === "co3" ? "md:grid-cols-3" : c.brandMode === "co2" ? "md:grid-cols-2" : "")}>
                <Text label="Brand 1" value={c.brand1} onChange={(v) => set({ brand1: v })} />
                {c.brandMode !== "single" && <Text label="Brand 2" value={c.brand2} onChange={(v) => set({ brand2: v })} />}
                {c.brandMode === "co3" && <Text label="Brand 3" value={c.brand3} onChange={(v) => set({ brand3: v })} />}
              </div>
            </Group>
            <Group title="Call to action (email and poster)">
              <div className="grid gap-3 md:grid-cols-2">
                <Text label="Button label" value={c.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
                <Text label="Link" value={c.ctaUrl} onChange={(v) => set({ ctaUrl: v })} placeholder="https://…" />
              </div>
              <Text label="Support line" value={c.supportLine} onChange={(v) => set({ supportLine: v })} />
            </Group>
          </>
        )}

        {section === "email" && (
          <>
            <Group title="Preheader bar" enabled={e.preheaderEnabled} onToggle={(v) => setEmail({ preheaderEnabled: v })}>
              <Text label="Preheader text" value={e.preheaderText} onChange={(v) => setEmail({ preheaderText: v })} />
            </Group>
            <Group title="Hero and intro">
              <Text label="Hero headline" value={e.heroHeadline} onChange={(v) => setEmail({ heroHeadline: v })} />
              <Text label="Announcement banner" value={e.announcement} onChange={(v) => setEmail({ announcement: v })} />
              <Area label="Intro hook" rows={5} value={e.introBody} onChange={(v) => setEmail({ introBody: v })} hint="Use *|FNAME|* for the member's first name." />
            </Group>
            <Group title="Price comparison table" enabled={e.tableEnabled} onToggle={(v) => setEmail({ tableEnabled: v })}>
              <Text label="Table intro" value={e.tableIntro} onChange={(v) => setEmail({ tableIntro: v })} />
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  Columns
                  <select className="input w-auto py-1 text-xs" value={cols} onChange={(ev) => rebuildTable(Number(ev.target.value), rows)}>
                    {[2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Rows
                  <select className="input w-auto py-1 text-xs" value={rows} onChange={(ev) => rebuildTable(cols, Number(ev.target.value))}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[32rem] space-y-1.5">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {e.tableHeaders.map((h, ci) => (
                      <input key={ci} aria-label={`Header ${ci + 1}`} className="input py-1 text-xs font-semibold" value={h} onChange={(ev) => setEmail({ tableHeaders: e.tableHeaders.map((x, i) => (i === ci ? ev.target.value : x)) })} />
                    ))}
                  </div>
                  {e.tableRows.map((row, ri) => (
                    <div key={ri} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                      {row.map((cell, ci) => (
                        <input
                          key={ci}
                          aria-label={`Row ${ri + 1} column ${ci + 1}`}
                          className="input py-1 text-xs"
                          value={cell}
                          onChange={(ev) => setEmail({ tableRows: e.tableRows.map((r, i) => (i === ri ? r.map((x, j) => (j === ci ? ev.target.value : x)) : r)) })}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={e.disclaimerEnabled} onChange={(ev) => setEmail({ disclaimerEnabled: ev.target.checked })} />
                Include the table disclaimer
              </label>
              {e.disclaimerEnabled && <Area label="Disclaimer" rows={3} value={e.disclaimerText} onChange={(v) => setEmail({ disclaimerText: v })} />}
            </Group>
            <Group title="Benefit cards">
              <Text label="Section header" value={e.cardsHeader} onChange={(v) => setEmail({ cardsHeader: v })} />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Number of cards
                <select
                  className="input w-auto py-1 text-xs"
                  value={e.cards.length}
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    setEmail({ cards: Array.from({ length: n }, (_, i) => e.cards[i] ?? { icon: "⭐", title: "", subtext: "" }) });
                  }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                {e.cards.map((card, i) => (
                  <div key={i} className="space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex gap-2">
                      <input aria-label={`Card ${i + 1} icon`} className="input w-12 px-1 py-1 text-center" value={card.icon} onChange={(ev) => setEmail({ cards: e.cards.map((x, j) => (j === i ? { ...x, icon: ev.target.value } : x)) })} />
                      <input aria-label={`Card ${i + 1} title`} className="input py-1 font-semibold" value={card.title} onChange={(ev) => setEmail({ cards: e.cards.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)) })} />
                    </div>
                    <textarea aria-label={`Card ${i + 1} subtext`} rows={2} className="input text-xs" value={card.subtext} onChange={(ev) => setEmail({ cards: e.cards.map((x, j) => (j === i ? { ...x, subtext: ev.target.value } : x)) })} />
                  </div>
                ))}
              </div>
            </Group>
            <Group title="Did you know box" enabled={e.didYouKnowEnabled} onToggle={(v) => setEmail({ didYouKnowEnabled: v })}>
              <Text label="Title" value={e.didYouKnowTitle} onChange={(v) => setEmail({ didYouKnowTitle: v })} />
              <Area label="Body" rows={2} value={e.didYouKnowBody} onChange={(v) => setEmail({ didYouKnowBody: v })} />
            </Group>
            <Group title="Step-by-step guide">
              <Text label="Guide title" value={e.guideTitle} onChange={(v) => setEmail({ guideTitle: v })} />
              {e.steps.map((st, i) => (
                <div key={i} className="space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
                    <input aria-label={`Step ${i + 1} title`} className="input py-1 font-semibold" value={st.title} onChange={(ev) => setEmail({ steps: e.steps.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)) })} />
                    <button className="rounded p-1 text-slate-500 hover:bg-red-950/60 hover:text-red-300 disabled:opacity-30" aria-label={`Remove step ${i + 1}`} disabled={e.steps.length <= 1} onClick={() => setEmail({ steps: e.steps.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea aria-label={`Step ${i + 1} details`} rows={3} className="input text-xs" value={st.details} onChange={(ev) => setEmail({ steps: e.steps.map((x, j) => (j === i ? { ...x, details: ev.target.value } : x)) })} />
                </div>
              ))}
              <button className="btn-ghost py-1.5 text-xs" disabled={e.steps.length >= 6} onClick={() => setEmail({ steps: [...e.steps, { title: "", details: "" }] })}>
                <Plus className="h-3.5 w-3.5" /> Add step
              </button>
            </Group>
            <Group title="Promo tip box" enabled={e.promoTipEnabled} onToggle={(v) => setEmail({ promoTipEnabled: v })}>
              <Text label="Header" value={e.promoTipHeader} onChange={(v) => setEmail({ promoTipHeader: v })} />
              <Area label="Body" rows={3} value={e.promoTipBody} onChange={(v) => setEmail({ promoTipBody: v })} />
            </Group>
            <Group title="Calls to action">
              <Text label="Microcopy under the main button" value={e.ctaMicrocopy} onChange={(v) => setEmail({ ctaMicrocopy: v })} />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={e.secondaryCtaEnabled} onChange={(ev) => setEmail({ secondaryCtaEnabled: ev.target.checked })} />
                Include a secondary call-out (e.g. teleconsult)
              </label>
              {e.secondaryCtaEnabled && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2"><Text label="Callout text" value={e.secondaryTitle} onChange={(v) => setEmail({ secondaryTitle: v })} /></div>
                  <Text label="Button label" value={e.secondaryLabel} onChange={(v) => setEmail({ secondaryLabel: v })} />
                  <Text label="Link" value={e.secondaryUrl} onChange={(v) => setEmail({ secondaryUrl: v })} />
                </div>
              )}
            </Group>
            <Group title="Terms and footer">
              <Area label="Terms and conditions" rows={4} value={e.terms} onChange={(v) => setEmail({ terms: v })} />
              <Area label="Footer" rows={2} value={e.footerText} onChange={(v) => setEmail({ footerText: v })} />
            </Group>
          </>
        )}

        {section === "poster" && (
          <>
            <Group title="Custom directive">
              <Area
                id="poster-custom-directive"
                label="Custom directive"
                rows={4}
                value={p.customDirective ?? "N/A"}
                onChange={(v) => setPoster({ customDirective: v })}
                hint="Tell the AI what you want to see in the poster, such as the headline focus, key points, or tone. Select the button to fill the poster sections from your request. Leave as N/A to use the idea's default content."
              />
              <button
                type="button"
                className="btn-primary"
                disabled={isBlankDirective(p.customDirective)}
                onClick={() => {
                  setPoster(fillPosterFromDirective(p, p.customDirective ?? ""));
                  toast("Poster sections filled from your request.", "success");
                }}
              >
                Fill poster sections
              </button>
            </Group>
            <Group title="Headline">
              <Text label="Headline" value={p.headline} onChange={(v) => setPoster({ headline: v })} />
              <Text label="Subheading" value={p.subheading} onChange={(v) => setPoster({ subheading: v })} />
            </Group>
            <Group title="Steps and flowchart">
              <Text label="Steps title" value={p.stepsTitle} onChange={(v) => setPoster({ stepsTitle: v })} />
              <Area
                label="Steps"
                rows={7}
                value={p.stepsText}
                onChange={(v) => setPoster({ stepsText: v })}
                hint="One step per line. Add detail with “Label :: detail”. A yes or no decision is “Label ?? yes outcome || no outcome”."
              />
            </Group>
            <Group title="Key points and callout">
              <Area label="Key points" rows={5} value={p.pointsText} onChange={(v) => setPoster({ pointsText: v })} hint="One point per line." />
              <Area label="Callout" rows={3} value={p.callout} onChange={(v) => setPoster({ callout: v })} />
            </Group>
            <Group title="Call to action and footer">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={p.showQr} onChange={(ev) => setPoster({ showQr: ev.target.checked })} />
                Show a QR code for the link ({c.ctaUrl || "set the link in Basics"})
              </label>
              <Area label="Footer" rows={2} value={p.footer} onChange={(v) => setPoster({ footer: v })} />
              <Area label="Disclaimer" rows={3} value={p.disclaimer} onChange={(v) => setPoster({ disclaimer: v })} />
            </Group>
            <Group title="Illustration">
              <Area label="What should the picture show?" rows={2} value={p.illustrationHint} onChange={(v) => setPoster({ illustrationHint: v })} hint="Your Poster Illustration library is searched first; AI draws one only if nothing fits." />
            </Group>
          </>
        )}

        <EmptyHint />
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="pb-6 text-center text-xs text-slate-500">
      Changes save as you type. Use <span className="text-slate-300">Send to Design Studio</span> when the content is ready.
    </p>
  );
}

