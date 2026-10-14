import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCustomOfflineCards, buildIdeaSystemInstruction, buildOfflineFallbackCards, resolveGenMode } from "../lib/idea-gen";
import { CUSTOM_ITEMS_HELPER, ensureGeneratedIdeaIds, isCustomSelectable, mergeGeneratedIdeas, needsAnalysis } from "../lib/idea-rules";
import type { Campaign, IdeaCard } from "../lib/idea-types";
import { POST } from "../app/api/generate-ideas/route";

const idea = (over: Partial<IdeaCard> = {}): IdeaCard => ({
  cardType: "Promotional",
  sourceId: null,
  title: "Title",
  topicSummary: "Summary",
  patientAnnouncement: "Banner",
  patientIntro: "Intro",
  cohort: "All Members",
  offerStrategy: "Offer",
  subjectLines: ["A", "B"],
  coreOutline: ["1"],
  cta: "Order",
  smsCopy: "sms",
  ...over,
});

test("custom selection allows inactive scratch ideas and analyzed files, and blocks unanalyzed files", () => {
  assert.equal(needsAnalysis({ inputType: "file", extractedNotes: "  " }), true);
  assert.equal(needsAnalysis({ inputType: "scratch", extractedNotes: "" }), false);
  assert.equal(isCustomSelectable({ inputType: "scratch", extractedNotes: "", active: false }), true);
  assert.equal(isCustomSelectable({ inputType: "file", extractedNotes: "Ready", active: false }), true);
  assert.equal(isCustomSelectable({ inputType: "file", extractedNotes: "", active: true }), false);
  assert.match(CUSTOM_ITEMS_HELPER, /Choose up to 10/);
});

test("custom mode prompt uses only the provided notes and leaves the other modes alone", () => {
  const resources = [
    { id: "r1", name: "Flu brief", extractedNotes: "Wash hands" },
    { id: "r2", name: "Copay note", extractedNotes: "Zero copay" },
  ];
  const shared = { cohort: "All Members", tone: "Empathetic & Supportive", focusTypes: ["Promotional"], exclusions: { titles: [], sourceIds: [] }, resources };
  const custom = buildIdeaSystemInstruction({ mode: "Custom Items", ...shared });
  assert.match(custom, /MODE: Custom Idea Base Items/);
  assert.match(custom, /only from the AVAILABLE NOTES/);
  assert.match(custom, /\[ID: r1\] Flu brief: Wash hands/);
  assert.match(custom, /\[ID: r2\] Copay note: Zero copay/);
  assert.doesNotMatch(custom, /MODE: Hybrid/);

  const hybrid = buildIdeaSystemInstruction({ mode: "Hybrid", ...shared });
  assert.match(hybrid, /MODE: Hybrid \(Idea Base \+ AI\)/);
  assert.doesNotMatch(hybrid, /Custom Idea Base Items/);

  const pure = buildIdeaSystemInstruction({ mode: "Pure Random", ...shared });
  assert.match(pure, /leave sourceId empty/);
  assert.doesNotMatch(pure, /AVAILABLE NOTES/);
  assert.equal(resolveGenMode("Custom Items"), "Custom Items");
  assert.equal(resolveGenMode("Idea Base Match"), "Idea Base Match");
  assert.equal(resolveGenMode("Pure Random"), "Pure Random");
  assert.equal(resolveGenMode("something else"), "Hybrid");
});

test("offline custom cards round-robin the selected items and standard offline cards stay the same", () => {
  const resources = [
    { id: "a", name: "Flu brief", extractedNotes: "Wash hands" },
    { id: "b", name: "Copay note", extractedNotes: "Zero copay" },
  ];
  const cards = buildCustomOfflineCards("All Members", ["Promotional", "Non-Promotional"], resources);
  assert.equal(cards[0].sourceId, "a");
  assert.equal(cards[1].sourceId, "b");
  assert.match(cards[0].topicSummary, /Flu brief/);
  assert.match(cards[1].topicSummary, /Copay note/);

  const standard = buildOfflineFallbackCards("All Members", ["Promotional", "Non-promotional (Resource)"], "res9");
  assert.equal(standard[0].sourceId, null);
  assert.equal(standard[1].sourceId, "res9");
  assert.doesNotMatch(standard[0].topicSummary, /Built only from/);
});

test("merging generated ideas drops the oldest unscheduled ideas and never drops a scheduled one", () => {
  const existing = Array.from({ length: 8 }, (_, index) => idea({ id: `old-${index}`, generatedAt: 100 + index, title: `Old ${index}` }));
  const incoming = Array.from({ length: 5 }, (_, index) => idea({ title: `New ${index}` }));
  const merged = mergeGeneratedIdeas(existing, incoming, { now: 1000 });
  assert.equal(merged.length, 10);
  assert.deepEqual(
    merged.filter((card) => card.id?.startsWith("old-")).map((card) => card.id).sort(),
    ["old-3", "old-4", "old-5", "old-6", "old-7"],
  );
  assert.equal(merged.filter((card) => card.title.startsWith("New")).length, 5);

  const scheduled = idea({ id: "sched", generatedAt: 1, title: "Scheduled", campaign: { title: "Cached" } as Campaign });
  const open = Array.from({ length: 10 }, (_, index) => idea({ id: `u-${index}`, generatedAt: 10 + index, title: `U ${index}` }));
  const kept = mergeGeneratedIdeas([scheduled, ...open], [idea({ title: "Newest" })], { now: 5000, keepIds: new Set(["sched"]) });
  const savedScheduled = kept.find((card) => card.id === "sched");
  assert.ok(savedScheduled);
  assert.equal(savedScheduled?.campaign?.title, "Cached");
  const unscheduled = kept.filter((card) => card.id !== "sched");
  assert.equal(unscheduled.length, 10);
  assert.equal(unscheduled.some((card) => card.id === "u-0"), false);
  assert.equal(kept.length, 11);
});

test("ideas saved without an id or time still receive both, and older array positions stay older", () => {
  const stamped = ensureGeneratedIdeaIds([idea({ title: "First" }), idea({ title: "Second", id: "keep" })], 10_000);
  assert.ok(stamped[0].id);
  assert.equal(stamped[1].id, "keep");
  assert.ok((stamped[0].generatedAt ?? 0) < (stamped[1].generatedAt ?? 0));
  assert.equal(ensureGeneratedIdeaIds(stamped, 99_000), stamped);
});

test("custom idea generation rejects an empty selection and unanalyzed files", async () => {
  const request = (body: unknown) =>
    POST(new Request("http://local/api/generate-ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const empty = await request({ mode: "Custom Items", focusTypes: ["Promotional"], resources: [] });
  assert.equal(empty.status, 400);
  const unanalyzed = await request({
    mode: "Custom Items",
    focusTypes: ["Promotional"],
    resources: [{ id: "file-1", name: "Scan", extractedNotes: "  " }],
  });
  assert.equal(unanalyzed.status, 400);
});
