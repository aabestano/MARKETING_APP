"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Download, FileDown, ImageIcon, Printer, RefreshCw, Save, Sparkles, Wand2 } from "lucide-react";
import clsx from "clsx";
import { assetInFolder } from "@/lib/assets";
import { resolveBrandTokens } from "@/lib/brand-tokens";
import { downscaleDataUrl, postJson } from "@/lib/client-utils";
import { buildFontFaceCss, fontAssets, fontFamilies, resolveFontStack } from "@/lib/fonts";
import { assetSrc, findLogo, isLogo, isPosterImage, pickIllustration, posterIllustrations } from "@/lib/poster-assets";
import { describeExport, downloadBlob, exportPdf, exportPng, makeThumbnail, openVectorPrint, qrDataUrl } from "@/lib/poster-export";
import { orientationOf, type PosterAssetSummary } from "@/lib/poster-prompt";
import { CUSTOM_PRESET_ID, SIZE_PRESETS, describeSize, isPrintSize, sanitizeSize, sizeFromPreset, swapOrientation, trimPx } from "@/lib/poster-sizes";
import { themeFromTokens } from "@/lib/poster-spec";
import { slugify } from "@/lib/html";
import { DEFAULT_IMAGE_MODEL, type BrandAsset } from "@/lib/types";
import { DEFAULT_FLUX_MODEL } from "@/lib/flux";
import { useStore } from "@/lib/store";
import type { PosterSize, PosterSpec, SizeUnit } from "@/lib/poster-types";
import { EmptyState, Segmented, Spinner, useToast } from "./ui";
import { PosterCanvas } from "./PosterCanvas";
import { PosterEditor } from "./PosterEditor";
import type { ServerStatus } from "./AppShell";

const BLUEPRINTS: { id: string; label: string; hint: string; text: string }[] = [
  {
    id: "flow",
    label: "Step-by-step flowchart",
    hint: "A process with an optional yes/no decision",
    text: `How to refill your maintenance medicines
Three quick steps to get your next refill delivered.

Refill process (flowchart):
1. Upload your prescription - Take a clear photo of your valid prescription
2. Do you have a valid prescription? (Yes: continue to checkout; No: book a teleconsult)
3. Confirm your order - Choose delivery or pick-up
4. Receive your medicines - Delivered to your door

Key points:
- Free delivery on qualified orders
- Pharmacist support is one chat away

Call to action: Order now https://example.com/order (show a QR code)
Footer: Questions? support@example.com
Disclaimer: Terms and conditions apply.
Illustration idea: a friendly pharmacist handing a medicine bag to a smiling customer`,
  },
  {
    id: "campaign",
    label: "Campaign announcement",
    hint: "One message, key benefits, a big call to action",
    text: `Save 20% on your monthly maintenance meds
Members get exclusive prices all month long.

Key points:
- 20% off every maintenance refill
- Free delivery within 48 hours
- Easy auto-refill in two taps

Callout: Offer valid until October 31.
Call to action: Shop the offer https://example.com/offer (show a QR code)
Footer: Questions? support@example.com
Illustration idea: a calendar with a medicine bottle and a savings tag`,
  },
  {
    id: "checklist",
    label: "Checklist / tips",
    hint: "A list of tips with a reminder callout",
    text: `5 habits that keep you on track
Small routines make a big difference.

Key points:
- Refill before you run out
- Take medicines at the same time every day
- Keep a pill organizer within reach
- Store medicines in a cool, dry place
- Ask your pharmacist when in doubt

Callout: Never stop a prescribed medicine without talking to your doctor.
Footer: Brought to you by your care team
Illustration idea: a smiling person with a weekly pill organizer`,
  },
  {
    id: "stats",
    label: "Facts and numbers",
    hint: "Headline statistics with supporting points",
    text: `Why consistency matters
Staying on your maintenance medicines pays off.

Key points:
- 1 in 3 adults needs a refill reminder
- Consistent use helps keep conditions under control
- Easy refills mean fewer missed doses

Callout: Set a reminder for your next refill today.
Call to action: Set a reminder https://example.com/reminders`,
  },
];

const PRINT_DPIS = [150, 300];

function exportErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof Event !== "undefined" && err instanceof Event) return "Export failed: the browser could not render one of the poster's images or fonts.";
  return "Export failed.";
}

type Panel = "brief" | "content";

export function PosterIllustrator({ status, onOpenSettings }: { status: ServerStatus | null; onOpenSettings: () => void }) {
  const poster = useStore((s) => s.poster);
  const updatePoster = useStore((s) => s.updatePoster);
  const resetPoster = useStore((s) => s.resetPoster);
  const savePoster = useStore((s) => s.savePoster);
  const patchSavedPoster = useStore((s) => s.patchSavedPoster);
  const linkDesign = useStore((s) => s.linkDesign);
  const saved = useStore((s) => s.posters);
  const workspace = useStore((s) => s.workspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const books = useStore((s) => s.brandBooks);
  const allAssets = useStore((s) => s.assets);
  const addAsset = useStore((s) => s.addAsset);
  const settings = useStore((s) => s.settings);
  const setTab = useStore((s) => s.setTab);
  const toast = useToast();

  const [panel, setPanel] = useState<Panel>("brief");
  const [busy, setBusy] = useState(false);
  const [illBusy, setIllBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf" | "vector" | "save">(null);
  const [showGuides, setShowGuides] = useState(true);
  const [printDpi, setPrintDpi] = useState(300);
  const [pxScale, setPxScale] = useState(2);
  const [includeBleed, setIncludeBleed] = useState(true);
  const [cropMarks, setCropMarks] = useState(true);
  const [revision, setRevision] = useState(0);
  const [refine, setRefine] = useState("");
  const [illPrompt, setIllPrompt] = useState("");
  const [qrSrc, setQrSrc] = useState<string>();
  const nodeRef = useRef<HTMLDivElement>(null);

  const { spec, size } = poster;
  const book = books.find((b) => b.id === workspace.brandBookId) ?? null;
  const bookAssets = useMemo(() => (book ? allAssets.filter((a) => a.bookId === book.id && assetInFolder(a, "poster")) : []), [allAssets, book]);
  const illustrations = useMemo(() => posterIllustrations(allAssets, book?.id ?? null), [allAssets, book]);
  const families = useMemo(() => fontFamilies(bookAssets), [bookAssets]);
  const fontCss = useMemo(() => buildFontFaceCss(fontAssets(bookAssets)), [bookAssets]);
  const tokens = useMemo(() => resolveBrandTokens({ tokens: book?.tokens, assets: bookAssets }), [book, bookAssets]);
  const brandTheme = useMemo(() => themeFromTokens(tokens), [tokens]);
  const hasKey = !!settings.geminiApiKey || !!status?.gemini;
  const useFlux = settings.imageProvider === "flux";
  const canDraw = useFlux ? !!settings.fluxApiKey || !!status?.flux : hasKey;
  const font = useMemo(() => resolveFontStack(spec?.fontFamily || book?.tokens?.fontFamily, families), [spec?.fontFamily, book?.tokens?.fontFamily, families]);
  const logoSrc = assetSrc(spec ? findLogo(allAssets, book?.id ?? null, spec.header.logoAssetId) : undefined);
  const illustrationSrc = assetSrc(spec?.illustration?.assetId ? allAssets.find((a) => a.id === spec.illustration?.assetId) : undefined);
  const ctaUrl = spec?.cta?.showQr ? spec.cta.url : undefined;

  useEffect(() => {
    let alive = true;
    if (!ctaUrl) {
      setQrSrc(undefined);
      return;
    }
    void qrDataUrl(ctaUrl).then((src) => alive && setQrSrc(src));
    return () => {
      alive = false;
    };
  }, [ctaUrl]);

  const { w: trimW, h: trimH } = trimPx(size);
  const dpi = isPrintSize(size) ? printDpi : 96 * pxScale;
  const info = describeExport(size, dpi, includeBleed);
  const savedRecord = poster.savedId ? saved.find((p) => p.id === poster.savedId) : undefined;

  const setSpec = useCallback((next: PosterSpec, source: "manual" | "gemini" | "fallback" = "manual") => updatePoster({ spec: next, source }), [updatePoster]);
  const setSize = (patch: Partial<PosterSize>) => updatePoster({ size: sanitizeSize({ ...size, presetId: CUSTOM_PRESET_ID, ...patch }) });

  const summaries = useCallback((): PosterAssetSummary[] => {
    return bookAssets
      .filter((a) => (isPosterImage(a) || (a.kind === "cdn-url" && isLogo(a))) && (a.kind !== "image" || !!a.dataUrl))
      .map((a) => ({ id: a.id, name: a.name, kind: a.kind, role: a.role, directive: a.directive }));
  }, [bookAssets]);

  const drawIllustration = useCallback(
    async (subject: string): Promise<BrandAsset | null> => {
      if (!book) {
        toast("Select a brand book first so generated illustrations are saved to its library.", "error");
        return null;
      }
      setIllBusy(true);
      try {
        const data = await postJson<{ dataUrl: string; model: string }>("/api/generate-illustration", {
          prompt: subject,
          brandName: book.name,
          brandTokens: book.tokens,
          aspectRatio: orientationOf(trimW, trimH) === "landscape" ? "1:1" : "4:3",
          provider: useFlux ? "flux" : "gemini",
          model: useFlux ? settings.fluxModel || DEFAULT_FLUX_MODEL : settings.imageModel || DEFAULT_IMAGE_MODEL,
          apiKey: settings.geminiApiKey,
          fluxApiKey: settings.fluxApiKey,
        });
        const dataUrl = await downscaleDataUrl(data.dataUrl, { maxEdge: 1600, quality: 0.88, keepAlpha: true });
        const asset = addAsset({
          bookId: book.id,
          kind: "image",
          name: `AI illustration - ${subject.slice(0, 40)}`,
          mime: dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
          size: Math.round(dataUrl.length * 0.75),
          dataUrl,
          role: "Illustration",
          directive: subject,
          purposes: ["poster"],
        });
        return asset;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Illustration failed.", "error");
        return null;
      } finally {
        setIllBusy(false);
      }
    },
    [book, useFlux, settings.imageModel, settings.fluxModel, settings.fluxApiKey, settings.geminiApiKey, addAsset, toast, trimW, trimH],
  );

  const run = async (revisionText?: string) => {
    if (!revisionText && !poster.prompt.trim()) {
      setError("Describe the poster first, or pick a suggested format.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ spec: PosterSpec; warnings: string[]; source: "gemini" | "fallback" }>("/api/generate-poster", {
        prompt: poster.prompt,
        brandName: book?.name,
        brandTokens: book?.tokens,
        size,
        assets: summaries(),
        fonts: families,
        illustrationMode: poster.illustrationMode,
        revision: revisionText && spec ? { spec, instruction: revisionText } : undefined,
        model: settings.geminiModel,
        apiKey: settings.geminiApiKey,
      });
      let next = data.spec;
      const warnings = [...data.warnings];
      if (!next.illustration?.assetId && poster.illustrationMode !== "none") {
        const hint = next.illustration?.prompt;
        const text = `${hint ?? ""} ${next.headline} ${poster.prompt}`;
        const match = pickIllustration(illustrations, text);
        if (match && (data.source === "fallback" || poster.illustrationMode === "library")) {
          next = { ...next, illustration: { assetId: match.id } };
        } else if (hint && poster.illustrationMode === "auto") {
          if (!canDraw) warnings.push(`No illustration in the library fits and no ${useFlux ? "FLUX (fal.ai)" : "Gemini"} key is set for drawing, so none was drawn. Upload one to Poster Illustration or add a key.`);
          else {
            updatePoster({ spec: next, source: data.source, warnings });
            setPanel("content");
            const asset = await drawIllustration(hint);
            if (asset) next = { ...next, illustration: { assetId: asset.id } };
            else warnings.push("The illustration could not be drawn. Try again from the Content tab.");
          }
        }
      }
      updatePoster({ spec: next, source: data.source, warnings, savedId: revisionText ? poster.savedId : null });
      setRevision((n) => n + 1);
      setRefine("");
      if (!revisionText) setPanel("content");
      toast(revisionText ? "Poster revised." : "Poster generated.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const changeStructure = (next: PosterSpec) => {
    setSpec(next);
    setRevision((n) => n + 1);
  };

  const needNode = () => {
    const node = nodeRef.current;
    if (!node) toast("Nothing to export yet.", "error");
    return node;
  };

  const filename = (ext: string) => `${slugify(spec?.headline ?? "poster").slice(0, 48) || "poster"}-${describeSize(size).replace(/[^a-z0-9]+/gi, "")}.${ext}`;

  const doExport = async (kind: "png" | "pdf" | "vector") => {
    const node = needNode();
    if (!node) return;
    setExporting(kind);
    try {
      if (kind === "vector") {
        const ok = openVectorPrint(node, size, { includeBleed, cropMarks, fontCss, title: spec?.headline ?? "Poster" });
        if (!ok) toast("Pop-up blocked. Allow pop-ups for this site, then try again.", "error");
        else toast("In the print dialog choose Save as PDF, margins None, and turn on Background graphics.", "info");
        return;
      }
      const result =
        kind === "png"
          ? await exportPng(node, size, { dpi, includeBleed, fontCss })
          : await exportPdf(node, size, { dpi, includeBleed, cropMarks, fontCss });
      downloadBlob(result.blob, filename(kind));
      toast(`${kind.toUpperCase()} downloaded (${result.info.width} × ${result.info.height} px${result.info.clamped ? `, reduced to ${result.info.effectiveDpi} DPI to fit browser limits` : ""}).`, "success");
    } catch (err) {
      console.error("Poster export failed", err);
      toast(exportErrorMessage(err), "error");
    } finally {
      setExporting(null);
    }
  };

  const doSave = async () => {
    const node = needNode();
    if (!node || !spec) return;
    setExporting("save");
    try {
      const thumbnail = await makeThumbnail(node, fontCss);
      if (savedRecord) {
        patchSavedPoster(savedRecord.id, { spec, size, prompt: poster.prompt, thumbnail, name: savedRecord.name });
        if (poster.pipelineId && useStore.getState().pipeline.some((i) => i.id === poster.pipelineId)) linkDesign(poster.pipelineId, { posterId: savedRecord.id });
        toast(`Updated “${savedRecord.name}” in the Design Repository.`, "success");
      } else {
        const rec = savePoster({
          name: spec.headline.slice(0, 80) || "Untitled poster",
          brandBookId: book?.id ?? null,
          brandBookName: book?.name ?? "No brand book",
          spec,
          size,
          prompt: poster.prompt,
          thumbnail,
        });
        updatePoster({ savedId: rec.id });
        const linked = !!poster.pipelineId && useStore.getState().pipeline.some((i) => i.id === poster.pipelineId);
        if (linked && poster.pipelineId) linkDesign(poster.pipelineId, { posterId: rec.id });
        toast(linked ? "Saved to the Design Repository and attached to its calendar item." : "Saved to the Design Repository.", "success");
      }
    } finally {
      setExporting(null);
    }
  };

  const onPreset = (id: string) => {
    if (id === CUSTOM_PRESET_ID) updatePoster({ size: { ...size, presetId: CUSTOM_PRESET_ID } });
    else updatePoster({ size: sizeFromPreset(id) });
    if (id !== CUSTOM_PRESET_ID) setIncludeBleed(sizeFromPreset(id).bleedMm > 0);
  };

  const orientation = orientationOf(trimW, trimH);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[40%_60%]">
      <section className="flex min-h-0 flex-col border-b border-slate-800 lg:border-b-0 lg:border-r">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5 md:px-6">
          <Segmented<Panel>
            value={panel}
            onChange={setPanel}
            options={[
              { value: "brief", label: "Brief" },
              { value: "content", label: "Edit content" },
            ]}
          />
          {spec && (
            <button
              className="text-xs text-slate-400 hover:text-slate-100"
              onClick={() => {
                if (window.confirm("Start a new poster? The current one will be cleared (saved posters stay in the repository).")) {
                  resetPoster();
                  setPanel("brief");
                  setRevision((n) => n + 1);
                }
              }}
            >
              New poster
            </button>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          {panel === "brief" || !spec ? (
            <>
              <header>
                <h1 className="text-xl font-semibold text-slate-100">Poster Illustrator</h1>
                <p className="mt-1 text-sm text-slate-400">Describe a poster, or send one from Idea Studio. You get an editable layout in your brand colors and fonts, ready to print or post.</p>
              </header>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="label !mb-0" htmlFor="poster-prompt">Poster brief</label>
                  {poster.prompt && (
                    <button className="text-xs text-slate-500 hover:text-slate-200" onClick={() => updatePoster({ prompt: "" })}>Clear</button>
                  )}
                </div>
                <textarea
                  id="poster-prompt"
                  rows={11}
                  className="input text-[13px] leading-relaxed"
                  placeholder={"Describe it in your own words, e.g.\n\"A portrait poster that explains how to refill a prescription in 4 steps, with a QR code to order\"\n\nOr pick a suggested format below and edit it."}
                  value={poster.prompt}
                  onChange={(e) => updatePoster({ prompt: e.target.value })}
                />
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-slate-500">Suggested formats</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BLUEPRINTS.map((b) => (
                      <button
                        key={b.id}
                        title={b.hint}
                        className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:border-blue-500/60 hover:text-slate-100"
                        onClick={() => updatePoster({ prompt: b.text })}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="poster-brand">Brand book</label>
                <select id="poster-brand" className="input" value={workspace.brandBookId ?? ""} onChange={(e) => updateWorkspace({ brandBookId: e.target.value || null })}>
                  <option value="">No brand book</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {book
                    ? `${illustrations.length} illustration${illustrations.length === 1 ? "" : "s"}, ${families.length} font famil${families.length === 1 ? "y" : "ies"} and ${bookAssets.filter((a) => isLogo(a)).length} logo${bookAssets.filter((a) => isLogo(a)).length === 1 ? "" : "s"} tagged Poster Illustration.`
                    : books.length
                      ? "Select a brand book to use its colors, fonts, logo and illustrations."
                      : "Create a brand book in Library → Brand Books to use your colors, fonts and illustrations."}
                </p>
                {book && illustrations.length === 0 && (
                  <p className="mt-1 text-xs text-amber-300/90">
                    No illustrations are tagged Poster Illustration yet.{" "}
                    <button className="underline hover:text-slate-100" onClick={() => setTab("brands")}>Add some</button> or let AI draw one.
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="poster-ill">Illustration</label>
                <select id="poster-ill" className="input" value={poster.illustrationMode} onChange={(e) => updatePoster({ illustrationMode: e.target.value as typeof poster.illustrationMode })}>
                  <option value="auto">Use my library first, draw one with AI if none fits</option>
                  <option value="library">Only use my library</option>
                  <option value="none">No illustration</option>
                </select>
              </div>

              {!hasKey && (
                <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    No Gemini API key found. The layout will be built offline straight from your brief (best with the suggested format structure){canDraw ? ", and pictures can still be drawn with FLUX" : ", and illustrations come from your library only"}.{" "}
                    <button className="underline hover:text-slate-100" onClick={onOpenSettings}>Add a key</button> for AI-designed layouts.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="card space-y-2 p-3">
                <label className="label !mb-0" htmlFor="poster-refine">Refine with AI</label>
                <div className="flex gap-2">
                  <input
                    id="poster-refine"
                    className="input py-1.5"
                    placeholder="e.g. make the tone friendlier, shorten the steps"
                    value={refine}
                    onChange={(e) => setRefine(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && refine.trim() && !busy && void run(refine.trim())}
                  />
                  <button className="btn-primary px-3 py-1.5" disabled={busy || !refine.trim() || !hasKey} onClick={() => void run(refine.trim())}>
                    {busy ? <Spinner /> : <Wand2 className="h-4 w-4" />}
                  </button>
                </div>
                {!hasKey && <p className="text-[11px] text-slate-500">AI revisions need a Gemini key. You can still edit everything by hand below.</p>}
              </div>

              <IllustrationControls
                spec={spec}
                illustrations={illustrations}
                busy={illBusy}
                hasKey={canDraw}
                providerName={useFlux ? "FLUX" : "Gemini"}
                prompt={illPrompt}
                onPrompt={setIllPrompt}
                onPick={(id) => setSpec({ ...spec, illustration: id ? { assetId: id } : undefined })}
                onDraw={async () => {
                  const subject = illPrompt.trim() || spec.illustration?.prompt || spec.headline;
                  const asset = await drawIllustration(subject);
                  if (asset) setSpec({ ...spec, illustration: { assetId: asset.id } });
                }}
              />

              <div className="card p-3 text-xs text-slate-400">
                <span className="font-medium text-slate-300">Font: </span>
                {font.match === "uploaded"
                  ? `${font.family} (your uploaded font)`
                  : font.match === "closest"
                    ? `${font.family} is not uploaded, so the closest similar look is used. Upload it in Brand Books for an exact match.`
                    : "Default sans-serif. Upload a brand font in Brand Books to use it."}
              </div>

              <PosterEditor spec={spec} revision={revision} onChange={(s) => setSpec(s)} onStructureChange={changeStructure} brandTheme={brandTheme} />
            </>
          )}
        </div>

        {panel === "brief" && (
          <div className="border-t border-slate-800 bg-slate-950 p-4">
            {error && <p role="alert" className="alert-error mb-3">{error}</p>}
            <button className="btn-primary w-full py-2.5" disabled={busy || illBusy || !poster.prompt.trim()} onClick={() => void run()}>
              {busy || illBusy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {illBusy ? "Drawing illustration…" : busy ? "Designing poster…" : spec ? "Regenerate poster" : "Generate poster"}
            </button>
            {spec && <p className="mt-2 text-center text-[11px] text-slate-500">Regenerating replaces your manual edits. Size changes never need a regenerate.</p>}
          </div>
        )}
        {panel === "content" && error && <p role="alert" className="alert-error m-4">{error}</p>}
      </section>

      <section className="flex min-h-[640px] min-w-0 flex-col lg:min-h-0">
        <SizeBar size={size} onPreset={onPreset} onSize={setSize} onSwap={() => updatePoster({ size: swapOrientation(size) })} orientation={orientation} />

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
          <button className="btn-success" disabled={!spec || !!exporting} onClick={() => void doExport("pdf")}>
            {exporting === "pdf" ? <Spinner /> : <FileDown className="h-4 w-4" />} Download PDF
          </button>
          <button className="btn-ghost" disabled={!spec || !!exporting} onClick={() => void doExport("png")}>
            {exporting === "png" ? <Spinner /> : <Download className="h-4 w-4" />} PNG
          </button>
          <button className="btn-ghost" disabled={!spec || !!exporting} onClick={() => void doExport("vector")} title="Opens the print dialog; choose Save as PDF for live text and embedded fonts">
            <Printer className="h-4 w-4" /> Vector PDF
          </button>
          <button className="btn-ghost" disabled={!spec || !!exporting} onClick={() => void doSave()}>
            {exporting === "save" ? <Spinner /> : <Save className="h-4 w-4" />} {savedRecord ? "Update saved" : "Save to repository"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
          {isPrintSize(size) ? (
            <label className="flex items-center gap-1.5">
              Quality
              <select className="input w-auto py-1 text-xs" value={printDpi} onChange={(e) => setPrintDpi(Number(e.target.value))}>
                {PRINT_DPIS.map((d) => (
                  <option key={d} value={d}>{d} DPI{d === 300 ? " (print)" : " (draft)"}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-1.5">
              Resolution
              <select className="input w-auto py-1 text-xs" value={pxScale} onChange={(e) => setPxScale(Number(e.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x (sharper)</option>
              </select>
            </label>
          )}
          {size.bleedMm > 0 && (
            <>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="h-3.5 w-3.5 accent-blue-500" checked={includeBleed} onChange={(e) => setIncludeBleed(e.target.checked)} /> Include {size.bleedMm} mm bleed
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="h-3.5 w-3.5 accent-blue-500" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} /> Crop marks (PDF)
              </label>
            </>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="h-3.5 w-3.5 accent-blue-500" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Trim guides
          </label>
          <span className="ml-auto text-slate-500">
            {info.width} × {info.height} px{info.clamped ? ` (capped at ${info.effectiveDpi} DPI)` : ""} · RGB
          </span>
        </div>

        {spec && poster.warnings.length > 0 && (
          <details className="border-b border-slate-800 bg-slate-900/40 px-4 py-2 text-xs text-slate-400" open>
            <summary className="cursor-pointer select-none text-slate-300">{poster.warnings.length} note{poster.warnings.length > 1 ? "s" : ""}</summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {poster.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {busy && !spec ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-slate-400">
              <Spinner className="h-6 w-6 text-blue-400" /> Laying out your poster…
            </div>
          ) : !spec ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={<ImageIcon className="h-5 w-5" />}
                title="No poster yet"
                body={`Write a brief or pick a suggested format, then generate. The preview below re-flows to ${describeSize(size)} as you change the size.`}
              />
            </div>
          ) : (
            <PreviewStage size={size} showGuides={showGuides}>
              <PosterCanvas ref={nodeRef} spec={spec} size={size} fontStack={font.stack} logoSrc={logoSrc} illustrationSrc={illustrationSrc} illustrationPending={illBusy} qrSrc={qrSrc} />
            </PreviewStage>
          )}
          {spec && (
            <p className="flex items-center gap-1.5 border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
              <RefreshCw className="h-3 w-3" />
              {poster.source === "gemini" ? "Designed by Gemini" : poster.source === "fallback" ? "Offline layout" : "Edited"} · PDFs are RGB; ask your printer to convert to CMYK if required.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewStage({ size, showGuides, children }: { size: PosterSize; showGuides: boolean; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const { w, h } = trimPx(size);
  const bleed = Math.round((size.bleedMm / 25.4) * 96);
  const W = w + 2 * bleed;
  const H = h + 2 * bleed;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min((el.clientWidth - 32) / W, (el.clientHeight - 32) / H, 1);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  return (
    <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-900/60 p-4">
      <div className="relative shrink-0 shadow-2xl ring-1 ring-black/20" style={{ width: W * scale, height: H * scale }}>
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
        {showGuides && bleed > 0 && (
          <div
            className="pointer-events-none absolute border border-dashed border-fuchsia-500"
            style={{ left: bleed * scale, top: bleed * scale, width: w * scale, height: h * scale }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function SizeBar({
  size,
  onPreset,
  onSize,
  onSwap,
  orientation,
}: {
  size: PosterSize;
  onPreset: (id: string) => void;
  onSize: (patch: Partial<PosterSize>) => void;
  onSwap: () => void;
  orientation: string;
}) {
  const [dims, setDims] = useState({ w: String(size.width), h: String(size.height), b: String(size.bleedMm) });
  useEffect(() => setDims({ w: String(size.width), h: String(size.height), b: String(size.bleedMm) }), [size.width, size.height, size.bleedMm]);
  const commit = (key: "w" | "h" | "b") => {
    const n = Number(dims[key]);
    if (!Number.isFinite(n)) return setDims({ w: String(size.width), h: String(size.height), b: String(size.bleedMm) });
    onSize(key === "w" ? { width: n } : key === "h" ? { height: n } : { bleedMm: n });
  };
  const groups = ["Print", "Social"] as const;

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 px-4 py-3">
      <div>
        <label className="label !mb-1" htmlFor="poster-size">Size</label>
        <select id="poster-size" className="input w-auto py-1.5" value={size.presetId} onChange={(e) => onPreset(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {SIZE_PRESETS.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM_PRESET_ID}>Custom size</option>
        </select>
      </div>
      <div className="flex items-end gap-1.5">
        <div>
          <label className="label !mb-1" htmlFor="poster-w">Width</label>
          <input id="poster-w" className="input w-20 py-1.5" inputMode="decimal" value={dims.w} onChange={(e) => setDims((d) => ({ ...d, w: e.target.value }))} onBlur={() => commit("w")} onKeyDown={(e) => e.key === "Enter" && commit("w")} />
        </div>
        <button className="btn-ghost px-2 py-1.5" aria-label="Swap width and height" title={`Switch orientation (now ${orientation})`} onClick={onSwap}>
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <div>
          <label className="label !mb-1" htmlFor="poster-h">Height</label>
          <input id="poster-h" className="input w-20 py-1.5" inputMode="decimal" value={dims.h} onChange={(e) => setDims((d) => ({ ...d, h: e.target.value }))} onBlur={() => commit("h")} onKeyDown={(e) => e.key === "Enter" && commit("h")} />
        </div>
        <div>
          <label className="label !mb-1" htmlFor="poster-unit">Unit</label>
          <select id="poster-unit" className="input w-auto py-1.5" value={size.unit} onChange={(e) => onSize({ unit: e.target.value as SizeUnit })}>
            <option value="mm">mm</option>
            <option value="in">in</option>
            <option value="px">px</option>
          </select>
        </div>
        <div>
          <label className="label !mb-1" htmlFor="poster-bleed">Bleed (mm)</label>
          <input id="poster-bleed" className={clsx("input w-16 py-1.5")} inputMode="decimal" value={dims.b} onChange={(e) => setDims((d) => ({ ...d, b: e.target.value }))} onBlur={() => commit("b")} onKeyDown={(e) => e.key === "Enter" && commit("b")} />
        </div>
      </div>
    </div>
  );
}

function IllustrationControls({
  spec,
  illustrations,
  busy,
  hasKey,
  providerName,
  prompt,
  onPrompt,
  onPick,
  onDraw,
}: {
  spec: PosterSpec;
  illustrations: BrandAsset[];
  busy: boolean;
  hasKey: boolean;
  providerName: string;
  prompt: string;
  onPrompt: (v: string) => void;
  onPick: (id: string | null) => void;
  onDraw: () => void;
}) {
  const current = spec.illustration?.assetId ?? "";
  return (
    <div className="card space-y-2.5 p-3">
      <h3 className="text-sm font-semibold text-slate-200">Illustration</h3>
      <select className="input py-1.5" aria-label="Illustration from library" value={current} onChange={(e) => onPick(e.target.value || null)}>
        <option value="">None</option>
        {current && !illustrations.some((a) => a.id === current) && <option value={current}>Current picture</option>}
        {illustrations.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input className="input py-1.5" aria-label="Describe a picture to draw" placeholder={spec.illustration?.prompt || "Describe a picture to draw with AI"} value={prompt} onChange={(e) => onPrompt(e.target.value)} />
        <button className="btn-ghost shrink-0 px-3 py-1.5" disabled={busy || !hasKey} onClick={onDraw} title={hasKey ? `Draw with ${providerName} and save to the library` : `Needs a ${providerName} API key`}>
          {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} Draw
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        {hasKey ? "Drawn pictures are saved to the brand book as Poster Illustration so you can reuse them." : `Add a ${providerName === "FLUX" ? "fal.ai (FLUX)" : "Gemini"} API key in Settings to draw pictures. Library pictures work without one.`}
      </p>
    </div>
  );
}
