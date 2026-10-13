import { currentCohort, type GenMode, type IdeaCard, type IdeaResource } from "./idea-types";

export interface Exclusions {
  titles: string[];
  sourceIds: string[];
}

export function buildIdeaSystemInstruction(args: {
  mode: GenMode;
  cohort: string;
  tone: string;
  focusTypes: string[];
  exclusions: Exclusions;
  resources: Pick<IdeaResource, "id" | "name" | "extractedNotes">[];
}): string {
  const notes =
    args.mode !== "Pure Random" && args.resources.length
      ? "\nAVAILABLE NOTES:\n" + args.resources.map((r) => `[ID: ${r.id}] ${r.name}: ${r.extractedNotes}`).join("\n")
      : "";
  const modeRule =
    args.mode === "Idea Base Match"
      ? "\nMODE: Idea Base Match. Every idea MUST be built strictly from one of the AVAILABLE NOTES and set sourceId to that note's ID."
      : args.mode === "Pure Random"
        ? "\nMODE: Pure AI. Brainstorm from scratch; leave sourceId empty."
        : "\nMODE: Hybrid (Idea Base + AI). Blend AVAILABLE NOTES with fresh creative angles; set sourceId when an idea draws on a note.";
  return `You are the Principal Marketing & Health Adherence Strategist for 'The Best Life Program' by Maxicare & MedGrocer (forwardmg.ph).
Generate an array of exactly ${args.focusTypes.length} campaign initiative objects matching the required schema.

TARGET COHORT: ${args.cohort}
COHORT MEANINGS: Unconverted means no first order. Ordered within the past 90 days includes someone whose last order was exactly 90 days ago. Ordered more than 90 days ago means the last order was more than 90 days ago. All Members means every member. Use the target cohort name exactly.
DESIRED TONE: ${args.tone}
FOCUS TYPES: ${args.focusTypes.join(", ")} (one idea per focus type, in this order; cardType must equal the focus type)${modeRule}
${args.exclusions.titles.length ? "NEGATIVE CONSTRAINTS (DO NOT DUPLICATE): " + args.exclusions.titles.join(" | ") : ""}${notes}

STRICT COPY RULES FOR PATIENT-FACING FIELDS:
1. patientAnnouncement: One punchy alert banner hook specific to the topic.
2. patientIntro: STRICTLY UNDER 45 WORDS total.
   - Line 1 must name the exact concrete topic/condition/event (e.g., flu season, blood pressure refill, morning routine) without boring preachy lectures.
   - Line 2 must connect that need to Maxicare Best Life benefits, doorstep delivery on ForwardMG, and savings.
   - Must be written in a warm Care Partner tone ending with a colon (:).
   - STRICTLY FORBIDDEN: NEVER use internal marketing jargon like "12,000 pool", "cohort", "adherence module", or "condition management".
3. topicSummary: Keep this as an internal strategic summary for the marketing manager.
4. smsCopy: Strictly under 160 characters.

OUTPUT: Return ONLY a JSON array. Each object has exactly these keys:
cardType (string), sourceId (string, may be empty), title (string), topicSummary (string), patientAnnouncement (string), patientIntro (string), cohort (string), offerStrategy (string), subjectLines (array of 2 strings), coreOutline (array of 3 strings), cta (string), smsCopy (string).`;
}

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n: number, max: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => s(x, max)).filter(Boolean).slice(0, n);

/** Coerces model output into safe IdeaCards. Drops cards without a title. */
export function sanitizeIdeaCards(raw: unknown, defaults: { cohort: string; focusTypes: string[]; validSourceIds: Set<string> }): IdeaCard[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { ideas?: unknown }).ideas) ? (raw as { ideas: unknown[] }).ideas : [];
  const out: IdeaCard[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const title = s(r.title, 160);
    if (!title) return;
    const sourceId = s(r.sourceId, 80);
    let sms = s(r.smsCopy, 400);
    if (sms.length > 160) sms = sms.slice(0, 157).trimEnd() + "...";
    out.push({
      cardType: s(r.cardType, 60) || defaults.focusTypes[i] || "Promotional",
      sourceId: sourceId && defaults.validSourceIds.has(sourceId) ? sourceId : null,
      title,
      topicSummary: s(r.topicSummary, 600),
      patientAnnouncement: s(r.patientAnnouncement, 240),
      patientIntro: s(r.patientIntro, 700),
      cohort: currentCohort(s(r.cohort, 80) || defaults.cohort),
      offerStrategy: s(r.offerStrategy, 400),
      subjectLines: strs(r.subjectLines, 4, 160),
      coreOutline: strs(r.coreOutline, 8, 240),
      cta: s(r.cta, 100) || "Order Your Medicines on ForwardMG",
      smsCopy: sms,
    });
  });
  return out;
}

/** Ported from IDEAte: used when no API key is set or the AI call fails. */
export function buildOfflineFallbackCards(cohort: string, focusTypes: string[], firstResourceId?: string): IdeaCard[] {
  return focusTypes.map((fType): IdeaCard => {
    if (fType === "Promotional") {
      return {
        cardType: "Promotional",
        sourceId: null,
        title: "Unlock Your $0 Chronic Care Copay Refill Card",
        topicSummary: "Strategic copay waiver incentive for members with maintenance prescriptions to avoid therapy drop-offs.",
        patientAnnouncement: "🚨 ENDS SEP 25: Save up to 50% on your daily maintenance medicines with Free Delivery on ForwardMG!",
        patientIntro:
          "Managing your chronic maintenance prescriptions shouldn't put a dent in your monthly budget.\n\nWith your Maxicare Best Life program, ordering your prescribed daily medications is fast, seamless, and delivered straight to your door with exclusive member discounts:",
        cohort,
        offerStrategy: "Targeting promotional pool with instant savings card activation on forwardmg.ph.",
        subjectLines: ["Your $0 Copay Card is waiting for activation", "Save on this month's maintenance refills"],
        coreOutline: ["Verify member eligibility.", "Calculate co-pay savings vs retail.", "One-tap prescription refill checkout."],
        cta: "Order Your Medicines on ForwardMG",
        smsCopy: "Best Life: Refill your daily maintenance meds with up to 50% savings! Order in 60 sec on forwardmg.ph: [Link]",
      };
    }
    if (fType === "Non-Promotional") {
      return {
        cardType: "Non-Promotional",
        sourceId: null,
        title: "The 3-Minute Daily Routine: Sync Your Morning Care",
        topicSummary: "Habit-stacking adherence coaching initiative to simplify multidose prescription schedules.",
        patientAnnouncement: "💡 Healthy Habits: Pair your morning routine with frictionless doorstep refills on ForwardMG.",
        patientIntro:
          'Tired of the "did I take my morning pill today?" guessing game? Building a simple daily habit makes all the difference.\n\nKeep your routine completely uninterrupted with doorstep refills and exclusive member discounts through Maxicare Best Life:',
        cohort,
        offerStrategy: "Educational adherence initiative linking habit-stacking to continuous ForwardMG therapy refills.",
        subjectLines: ["Never miss a morning dose again", "A simpler way to manage your daily health routine"],
        coreOutline: ["The power of habit pairing with morning coffee.", "Syncing all monthly doses to one order.", "Direct pharmacist guidance on ForwardMG."],
        cta: "Order Your Medicines on ForwardMG",
        smsCopy: "Best Life: Stay consistent with ease! Sync your daily prescriptions to one delivery date on forwardmg.ph: [Link]",
      };
    }
    return {
      cardType: "Non-promotional (Resource)",
      sourceId: firstResourceId ?? null,
      title: "Autumn Immunization and Flu Season Refill Drive",
      topicSummary: "Seasonal care package leveraging DOH awareness calendar for flu vaccination and chronic care replenishment.",
      patientAnnouncement: "🍂 Autumn Health Alert: Co-schedule seasonal immunity and chronic refills with Free Delivery!",
      patientIntro:
        "With flu season and cooler weather rolling in, staying ahead of seasonal bugs starts with keeping your medicine cabinet stocked.\n\nSkip the pharmacy lines—your Maxicare Best Life benefit lets you order your seasonal essentials and daily maintenance meds right to your door with exclusive savings:",
      cohort,
      offerStrategy: "Combines seasonal immunization hooks with ongoing maintenance prescription continuity.",
      subjectLines: ["Autumn Health Check: Keep your immunity protected", "Stay healthy this season: Refill and vaccine checklist"],
      coreOutline: ["Seasonal vulnerability overview.", "Home delivery of regular refills plus subsidized vitamins.", "Pharmacist verification in 1 working day."],
      cta: "Order Your Medicines on ForwardMG",
      smsCopy: "Best Life Autumn Alert: Keep your medicine cabinet fully stocked before flu season hits! Refill on forwardmg.ph: [Link]",
    };
  });
}

export const RESOURCE_ANALYSIS_PROMPT =
  "Extract high-yield clinical adherence themes, dates, and copay opportunities from this healthcare document. Format as clean concise bullet points.";

export function cardBadge(cardType: string): "promo" | "resource" | "edu" {
  if (cardType.includes("Promo") && !cardType.includes("Non")) return "promo";
  if (cardType.includes("Season") || cardType.includes("Resource")) return "resource";
  return "edu";
}
