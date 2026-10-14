export const COHORTS = ["All Members", "Unconverted", "Ordered within the past 90 days", "Ordered more than 90 days ago"] as const;

/** Old labels still found in saved workspaces and the previous IDEAte app. "All Members" is unchanged. */
export const COHORT_FROM_LEGACY: Record<string, (typeof COHORTS)[number]> = {
  "Unactivated (0 Orders)": "Unconverted",
  Unactivated: "Unconverted",
  "Active / Adherent": "Ordered within the past 90 days",
  "Lapsed (45+ Days)": "Ordered more than 90 days ago",
  Lapsed: "Ordered more than 90 days ago",
};
export const MONTHS = [
  "Any",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
export const SOURCE_TYPES = ["Health Advisories", "Program Brief", "Visual Reference", "Other Document"] as const;

/** "Clinical Guide" and "DOH Calendar" both become "Health Advisories". The previous value is kept on the item. */
export const SOURCE_FROM_LEGACY: Record<string, (typeof SOURCE_TYPES)[number] | "Scratch Idea"> = {
  "DOH Calendar": "Health Advisories",
  "Copay Brief": "Program Brief",
  "Clinical Guide": "Health Advisories",
};

export function currentCohort(value: string): string {
  return COHORT_FROM_LEGACY[value] ?? value;
}

export function currentSource(value: string): string {
  return SOURCE_FROM_LEGACY[value] ?? value;
}
export const TONES = [
  { value: "Empathetic & Supportive", label: "Empathetic and Supportive (Caregiver and Partner tone)" },
  { value: "Urgent & Savings-Driven", label: "Urgent and Savings-Driven (Copay zero and benefits alert)" },
  { value: "Informative & Navigational", label: "Informative and Navigational (Frictionless refill guides)" },
  { value: "Modular/Custom", label: "Modular and custom (Multi-angle hooks)" },
] as const;

export const FOCUS_TYPES = [
  { value: "Promotional", hint: "Copay and discount targeting 6k pool", tone: "emerald" },
  { value: "Non-Promotional", hint: "Education and tips targeting 12k pool", tone: "indigo" },
  { value: "Non-promotional (Resource)", hint: "Leverages active Idea Base items", tone: "amber" },
] as const;

export type GenMode = "Hybrid" | "Idea Base Match" | "Pure Random";

export const GEN_MODES: { value: GenMode; label: string; hint: string }[] = [
  { value: "Hybrid", label: "Hybrid (Idea Base + AI)", hint: "Synthesizes active Idea Base notes with creative models" },
  { value: "Idea Base Match", label: "Idea Base Match", hint: "Strict adherence to uploaded analyzed documents" },
  { value: "Pure Random", label: "Pure AI", hint: "Zero-base brainstorm tailored to cohort parameters" },
];

/** Largest file the Idea Base will store in the browser. AI analysis has a smaller limit (see resource-files.ts). */
export const MAX_RESOURCE_FILE_BYTES = 25 * 1024 * 1024;

export interface IdeaResource {
  id: string;
  inputType: "scratch" | "file";
  name: string;
  fileName?: string;
  fileExt?: string;
  /** data URL for uploaded files */
  fileData?: string;
  sourceType: string;
  /** Set only when a rename changed sourceType, so the previous name can be restored. */
  legacySourceType?: string;
  targetMonth: string;
  cohort: string;
  /** Set only when a rename changed cohort, so the previous name can be restored. */
  legacyCohort?: string;
  tags: string[];
  active: boolean;
  dateAdded: string;
  extractedNotes: string;
}

export interface IdeaCard {
  cardType: string;
  sourceId?: string | null;
  title: string;
  topicSummary: string;
  patientAnnouncement: string;
  patientIntro: string;
  cohort: string;
  /** Set only when a rename changed cohort, so the previous name can be restored. */
  legacyCohort?: string;
  offerStrategy: string;
  subjectLines: string[];
  coreOutline: string[];
  cta: string;
  smsCopy: string;
}

export type PipelineStatus = "Scheduled" | "Completed" | "Past Date (Released)";

export interface PipelineItem {
  id: string;
  /** YYYY-MM-DD */
  scheduledDate: string;
  status: PipelineStatus | string;
  ideaData: IdeaCard;
  /** Idea Studio content saved against this item so it can be revisited */
  campaign?: Campaign;
  blastIds?: string[];
  posterIds?: string[];
}

export interface CampaignCard {
  icon: string;
  title: string;
  subtext: string;
}

export interface CampaignStep {
  title: string;
  details: string;
}

export interface EmailContent {
  preheaderEnabled: boolean;
  preheaderText: string;
  heroHeadline: string;
  announcement: string;
  introBody: string;
  tableEnabled: boolean;
  tableIntro: string;
  tableHeaders: string[];
  tableRows: string[][];
  disclaimerEnabled: boolean;
  disclaimerText: string;
  cardsHeader: string;
  cards: CampaignCard[];
  didYouKnowEnabled: boolean;
  didYouKnowTitle: string;
  didYouKnowBody: string;
  guideTitle: string;
  steps: CampaignStep[];
  promoTipEnabled: boolean;
  promoTipHeader: string;
  promoTipBody: string;
  ctaMicrocopy: string;
  secondaryCtaEnabled: boolean;
  secondaryTitle: string;
  secondaryLabel: string;
  secondaryUrl: string;
  terms: string;
  footerText: string;
}

export interface PosterContent {
  headline: string;
  subheading: string;
  stepsTitle: string;
  /** one step per line: "Label :: detail", decisions as "Label ?? yes || no" */
  stepsText: string;
  pointsText: string;
  callout: string;
  showQr: boolean;
  footer: string;
  disclaimer: string;
  illustrationHint: string;
  /** "N/A" keeps the idea's own poster sections. Any other text can fill those sections. */
  customDirective?: string;
}

export type BrandMode = "single" | "co2" | "co3";

export interface Campaign {
  /** shared basics */
  title: string;
  cardType: string;
  cohort: string;
  /** Set only when a rename changed cohort, so the previous name can be restored. */
  legacyCohort?: string;
  brandMode: BrandMode;
  brandConnector: string;
  brand1: string;
  brand2: string;
  brand3: string;
  ctaLabel: string;
  ctaUrl: string;
  supportLine: string;
  email: EmailContent;
  poster: PosterContent;
}

export interface StudioState {
  campaign: Campaign | null;
  /** pipeline item this campaign is saved against, if any */
  pipelineId: string | null;
}
