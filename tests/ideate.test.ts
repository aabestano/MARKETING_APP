import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthGrid, getExclusions, localDateStr, parseIdeateExport, pipelineToCsv, pipelineToIcs, syncLifecycle } from "../lib/pipeline";
import { buildOfflineFallbackCards, sanitizeIdeaCards, buildIdeaSystemInstruction } from "../lib/idea-gen";
import { blankCampaign, buildEmailBlueprint, buildStandaloneHtmlPrompt, campaignFromIdea, tableMatrix } from "../lib/campaign";
import { detectBlueprintSections } from "../lib/prompt";
import { parseBlocks } from "../lib/blocks";
import type { IdeaCard, PipelineItem } from "../lib/idea-types";

const idea = (over: Partial<IdeaCard> = {}): IdeaCard => ({
  cardType: "Promotional",
  sourceId: "res1",
  title: 'Copay "Card", refill',
  topicSummary: "Line one\nline two",
  patientAnnouncement: "Banner",
  patientIntro: "Intro line.\n\nSecond line:",
  cohort: "All Members",
  offerStrategy: "x",
  subjectLines: ["A", "B"],
  coreOutline: ["1", "2", "3"],
  cta: "Order now",
  smsCopy: "sms",
  ...over,
});
const item = (id: string, date: string, status = "Scheduled", over: Partial<IdeaCard> = {}): PipelineItem => ({ id, scheduledDate: date, status, ideaData: idea(over) });

test("local date string uses the local calendar day", () => {
  assert.equal(localDateStr(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("past scheduled items are released, completed ones are untouched, identity kept when unchanged", () => {
  const items = [item("a", "2026-01-01"), item("b", "2026-01-01", "Completed"), item("c", "2026-02-01")];
  const next = syncLifecycle(items, "2026-01-15");
  assert.equal(next[0].status, "Past Date (Released)");
  assert.equal(next[1].status, "Completed");
  assert.equal(next[2].status, "Scheduled");
  assert.equal(syncLifecycle(next, "2026-01-15"), next);
});

test("exclusions only cover upcoming items", () => {
  const items = [item("a", "2026-01-01", "Scheduled", { title: "Old", sourceId: "x" }), item("b", "2026-03-01", "Scheduled", { title: "New", sourceId: "y" })];
  assert.deepEqual(getExclusions(items, "2026-02-01"), { titles: ["New"], sourceIds: ["y"] });
});

test("month grid starts on Sunday and pads to whole weeks", () => {
  const cells = buildMonthGrid(2026, 9, [item("a", "2026-10-12")], "2026-10-12"); // Oct 2026 starts on Thursday
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.findIndex((c) => c.day === 1), 4);
  const day = cells.find((c) => c.date === "2026-10-12");
  assert.equal(day?.items.length, 1);
  assert.equal(day?.isToday, true);
  assert.equal(cells.filter((c) => c.day).length, 31);
});

test("CSV escapes quotes and keeps the IDEAte columns", () => {
  const csv = pipelineToCsv([item("a", "2026-01-01")]);
  assert.equal(csv.split("\n")[0], "Task Name,Start Date,Description,Focus,Cohort,Status");
  assert.match(csv, /"Copay ""Card"", refill"/);
});

test("iCal has one all-day event per item and escapes text", () => {
  const ics = pipelineToIcs([item("a", "2026-01-01"), item("b", "2026-01-02", "Completed")]);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20260101/);
  assert.match(ics, /STATUS:COMPLETED/);
  assert.match(ics, /Copay "Card"\\, refill/);
});

test("offline cards match requested focus types", () => {
  const cards = buildOfflineFallbackCards("Ordered more than 90 days ago", ["Promotional", "Non-promotional (Resource)"], "res9");
  assert.deepEqual(cards.map((c) => c.cardType), ["Promotional", "Non-promotional (Resource)"]);
  assert.equal(cards[1].sourceId, "res9");
  assert.ok(cards.every((c) => c.cohort === "Ordered more than 90 days ago"));
});

test("sanitizing model ideas enforces SMS length, valid source ids and drops untitled cards", () => {
  const long = "x".repeat(300);
  const cards = sanitizeIdeaCards(
    [{ title: "T", smsCopy: long, sourceId: "ghost", subjectLines: ["a", 5, "b"] }, { title: "" }, "junk"],
    { cohort: "All Members", focusTypes: ["Promotional"], validSourceIds: new Set(["real"]) },
  );
  assert.equal(cards.length, 1);
  assert.ok(cards[0].smsCopy.length <= 160);
  assert.equal(cards[0].sourceId, null);
  assert.deepEqual(cards[0].subjectLines, ["a", "b"]);
  assert.equal(cards[0].cardType, "Promotional");
});

test("generation prompt carries mode, exclusions and notes", () => {
  const p = buildIdeaSystemInstruction({
    mode: "Idea Base Match",
    cohort: "All Members",
    tone: "Urgent & Savings-Driven",
    focusTypes: ["Promotional"],
    exclusions: { titles: ["Dup Title"], sourceIds: [] },
    resources: [{ id: "r1", name: "Note", extractedNotes: "bullets" }],
  });
  assert.match(p, /Idea Base Match/);
  assert.match(p, /more than 90 days ago/);
  assert.match(p, /DO NOT DUPLICATE\): Dup Title/);
  assert.match(p, /\[ID: r1\] Note: bullets/);
  assert.match(p, /exactly 1 campaign/);
});

test("IDEAte export parses, normalizes and rejects bad input", () => {
  const raw = JSON.stringify({
    apiKey: "k",
    selectedModel: "m",
    ideaBase: [{ id: "r1", name: "N", tags: ["a"], active: false }, { nope: 1 }],
    pipeline: [{ id: "p1", scheduledDate: "2026-05-01", ideaData: { title: "T", cardType: "Promotional" } }, { id: "bad", scheduledDate: "May 1", ideaData: { title: "x" } }],
  });
  const out = parseIdeateExport(raw);
  assert.equal(out.ideaBase.length, 1);
  assert.equal(out.ideaBase[0].active, false);
  assert.equal(out.ideaBase[0].inputType, "scratch");
  assert.equal(out.pipeline.length, 1);
  assert.equal(out.pipeline[0].status, "Scheduled");
  assert.equal(out.apiKey, "k");
  assert.throws(() => parseIdeateExport("nope"), /IDEAte data/);
  assert.throws(() => parseIdeateExport("{}"), /No Idea Base/);
});

test("campaign from idea applies IDEAte's Content Studio defaults", () => {
  const c = campaignFromIdea(idea());
  assert.equal(c.email.heroHeadline, 'Copay "Card", refill');
  assert.equal(c.email.announcement, "Banner");
  assert.ok(c.email.introBody.startsWith("Hi *|FNAME|*,\n\nIntro line."));
  assert.equal(c.email.tableEnabled, true);
  assert.equal(c.ctaLabel, "Order now");
  assert.equal(campaignFromIdea(idea({ title: "Flu season", cardType: "Non-Promotional" })).email.tableEnabled, false);
  assert.match(c.poster.stepsText, /Access your account ::/);
});

test("table matrix resizes while keeping entered cells", () => {
  const t = tableMatrix(4, 2, { headers: ["H1", "H2", "H3"], rows: [["a", "b", "c"]] });
  assert.equal(t.headers.length, 4);
  assert.equal(t.headers[0], "H1");
  assert.equal(t.rows[0][0], "a");
  assert.equal(t.rows.length, 2);
});

test("email blueprint contains all 11 sections and the Email Designer detects them", () => {
  const c = blankCampaign();
  c.email.tableEnabled = true;
  const bp = buildEmailBlueprint(c);
  const detected = detectBlueprintSections(bp);
  assert.equal(detected.length, 11, detected.join(","));
  assert.match(bp, /2-Column Co-Branded Header/);
  assert.match(bp, /\[Order Your Medicines on ForwardMG\]\(https:\/\/forwardmg\.ph\)/);
  assert.match(bp, /Rosuvastatin 10mg Tablet \| ₱ 18 \| ₱ 5/);
});

test("standalone HTML prompt keeps the original token list and campaign data", () => {
  const p = buildStandaloneHtmlPrompt(blankCampaign());
  for (const t of ["BRAND_PRIMARY_COLOR", "BRAND_CARD_BG", "BRAND_BORDER_RADIUS", "BRAND_FONT_FAMILY"]) assert.match(p, new RegExp(`{{${t}}}`));
  assert.match(p, /Header Layout Directive: 2-Column Co-Branded Header/);
  assert.match(p, /Generate ONLY the complete/);
  void parseBlocks;
});

import { analysisMode, MAX_ANALYZE_BYTES } from "../lib/resource-files";
import { MAX_RESOURCE_FILE_BYTES } from "../lib/idea-types";
import { syncLifecycle as syncForLink } from "../lib/pipeline";

test("Idea Base stores up to 25 MB but AI analysis stays within the request limit", () => {
  assert.equal(MAX_RESOURCE_FILE_BYTES, 25 * 1024 * 1024);
  assert.equal(analysisMode("pdf", 1_000_000), "send");
  assert.equal(analysisMode("pdf", MAX_ANALYZE_BYTES + 1), "too-large");
  assert.equal(analysisMode("PNG", 10_000_000), "shrink");
  assert.equal(analysisMode("jpg", 100_000), "send");
  assert.equal(analysisMode("txt", 100), "unsupported");
  assert.equal(analysisMode(undefined, 100), "unsupported");
});

test("syncLifecycle keeps linked design ids", () => {
  const item = { id: "p", scheduledDate: "2000-01-01", status: "Scheduled", ideaData: {} as never, blastIds: ["b1"], posterIds: ["x"] };
  const [next] = syncForLink([item], "2026-01-01");
  assert.deepEqual(next.blastIds, ["b1"]);
  assert.deepEqual(next.posterIds, ["x"]);
});
