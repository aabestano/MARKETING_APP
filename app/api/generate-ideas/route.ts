import { NextResponse } from "next/server";
import { friendlyGeminiError, generateJsonText, resolveGeminiKey, resolveModel } from "@/lib/gemini";
import { buildIdeaSystemInstruction, buildOfflineFallbackCards, sanitizeIdeaCards } from "@/lib/idea-gen";
import { extractJsonObject } from "@/lib/poster-prompt";
import { COHORTS, currentCohort, FOCUS_TYPES, type GenMode, type IdeaCard } from "@/lib/idea-types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  mode?: GenMode;
  cohort?: string;
  tone?: string;
  focusTypes?: string[];
  exclusions?: { titles?: string[]; sourceIds?: string[] };
  resources?: { id: string; name: string; extractedNotes: string }[];
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
  const validFocus = new Set<string>(FOCUS_TYPES.map((f) => f.value));
  const focusTypes = (body.focusTypes ?? []).filter((f) => validFocus.has(f)).slice(0, 6);
  if (!focusTypes.length) return NextResponse.json({ error: "Select at least 1 focus type." }, { status: 400 });

  const mode: GenMode = body.mode === "Idea Base Match" || body.mode === "Pure Random" ? body.mode : "Hybrid";
  const requestedCohort = currentCohort(body.cohort ?? "");
  const cohort = (COHORTS as readonly string[]).includes(requestedCohort) ? requestedCohort : COHORTS[0];
  const tone = (body.tone ?? "Empathetic & Supportive").slice(0, 80);
  const exclusions = {
    titles: (body.exclusions?.titles ?? []).slice(0, 80).map((t) => String(t).slice(0, 160)),
    sourceIds: (body.exclusions?.sourceIds ?? []).slice(0, 200).map(String),
  };
  const resources = (body.resources ?? [])
    .filter((r) => r && r.id && r.extractedNotes && !exclusions.sourceIds.includes(r.id))
    .slice(0, 40)
    .map((r) => ({ id: String(r.id), name: String(r.name).slice(0, 160), extractedNotes: String(r.extractedNotes).slice(0, 2000) }));
  const validSourceIds = new Set(resources.map((r) => r.id));

  const offline = (reason: string) => {
    const ideas = buildOfflineFallbackCards(cohort, focusTypes, resources[0]?.id);
    return NextResponse.json({ ideas, source: "fallback", warnings: [reason] });
  };

  const apiKey = resolveGeminiKey(body.apiKey);
  if (!apiKey) return offline("No Gemini API key configured: showing built-in adherence templates. Add a key in API and Mail Settings for fresh AI ideas.");

  if (mode === "Idea Base Match" && !resources.length) {
    return NextResponse.json(
      { error: "Idea Base Match needs at least one active Idea Base item with extracted notes (and not already scheduled)." },
      { status: 400 },
    );
  }

  const model = resolveModel(body.model);
  try {
    const text = await generateJsonText({
      apiKey,
      model,
      systemInstruction: buildIdeaSystemInstruction({ mode, cohort, tone, focusTypes, exclusions, resources }),
      prompt: `Generate ${focusTypes.length} campaign initiative object${focusTypes.length > 1 ? "s" : ""} now.`,
      temperature: 0.7,
    });
    const ideas: IdeaCard[] = sanitizeIdeaCards(extractJsonObject(text), { cohort, focusTypes, validSourceIds });
    if (!ideas.length) return offline("The AI returned no usable ideas, so built-in templates are shown instead.");
    return NextResponse.json({ ideas, source: "gemini", model, warnings: [] });
  } catch (err) {
    return offline(`${friendlyGeminiError(err)} Showing built-in templates instead.`);
  }
}
