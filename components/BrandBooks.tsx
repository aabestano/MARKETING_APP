"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  BookOpen,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import type { AssetKind, AssetPurpose, BrandAsset, BrandBook, BrandTokens } from "@/lib/types";
import { parseFontFileName } from "@/lib/fonts";
import { assetInFolder, assetPurposes, type AssetFolder } from "@/lib/assets";
import { FolderTabs, PurposePicker } from "./PurposePicker";
import { assetFile, assetPreviewKind, downloadAssetFile } from "@/lib/asset-file";
import { DEFAULT_TOKENS, isHex, isMaxicareBl, MAXICARE_BL_TOKENS } from "@/lib/brand-tokens";
import { PaletteSuggest } from "./PaletteSuggest";
import { downscaleImage, formatBytes, readAsDataUrl, readAsText, timeAgo } from "@/lib/client-utils";
import { AssetViewer } from "./AssetViewer";
import { EmptyState, Spinner, useToast } from "./ui";

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_BYTES = 400 * 1024;
const MAX_SVG_BYTES = 1.5 * 1024 * 1024;
const MAX_FONT_BYTES = 4 * 1024 * 1024;
const NEW_BOOK = "__new__";
const ROLES = ["Logo", "Hero Banner", "Icon", "Product Image", "Social Icon", "Divider", "Other"];

const KIND_META: Record<AssetKind, { label: string; icon: typeof FileText; tone: string }> = {
  pdf: { label: "PDF guide", icon: FileText, tone: "text-red-300 bg-red-500/10 border-red-500/30" },
  image: { label: "Screenshot", icon: ImageIcon, tone: "text-blue-300 bg-blue-500/10 border-blue-500/30" },
  template: { label: "Template code", icon: FileCode2, tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  "cdn-url": { label: "CDN URL", icon: Link2, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  font: { label: "Font", icon: Type, tone: "text-purple-300 bg-purple-500/10 border-purple-500/30" },
};

export function BrandBooks() {
  const books = useStore((s) => s.brandBooks);
  const assets = useStore((s) => s.assets);
  const createBrandBook = useStore((s) => s.createBrandBook);
  const deleteBrandBook = useStore((s) => s.deleteBrandBook);
  const addAsset = useStore((s) => s.addAsset);
  const deleteAsset = useStore((s) => s.deleteAsset);
  const updateAsset = useStore((s) => s.updateAsset);
  const toast = useToast();

  const [targetBook, setTargetBook] = useState<string>(books[0]?.id ?? NEW_BOOK);
  const [newBookName, setNewBookName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileDirective, setFileDirective] = useState("");
  const [uploadPurposes, setUploadPurposes] = useState<AssetPurpose[]>(["email"]);
  const [cdnPurposes, setCdnPurposes] = useState<AssetPurpose[]>(["email"]);
  const [folder, setFolder] = useState<AssetFolder>("all");
  const [viewing, setViewing] = useState<BrandAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cdnUrl, setCdnUrl] = useState("");
  const [cdnLabel, setCdnLabel] = useState("");
  const [cdnRole, setCdnRole] = useState(ROLES[0]);
  const [cdnDirective, setCdnDirective] = useState("");

  const folderCounts = useMemo<Record<AssetFolder, number>>(
    () => ({
      email: assets.filter((a) => assetInFolder(a, "email")).length,
      poster: assets.filter((a) => assetInFolder(a, "poster")).length,
      all: assets.length,
    }),
    [assets],
  );

  const effectiveTarget =
    targetBook === NEW_BOOK || books.some((b) => b.id === targetBook) ? targetBook : books[0]?.id ?? NEW_BOOK;

  const resolveBookId = (): string | null => {
    if (effectiveTarget !== NEW_BOOK) return effectiveTarget;
    if (!newBookName.trim()) {
      toast("Name your brand book first (e.g. “Maxicare BL”).", "error");
      return null;
    }
    const book = createBrandBook(newBookName);
    setTargetBook(book.id);
    setNewBookName("");
    return book.id;
  };

  const ingestFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const bookId = resolveBookId();
    if (!bookId) return;
    setBusy(true);
    let added = 0;
    for (const file of list) {
      const lower = file.name.toLowerCase();
      try {
        if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
          if (file.size > MAX_PDF_BYTES) {
            toast(`${file.name} is over ${formatBytes(MAX_PDF_BYTES)}. Trim or split the PDF.`, "error");
            continue;
          }
          addAsset({ bookId, kind: "pdf", name: file.name, mime: "application/pdf", size: file.size, dataUrl: await readAsDataUrl(file), directive: fileDirective.trim() || undefined, purposes: uploadPurposes });
        } else if (/^image\/(png|jpe?g)$/.test(file.type) || /\.(png|jpe?g)$/.test(lower)) {
          const dataUrl = await downscaleImage(file, uploadPurposes.includes("poster") ? { maxEdge: 2400, quality: 0.86, keepAlpha: true } : {});
          addAsset({ bookId, kind: "image", name: file.name, mime: dataUrl.slice(5, dataUrl.indexOf(";")), size: Math.round(dataUrl.length * 0.75), dataUrl, directive: fileDirective.trim() || undefined, purposes: uploadPurposes });
        } else if (/\.svg$/.test(lower) || file.type === "image/svg+xml") {
          if (file.size > MAX_SVG_BYTES) {
            toast(`${file.name} is over ${formatBytes(MAX_SVG_BYTES)}. Simplify or export a lighter SVG.`, "error");
            continue;
          }
          addAsset({ bookId, kind: "image", name: file.name, mime: "image/svg+xml", size: file.size, dataUrl: await readAsDataUrl(file), directive: fileDirective.trim() || undefined, purposes: uploadPurposes.includes("poster") ? uploadPurposes : [...uploadPurposes, "poster"] });
          toast("SVG artwork is used by posters only, so it was tagged Poster Illustration too.", "info");
        } else if (/\.(ttf|otf|woff2?)$/.test(lower)) {
          if (file.size > MAX_FONT_BYTES) {
            toast(`${file.name} is over ${formatBytes(MAX_FONT_BYTES)}.`, "error");
            continue;
          }
          const parsed = parseFontFileName(file.name);
          addAsset({
            bookId,
            kind: "font",
            name: file.name,
            mime: file.type || "font/ttf",
            size: file.size,
            dataUrl: await readAsDataUrl(file),
            fontFamily: parsed.family,
            fontWeight: parsed.weight,
            fontStyle: parsed.style,
            directive: fileDirective.trim() || undefined,
            purposes: uploadPurposes.includes("poster") ? uploadPurposes : [...uploadPurposes, "poster"],
          });
        } else if (/\.(txt|html?|mjml|md)$/.test(lower) || file.type.startsWith("text/")) {
          if (file.size > MAX_TEXT_BYTES) {
            toast(`${file.name} is over ${formatBytes(MAX_TEXT_BYTES)}.`, "error");
            continue;
          }
          addAsset({ bookId, kind: "template", name: file.name, mime: file.type || "text/plain", size: file.size, text: await readAsText(file), directive: fileDirective.trim() || undefined, purposes: uploadPurposes });
        } else {
          toast(`${file.name}: unsupported type. Use a PDF, a PNG, JPG, or SVG image, a TTF, OTF, or WOFF font, or a TXT or HTML file.`, "error");
          continue;
        }
        added++;
      } catch (err) {
        toast(`${file.name}: ${err instanceof Error ? err.message : "failed to read"}`, "error");
      }
    }
    setBusy(false);
    if (added) {
      toast(`Added ${added} asset${added > 1 ? "s" : ""}.`, "success");
      setFileDirective("");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void ingestFiles(e.dataTransfer.files);
  };

  const saveCdn = () => {
    let url = cdnUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast("Enter a full CDN URL starting with https://", "error");
      return;
    }
    try {
      url = new URL(url).toString();
    } catch {
      toast("That URL doesn't look valid.", "error");
      return;
    }
    const bookId = resolveBookId();
    if (!bookId) return;
    addAsset({
      bookId,
      kind: "cdn-url",
      name: cdnLabel.trim() || `${cdnRole} — ${new URL(url).pathname.split("/").pop() || "asset"}`,
      url,
      role: cdnRole,
      directive: cdnDirective.trim() || undefined,
      purposes: cdnPurposes,
    });
    setCdnUrl("");
    setCdnLabel("");
    setCdnDirective("");
    toast("CDN asset saved.", "success");
  };

  const removeBook = (id: string, name: string, count: number) => {
    if (window.confirm(`Delete “${name}” and its ${count} asset${count === 1 ? "" : "s"}? This can't be undone.`)) {
      deleteBrandBook(id);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-100">Brand Books and Asset Manager</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload brand guides, past blasts, and template code, and save hosted CDN image URLs with usage directives. Selected brand books
            are injected into every blast prompt.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <UploadCloud className="h-4 w-4 text-blue-400" /> Upload panel
            </h2>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="target-book">Brand book</label>
                <select id="target-book" className="input" value={effectiveTarget} onChange={(e) => setTargetBook(e.target.value)}>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                  <option value={NEW_BOOK}>+ New brand book…</option>
                </select>
              </div>
              {effectiveTarget === NEW_BOOK && (
                <div>
                  <label className="label" htmlFor="new-book">New book name</label>
                  <input id="new-book" className="input" placeholder="Maxicare BL" value={newBookName} onChange={(e) => setNewBookName(e.target.value)} />
                </div>
              )}
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
                dragging ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-950 hover:border-slate-600",
              )}
            >
              {busy ? <Spinner className="mb-2 text-blue-400" /> : <UploadCloud className="mb-2 h-7 w-7 text-slate-500" />}
              <p className="text-sm font-medium text-slate-200">Drop files here or click to browse</p>
              <p className="mt-1 text-xs text-slate-500">PDF guides, PNG, JPG, or SVG images, TTF, OTF, or WOFF fonts, and TXT or HTML template code</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.svg,.ttf,.otf,.woff,.woff2,.txt,.html,.htm,.mjml,.md,application/pdf,image/png,image/jpeg,image/svg+xml,text/*"
                onChange={(e) => {
                  if (e.target.files) void ingestFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mt-3">
              <PurposePicker idPrefix="upload-purpose" value={uploadPurposes} onChange={setUploadPurposes} />
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="file-directive">Directive for these files (optional)</label>
              <input id="file-directive" className="input" placeholder="e.g. Follow this layout for promo blasts; ignore the legacy footer" value={fileDirective} onChange={(e) => setFileDirective(e.target.value)} />
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Link2 className="h-4 w-4 text-emerald-400" /> Asset URL preset
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="cdn-url">CDN image URL</label>
                <input id="cdn-url" className="input font-mono" placeholder="https://mcusercontent.com/…/images/logo.png" value={cdnUrl} onChange={(e) => setCdnUrl(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="cdn-label">Label</label>
                  <input id="cdn-label" className="input" placeholder="Primary logo" value={cdnLabel} onChange={(e) => setCdnLabel(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="cdn-role">Asset type</label>
                  <select id="cdn-role" className="input" value={cdnRole} onChange={(e) => setCdnRole(e.target.value)}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="cdn-directive">Usage directive</label>
                <textarea id="cdn-directive" rows={2} className="input resize-none" placeholder="Always place in the header, centered, max 160px wide." value={cdnDirective} onChange={(e) => setCdnDirective(e.target.value)} />
              </div>
              <PurposePicker idPrefix="cdn-purpose" value={cdnPurposes} onChange={setCdnPurposes} />
              <button className="btn-success w-full" onClick={saveCdn}>
                <Plus className="h-4 w-4" /> Save CDN asset
              </button>
            </div>
          </section>
        </div>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Brand books ({books.length})</h2>
            <FolderTabs value={folder} onChange={setFolder} counts={folderCounts} />
          </div>
          {books.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="No brand books yet"
              body="Name a brand book above, then upload guides or save CDN URLs. Try “Maxicare BL” or “MedGrocer”."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {books.map((book) => {
                const allBookAssets = assets.filter((a) => a.bookId === book.id);
                const bookAssets = allBookAssets.filter((a) => assetInFolder(a, folder));
                return (
                  <article key={book.id} className="card overflow-hidden">
                    <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-100">{book.name}</h3>
                          <p className="text-xs text-slate-500">
                            {folder === "all" ? `${allBookAssets.length}` : `${bookAssets.length} of ${allBookAssets.length}`} asset{allBookAssets.length === 1 ? "" : "s"} · created {timeAgo(book.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button className="btn-danger px-2 py-1.5" aria-label={`Delete ${book.name}`} onClick={() => removeBook(book.id, book.name, allBookAssets.length)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </header>
                    <TokenEditor book={book} assets={allBookAssets} />
                    {bookAssets.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">
                        {allBookAssets.length === 0
                          ? "No assets yet — upload files or save a CDN URL."
                          : `No ${folder === "poster" ? "Poster Illustration" : "Email Design"} assets in this brand book.`}
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-800">
                        {bookAssets.map((a) => (
                          <AssetRow
                            key={a.id}
                            asset={a}
                            onDelete={() => deleteAsset(a.id)}
                            onDirective={(d) => updateAsset(a.id, { directive: d })}
                            onPurposes={(p) => updateAsset(a.id, { purposes: p })}
                            onFamily={(f) => updateAsset(a.id, { fontFamily: f })}
                            onView={() => setViewing(a)}
                          />
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {viewing && <AssetViewer asset={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AssetRow({
  asset,
  onDelete,
  onDirective,
  onPurposes,
  onFamily,
  onView,
}: {
  asset: BrandAsset;
  onDelete: () => void;
  onDirective: (d: string) => void;
  onPurposes: (p: AssetPurpose[]) => void;
  onFamily: (family: string) => void;
  onView: () => void;
}) {
  const meta = KIND_META[asset.kind];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.directive ?? "");
  const preview = assetPreviewKind(asset);
  const file = assetFile(asset);
  const thumb = asset.kind === "image" ? asset.dataUrl : preview === "image" ? asset.url : undefined;

  return (
    <li className="flex gap-3 px-4 py-3">
      {preview ? (
        <button type="button" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950" aria-label={`View ${asset.name}`} onClick={onView}>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <Icon className="h-5 w-5 text-slate-500" />
          )}
        </button>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950">
          <Icon className="h-5 w-5 text-slate-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{asset.name}</span>
          <span className={clsx("rounded border px-1.5 py-px text-[10px] font-medium", meta.tone)}>{asset.role ?? meta.label}</span>
          {asset.size ? <span className="text-[11px] text-slate-500">{formatBytes(asset.size)}</span> : null}
          {asset.kind === "font" && (
            <span className="text-[11px] text-slate-400" style={{ fontFamily: `'${asset.fontFamily}'` }}>
              {asset.fontFamily} · {asset.fontWeight ?? 400}
              {asset.fontStyle === "italic" ? " italic" : ""}
            </span>
          )}
        </div>
        {asset.url && <p className="truncate font-mono text-[11px] text-slate-500">{asset.url}</p>}
        {asset.kind === "font" && (
          <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
            Family name
            <input
              className="input w-44 py-0.5 text-xs"
              defaultValue={asset.fontFamily}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== asset.fontFamily && onFamily(e.target.value.trim())}
              aria-label={`Font family name for ${asset.name}`}
            />
            <span className="text-slate-400">Poster fonts are matched by this name.</span>
          </label>
        )}
        <div className="mt-1">
          <PurposePicker compact idPrefix={`purpose-${asset.id}`} value={assetPurposes(asset)} onChange={onPurposes} />
        </div>
        {editing ? (
          <div className="mt-1.5 flex gap-2">
            <input autoFocus className="input py-1 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Usage directive" />
            <button className="btn-primary px-2 py-1 text-xs" onClick={() => { onDirective(draft.trim()); setEditing(false); }}>Save</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="mt-0.5 text-left text-xs text-slate-400 hover:text-slate-200">
            {asset.directive ? <>“{asset.directive}”</> : <span className="text-slate-400">+ add usage directive</span>}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {preview && (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onView}>
            View
          </button>
        )}
        {file && (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => downloadAssetFile(file)}>
            Download
          </button>
        )}
        {asset.kind === "cdn-url" && asset.url && (
          <a className="btn-ghost px-2 py-1 text-xs" href={asset.url} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        )}
        <button type="button" className="self-start rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400" aria-label={`Delete ${asset.name}`} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

const TOKEN_FIELDS: { key: Exclude<keyof BrandTokens, "fontFamily">; label: string; token: string }[] = [
  { key: "primary", label: "Primary", token: "{{BRAND_PRIMARY_COLOR}}" },
  { key: "secondary", label: "Secondary", token: "{{BRAND_SECONDARY_COLOR}}" },
  { key: "accent", label: "Accent", token: "{{BRAND_ACCENT_COLOR}}" },
  { key: "textColor", label: "Text", token: "{{BRAND_TEXT_COLOR}}" },
  { key: "mutedColor", label: "Muted text", token: "{{BRAND_MUTED_COLOR}}" },
  { key: "borderColor", label: "Border", token: "{{BRAND_BORDER_COLOR}}" },
  { key: "canvasBg", label: "Canvas background", token: "{{BRAND_CANVAS_BG}}" },
  { key: "containerBg", label: "Container background", token: "{{BRAND_CONTAINER_BG}}" },
];

function TokenEditor({ book, assets }: { book: BrandBook; assets: BrandAsset[] }) {
  const update = useStore((s) => s.updateBrandTokens);
  const tokens = book.tokens ?? {};
  const value = (k: keyof BrandTokens) => (tokens[k] as string | undefined) ?? "";

  return (
    <details className="border-b border-slate-800 px-4 py-2.5 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200">
        Brand tokens {Object.keys(tokens).length ? `(${Object.keys(tokens).length} set)` : "(defaults)"}
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Empty fields use the default, so existing designs keep today’s colors until you set a field or apply a palette. Button text uses the default unless a directive sets it.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {TOKEN_FIELDS.map((f) => {
          const current = value(f.key);
          const effective = isHex(current) ? current : DEFAULT_TOKENS[f.key];
          return (
            <div key={f.key}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor={`${book.id}-${f.key}`}>
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${f.label} color picker`}
                  value={/^#[0-9a-f]{6}$/i.test(effective) ? effective : "#000000"}
                  onChange={(e) => update(book.id, { [f.key]: e.target.value.toUpperCase() })}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-800 bg-slate-900 p-0.5"
                />
                <input
                  id={`${book.id}-${f.key}`}
                  className="input py-1.5 font-mono text-xs"
                  placeholder={DEFAULT_TOKENS[f.key]}
                  value={current}
                  onChange={(e) => update(book.id, { [f.key]: e.target.value.trim() })}
                />
              </div>
              {current && !isHex(current) && <p className="mt-1 text-[11px] text-red-400">Use a hex value like #0B5CAB.</p>}
            </div>
          );
        })}
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor={`${book.id}-font`}>
            Font family
          </label>
          <input
            id={`${book.id}-font`}
            className="input py-1.5 text-xs"
            placeholder={DEFAULT_TOKENS.fontFamily}
            value={value("fontFamily")}
            onChange={(e) => update(book.id, { fontFamily: e.target.value })}
          />
        </div>
      </div>
      {isMaxicareBl(book.name) && (
        <div className="mt-3">
          <button type="button" className="btn-ghost" onClick={() => update(book.id, MAXICARE_BL_TOKENS)}>
            Apply Maxicare BL colors
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Sets blue #0150C8, orange #E0610C, text, soft backgrounds, border, muted text, and Poppins for this book. Poppins falls back to a similar system font until you upload it. Designs already generated keep their colors.
          </p>
        </div>
      )}
      <PaletteSuggest assets={assets} onApply={(tokens) => update(book.id, tokens)} />
    </details>
  );
}
