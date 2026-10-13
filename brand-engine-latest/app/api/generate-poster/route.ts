import { NextResponse } from "next/server";
import { resolveBrandTokens } from "@/lib/brand-tokens";
import { friendlyGeminiError, generateJsonText, resolveGeminiKey, resolveModel } from "@/lib/gemini";
import { POSTER_SYSTEM_INSTRUCTION, buildPosterPrompt, extractJsonObject, orientationOf, type PosterAssetSummary } from "@/lib/poster-prompt";
import { buildFallbackPoster, sanitizePosterSpec, themeFromTokens } from "@/lib/poster-spec";
import { describeSize, sanitizeSize, trimPx } from "@/lib/poster-sizes";
import type { BrandTokens } from "@/lib/types";
import type { IllustrationMode, PosterSize, PosterSpec } from "@/lib/poster-types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  prompt?: string;
  brandName?: string;
  brandTokens?: BrandTokens;
  size?: Partial<PosterSize>;
  assets?: PosterAssetSummary[];
  fonts?: string[];
  illustrationMode?: IllustrationMode;
  revision?: { spec?: PosterSpec; instruction?: string };
  model?: string;
  apiKey?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const prompt = body.prompt?.trim() ?? "";
  const revision = body.revision?.spec && body.revision.instruction?.trim() ? { spec: body.revision.spec, instruction: body.revision.instruction.trim() } : undefined;
  if (!prompt && !revision) return NextResponse.json({ error: "Describe the poster first." }, { status: 400 });
  if (prompt.length > 12_000) return NextResponse.json({ error: "That brief is too long. Keep it under 12,000 characters." }, { status: 400 });

  const tokens = resolveBrandTokens({ tokens: body.brandTokens });
  const theme = themeFromTokens(tokens);
  const size = sanitizeSize(body.size);
  const { w, h } = trimPx(size);
  const assets = (body.assets ?? []).slice(0, 60).map((a) => ({
    id: String(a.id),
    name: String(a.name ?? "").slice(0, 120),
    kind: String(a.kind ?? "image"),
    role: a.role ? String(a.role).slice(0, 60) : undefined,
    directive: a.directive ? String(a.directive).slice(0, 200) : undefined,
  }));
  const fonts = (body.fonts ?? []).slice(0, 20).map((f) => String(f).slice(0, 60));
  const mode: IllustrationMode = body.illustrationMode === "library" || body.illustrationMode === "none" ? body.illustrationMode : "auto";
  const explicitFont = body.brandTokens?.fontFamily?.trim() || undefined;
  const ctx = { assetIds: new Set(assets.map((a) => a.id)), theme, brandName: body.brandName, fontFamily: explicitFont };

  const apiKey = resolveGeminiKey(body.apiKey);
  const warnings: string[] = [];

  if (!apiKey) {
    warnings.push("No Gemini API key configured: laid out from the brief with the built-in offline layout. Add a key in API & Mail Settings for AI design.");
    if (revision) {
      warnings.push("Revisions need a Gemini API key; the poster was left unchanged.");
      return NextResponse.json({ spec: sanitizePosterSpec(revision.spec, ctx), warnings, source: "fallback" });
    }
    return NextResponse.json({ spec: buildFallbackPoster({ prompt, brandName: body.brandName, theme, fontFamily: explicitFont }), warnings, source: "fallback" });
  }

  const model = resolveModel(body.model);
  try {
    const text = await generateJsonText({
      apiKey,
      model,
      systemInstruction: POSTER_SYSTEM_INSTRUCTION,
      prompt: buildPosterPrompt({
        prompt,
        brandName: body.brandName,
        tokens,
        sizeLabel: describeSize(size),
        orientation: orientationOf(w, h),
        assets,
        fonts,
        illustrationMode: mode,
        revision,
      }),
    });
    const spec = sanitizePosterSpec(extractJsonObject(text), ctx);
    if (mode === "none") delete spec.illustration;
    else if (mode === "library" && spec.illustration) spec.illustration = spec.illustration.assetId ? { assetId: spec.illustration.assetId } : undefined;
    return NextResponse.json({ spec, warnings, source: "gemini", model });
  } catch (err) {
    if (err instanceof Error && /valid JSON/.test(err.message)) {
      return NextResponse.json({ error: "The AI returned a layout that couldn't be read. Try again or simplify the brief." }, { status: 502 });
    }
    return NextResponse.json({ error: friendlyGeminiError(err) }, { status: 502 });
  }
}
