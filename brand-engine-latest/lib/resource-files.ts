export const MAX_ANALYZE_BYTES = 2.5 * 1024 * 1024;

export type AnalysisMode = "send" | "shrink" | "too-large" | "unsupported";

/**
 * How an Idea Base file can be analyzed by AI. Uploads are stored in the browser, but analysis sends the
 * file to the server, which must stay under Vercel's 4.5 MB request limit (base64 adds about a third).
 * Images are shrunk in the browser first; PDFs can't be, so large ones need notes added by hand.
 */
export function analysisMode(ext: string | undefined, bytes: number): AnalysisMode {
  const e = (ext ?? "").toLowerCase();
  if (e === "png" || e === "jpg" || e === "jpeg") return bytes > MAX_ANALYZE_BYTES ? "shrink" : "send";
  if (e === "pdf") return bytes > MAX_ANALYZE_BYTES ? "too-large" : "send";
  return "unsupported";
}

export const dataUrlBytes = (dataUrl: string | undefined) => Math.round(((dataUrl?.split(",")[1] ?? "").length * 3) / 4);
