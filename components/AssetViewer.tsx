"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { assetFile, assetPreviewKind, blobUrlFor, downloadAssetFile, templateMode } from "@/lib/asset-file";
import { postJson } from "@/lib/client-utils";
import type { BrandAsset } from "@/lib/types";
import { Modal, Spinner } from "./ui";

export function AssetViewer({ asset, onClose }: { asset: BrandAsset; onClose: () => void }) {
  const preview = assetPreviewKind(asset);
  const file = useMemo(() => assetFile(asset), [asset]);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [html, setHtml] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    if (preview !== "pdf" || !file) return;
    const url = blobUrlFor(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview, file]);

  const mode = preview === "template" && asset.text ? templateMode(asset.name, asset.text) : null;

  useEffect(() => {
    if (mode !== "mjml" || !asset.text) return;
    let alive = true;
    setCompiling(true);
    setPreviewError(undefined);
    setHtml(undefined);
    void postJson<{ html: string }>("/api/transpile-mjml", { mjml: asset.text })
      .then((data) => {
        if (alive) setHtml(data.html);
      })
      .catch((err) => {
        if (alive) setPreviewError(err instanceof Error ? err.message : "This template could not be previewed.");
      })
      .finally(() => {
        if (alive) setCompiling(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, asset.text]);

  const imageSrc = asset.kind === "image" ? asset.dataUrl : asset.url;
  const previewHtml = mode === "html" ? asset.text : mode === "mjml" ? html : undefined;

  return (
    <Modal
      title={asset.name}
      description={preview === "pdf" ? "Shown with your browser's PDF viewer." : undefined}
      onClose={onClose}
      size={preview === "image" ? "lg" : "xl"}
      footer={
        file ? (
          <button type="button" className="btn-primary" onClick={() => downloadAssetFile(file)}>
            <Download className="h-4 w-4" /> Download
          </button>
        ) : asset.url ? (
          <a className="btn-primary" href={asset.url} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        ) : null
      }
    >
      {preview === "pdf" &&
        (pdfUrl ? (
          <iframe title={asset.name} src={pdfUrl} className="h-[70vh] w-full rounded-md border border-slate-800 bg-white" />
        ) : (
          <p className="text-sm text-slate-400">This PDF could not be opened. Use Download to save it.</p>
        ))}

      {preview === "image" && imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={asset.name} className="mx-auto max-h-[70vh] w-full object-contain" />
      )}

      {preview === "template" && asset.text && (
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</h3>
            {compiling && (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Spinner /> Preparing the preview…
              </p>
            )}
            {previewError && <p className="text-sm text-amber-200">{previewError}</p>}
            {previewHtml && (
              <iframe title={`Preview of ${asset.name}`} sandbox="" srcDoc={previewHtml} className="h-[420px] w-full rounded-md border border-slate-800 bg-white" />
            )}
            {mode === "text" && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">{asset.text}</pre>}
          </section>
          {mode !== "text" && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Source</h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-200">{asset.text}</pre>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
