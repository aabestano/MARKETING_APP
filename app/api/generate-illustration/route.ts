import { NextResponse } from "next/server";
import { resolveBrandTokens } from "@/lib/brand-tokens";
import { friendlyGeminiError, generateImageDataUrl, resolveGeminiKey } from "@/lib/gemini";
import { buildIllustrationPrompt } from "@/lib/poster-prompt";
import { DEFAULT_FLUX_MODEL, friendlyFluxError, generateFluxImageDataUrl } from "@/lib/flux";
import { DEFAULT_IMAGE_MODEL, type BrandTokens } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ASPECTS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "4:5", "5:4"]);

export async function POST(req: Request) {
  let body: { prompt?: string; brandName?: string; brandTokens?: BrandTokens; aspectRatio?: string; model?: string; apiKey?: string; provider?: string; fluxApiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const subject = body.prompt?.trim() ?? "";
  if (!subject) return NextResponse.json({ error: "Describe the illustration first." }, { status: 400 });
  if (subject.length > 600) return NextResponse.json({ error: "Keep the illustration description under 600 characters." }, { status: 400 });

  const tokens = resolveBrandTokens({ tokens: body.brandTokens });
  const aspectRatio = body.aspectRatio && ASPECTS.has(body.aspectRatio) ? body.aspectRatio : undefined;
  const prompt = buildIllustrationPrompt(subject, tokens, body.brandName);

  if (body.provider === "flux") {
    const fluxKey = body.fluxApiKey?.trim() || process.env.FAL_KEY;
    if (!fluxKey) {
      return NextResponse.json(
        { error: "Drawing with FLUX needs a fal.ai API key. Add one in API and Mail Settings, or upload an illustration to the Poster Illustration folder." },
        { status: 400 },
      );
    }
    const model = body.model?.trim() || process.env.FLUX_MODEL || DEFAULT_FLUX_MODEL;
    try {
      const dataUrl = await generateFluxImageDataUrl({ apiKey: fluxKey, model, prompt, aspectRatio });
      return NextResponse.json({ dataUrl, model });
    } catch (err) {
      const message = err instanceof Error ? err.message : friendlyFluxError(500);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const apiKey = resolveGeminiKey(body.apiKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Generating illustrations needs a Gemini API key. Add one in API and Mail Settings, or upload an illustration to the Poster Illustration folder." },
      { status: 400 },
    );
  }
  const model = body.model?.trim() || process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  try {
    const dataUrl = await generateImageDataUrl({ apiKey, model, prompt, aspectRatio });
    return NextResponse.json({ dataUrl, model });
  } catch (err) {
    return NextResponse.json({ error: friendlyGeminiError(err) }, { status: 502 });
  }
}
