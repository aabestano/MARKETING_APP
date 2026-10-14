export const DEFAULT_FLUX_MODEL = "fal-ai/flux/schnell";

export const FLUX_MODELS = [
  { id: "fal-ai/flux/schnell", label: "FLUX schnell (fastest, lowest cost)" },
  { id: "fal-ai/flux/dev", label: "FLUX dev (better detail)" },
  { id: "fal-ai/flux-pro/v1.1", label: "FLUX 1.1 pro (best quality)" },
] as const;

const SIZES: Record<string, string> = {
  "1:1": "square_hd",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

export const fluxImageSize = (aspectRatio?: string) => SIZES[aspectRatio ?? ""] ?? "square_hd";

/** Accepts "fal-ai/flux/dev" or a pasted fal.ai model URL; rejects anything that isn't a plain model path. */
export function normalizeFluxModel(input?: string): string {
  const raw = (input ?? "").trim().replace(/^https?:\/\/(?:fal\.run|fal\.ai\/models)\//i, "").replace(/^\/+|\/+$/g, "");
  return /^[a-z0-9][\w.-]*(\/[\w.-]+){1,3}$/i.test(raw) ? raw : DEFAULT_FLUX_MODEL;
}

const ALLOWED_HOST = /(^|\.)(fal\.media|fal\.run|fal\.ai)$/i;

/** Pulls the first image URL out of a fal.ai response and checks it points at fal's own storage. */
export function parseFluxResponse(json: unknown): string {
  const images = (json as { images?: { url?: unknown }[] } | null)?.images;
  const url = Array.isArray(images) ? images[0]?.url : undefined;
  if (typeof url !== "string") throw new Error("FLUX returned no image. Try rephrasing the illustration description.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("FLUX returned an unreadable image address.");
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOST.test(parsed.hostname)) throw new Error("FLUX returned an image from an unexpected host.");
  return parsed.toString();
}

export function friendlyFluxError(status: number, detail?: string): string {
  if (status === 401 || status === 403) return "fal.ai rejected the API key. Check the FLUX key in API and Mail Settings.";
  if (status === 402) return "fal.ai says the account has no credit. Add credit at fal.ai, then try again.";
  if (status === 404) return "That FLUX model wasn't found on fal.ai. Check the model name in API and Mail Settings.";
  if (status === 422) return `fal.ai could not use that description${detail ? `: ${detail}` : ""}. Try rephrasing it.`;
  if (status === 429) return "fal.ai is rate-limiting requests. Wait a moment and try again.";
  return `FLUX image generation failed (${status})${detail ? `: ${detail}` : ""}.`;
}

export async function generateFluxImageDataUrl(args: { apiKey: string; model: string; prompt: string; aspectRatio?: string }): Promise<string> {
  const res = await fetch(`https://fal.run/${normalizeFluxModel(args.model)}`, {
    method: "POST",
    headers: { Authorization: `Key ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: args.prompt, image_size: fluxImageSize(args.aspectRatio), num_images: 1, enable_safety_checker: true }),
    signal: AbortSignal.timeout(100_000),
  });
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  if (!res.ok) throw new Error(friendlyFluxError(res.status, typeof body.detail === "string" ? body.detail.slice(0, 160) : undefined));
  const imageRes = await fetch(parseFluxResponse(body), { signal: AbortSignal.timeout(60_000) });
  if (!imageRes.ok) throw new Error("FLUX made the image but it could not be downloaded. Try again.");
  const bytes = Buffer.from(await imageRes.arrayBuffer());
  if (bytes.length > 12 * 1024 * 1024) throw new Error("The generated image was unexpectedly large. Try again.");
  const mime = imageRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
