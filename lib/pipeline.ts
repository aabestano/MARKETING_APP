import { APP_NAME } from "./app-name";
import type { IdeaCard, PipelineItem } from "./idea-types";

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the user's local timezone (toISOString would shift dates for users east of UTC). */
export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const PAST_STATUS = "Past Date (Released)";

/** Scheduled items whose date has passed become "Past Date (Released)". Returns the same array if nothing changed. */
export function syncLifecycle(items: PipelineItem[], today = localDateStr()): PipelineItem[] {
  let changed = false;
  const next = items.map((i) => {
    if (i.status === "Scheduled" && i.scheduledDate < today) {
      changed = true;
      return { ...i, status: PAST_STATUS };
    }
    return i;
  });
  return changed ? next : items;
}

/** Titles and source IDs of upcoming items; the generator must not duplicate these. */
export function getExclusions(items: PipelineItem[], today = localDateStr()): { titles: string[]; sourceIds: string[] } {
  const upcoming = items.filter((p) => p.scheduledDate >= today);
  return {
    titles: upcoming.map((p) => p.ideaData.title),
    sourceIds: upcoming.map((p) => p.ideaData.sourceId).filter((id): id is string => !!id),
  };
}

export interface CalendarCell {
  date: string | null;
  day: number | null;
  items: PipelineItem[];
  isToday: boolean;
}

/** Cells for a month grid starting on Sunday, padded to full weeks with null cells. */
export function buildMonthGrid(year: number, month: number, items: PipelineItem[], today = localDateStr()): CalendarCell[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < first; i++) cells.push({ date: null, day: null, items: [], isToday: false });
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${pad(month + 1)}-${pad(d)}`;
    cells.push({ date, day: d, items: items.filter((p) => p.scheduledDate === date), isToday: date === today });
  }
  while (cells.length % 7) cells.push({ date: null, day: null, items: [], isToday: false });
  return cells;
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function pipelineToCsv(items: PipelineItem[]): string {
  const headers = ["Task Name", "Start Date", "Description", "Focus", "Cohort", "Status"];
  const rows = items.map((i) =>
    [csvCell(i.ideaData.title), i.scheduledDate, csvCell(i.ideaData.topicSummary || ""), csvCell(i.ideaData.cardType), csvCell(i.ideaData.cohort), csvCell(i.status)].join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

const icsEscape = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function pipelineToIcs(items: PipelineItem[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${APP_NAME}//Best Life Pipeline//EN`];
  for (const i of items) {
    const d = i.scheduledDate.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${i.id}@bestlife.ph`,
      `DTSTAMP:${d}T000000Z`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${d}`,
      `SUMMARY:${icsEscape(`[${i.ideaData.cardType}] ${i.ideaData.title}`)}`,
      `STATUS:${i.status === "Completed" ? "COMPLETED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Plain-text summary used by "copy campaign asset". */
export function ideaAssetText(idea: IdeaCard): string {
  return `TITLE: ${idea.title}\nCATEGORY: ${idea.cardType}\nCOHORT: ${idea.cohort}\n\nSYNOPSIS:\n${idea.topicSummary}\n\nA/B SUBJECT LINES:\n1. ${idea.subjectLines?.[0] ?? ""}\n2. ${idea.subjectLines?.[1] ?? ""}\n\nCTA: ${idea.cta}\nSMS: ${idea.smsCopy}`;
}

export interface IdeateExport {
  apiKey?: string;
  selectedModel?: string;
  ideaBase?: unknown;
  pipeline?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates data copied out of the old IDEAte app (localStorage "bestLifePipelineDBv4"). */
export function parseIdeateExport(text: string): { ideaBase: import("./idea-types").IdeaResource[]; pipeline: PipelineItem[]; apiKey: string; model: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error("That doesn't look like IDEAte data. Paste the exact text copied from the old app.");
  }
  if (!isObj(raw) || (!Array.isArray(raw.ideaBase) && !Array.isArray(raw.pipeline))) {
    throw new Error("No Idea Base or Pipeline found in that data.");
  }
  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const ideaBase = (Array.isArray(raw.ideaBase) ? raw.ideaBase : [])
    .filter((r): r is Record<string, unknown> => isObj(r) && typeof r.id === "string" && typeof r.name === "string")
    .map((r) => ({
      id: r.id as string,
      inputType: (r.inputType === "file" ? "file" : "scratch") as "file" | "scratch",
      name: r.name as string,
      fileName: str(r.fileName) || undefined,
      fileExt: str(r.fileExt) || undefined,
      fileData: str(r.fileData) || undefined,
      sourceType: str(r.sourceType, "Scratch Idea"),
      targetMonth: str(r.targetMonth, "Any"),
      cohort: str(r.cohort, "All Members"),
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      active: r.active !== false,
      dateAdded: str(r.dateAdded, new Date().toISOString()),
      extractedNotes: str(r.extractedNotes),
    }));
  const pipeline = (Array.isArray(raw.pipeline) ? raw.pipeline : [])
    .filter(
      (p): p is Record<string, unknown> =>
        isObj(p) && typeof p.id === "string" && typeof p.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.scheduledDate as string) && isObj(p.ideaData) && typeof (p.ideaData as Record<string, unknown>).title === "string",
    )
    .map((p) => {
      const d = p.ideaData as Record<string, unknown>;
      return {
        id: p.id as string,
        scheduledDate: p.scheduledDate as string,
        status: str(p.status, "Scheduled"),
        ideaData: {
          cardType: str(d.cardType, "Promotional"),
          sourceId: str(d.sourceId) || null,
          title: d.title as string,
          topicSummary: str(d.topicSummary),
          patientAnnouncement: str(d.patientAnnouncement),
          patientIntro: str(d.patientIntro),
          cohort: str(d.cohort, "All Members"),
          offerStrategy: str(d.offerStrategy),
          subjectLines: Array.isArray(d.subjectLines) ? d.subjectLines.filter((x): x is string => typeof x === "string") : [],
          coreOutline: Array.isArray(d.coreOutline) ? d.coreOutline.filter((x): x is string => typeof x === "string") : [],
          cta: str(d.cta),
          smsCopy: str(d.smsCopy),
        },
      } satisfies PipelineItem;
    });
  return { ideaBase, pipeline, apiKey: str(raw.apiKey), model: str(raw.selectedModel) };
}

export const SAMPLE_RESOURCES = (now = Date.now()) => [
  {
    id: "res_seed_doh_01",
    inputType: "scratch" as const,
    name: "Q3 Chronic Care and Copay Waiver Campaign",
    sourceType: "Scratch Idea",
    targetMonth: "September",
    cohort: "All Members",
    tags: ["copay", "chronic-care", "adherence"],
    active: true,
    dateAdded: new Date(now - 86400000 * 5).toISOString(),
    extractedNotes:
      "• Target members with chronic hypertension and diabetes refills.\n• Highlight $0 copay card renewal for 2026.\n• Critical hook: Lapsed members over 45 days can re-order in under 60 seconds with frictionless one-tap SMS.",
  },
  {
    id: "res_seed_flu_02",
    inputType: "scratch" as const,
    name: "Autumn Immunization and Refill Sync Brief",
    sourceType: "Scratch Idea",
    targetMonth: "October",
    cohort: "Lapsed (45+ Days)",
    tags: ["vaccines", "autumn", "sync"],
    active: true,
    dateAdded: new Date(now - 86400000 * 2).toISOString(),
    extractedNotes:
      "• Fall flu shot co-scheduling with regular maintenance meds.\n• Focus on 12k education pool: preventive immunity safeguards adherence.\n• Offer zero-fee home delivery for combination care packages.",
  },
];
