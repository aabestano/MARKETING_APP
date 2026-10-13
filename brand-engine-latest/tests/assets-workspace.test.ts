import { test } from "node:test";
import assert from "node:assert/strict";
import { assetInFolder, normalizePurposes, togglePurpose } from "../lib/assets";
import { applyImport, buildExport, parseWorkspaceExport } from "../lib/workspace-io";
import type { BrandAsset, BrandBook, SavedBlast, Settings } from "../lib/types";

const asset = (id: string, bookId: string, purposes?: unknown): BrandAsset =>
  ({ id, bookId, kind: "image", name: id, purposes, createdAt: 1 }) as BrandAsset;
const book = (id: string): BrandBook => ({ id, name: id, createdAt: 1 });
const blast = (id: string): SavedBlast =>
  ({ id, name: id, subject: "", category: "Promotional", brandBookId: null, brandBookName: "", mjml: "", html: "<p/>", blueprint: "", createdAt: 1, updatedAt: 1 });
const settings: Settings = {
  geminiApiKey: "SECRET-G",
  geminiModel: "m",
  mailerProvider: "resend",
  mailerApiKey: "SECRET-M",
  fromName: "n",
  fromEmail: "e@x.com",
  testRecipient: "t@x.com",
};

test("untagged or invalid purposes default to Email Design", () => {
  assert.deepEqual(normalizePurposes(undefined), ["email"]);
  assert.deepEqual(normalizePurposes([]), ["email"]);
  assert.deepEqual(normalizePurposes(["nope"]), ["email"]);
  assert.deepEqual(normalizePurposes(["poster", "email", "poster"]), ["email", "poster"]);
});

test("toggling never leaves an asset with no purpose", () => {
  assert.deepEqual(togglePurpose(["email"], "email"), ["email"]);
  assert.deepEqual(togglePurpose(["email"], "poster"), ["email", "poster"]);
  assert.deepEqual(togglePurpose(["email", "poster"], "email"), ["poster"]);
  assert.deepEqual(togglePurpose(["poster"], "poster"), ["poster"]);
});

test("folders: both-tagged assets appear in each folder, All shows everything", () => {
  const both = { purposes: ["email", "poster"] as const };
  assert.ok(assetInFolder({ purposes: [...both.purposes] }, "email"));
  assert.ok(assetInFolder({ purposes: [...both.purposes] }, "poster"));
  assert.ok(!assetInFolder({ purposes: ["poster"] }, "email"));
  assert.ok(assetInFolder({ purposes: ["poster"] }, "all"));
});

test("export omits API keys and round-trips through parse", () => {
  const out = buildExport({ brandBooks: [book("b1")], assets: [asset("a1", "b1", ["poster"])], blasts: [blast("x")], settings, theme: "light" });
  const text = JSON.stringify(out);
  assert.ok(!text.includes("SECRET-G") && !text.includes("SECRET-M"));
  const parsed = parseWorkspaceExport(text);
  assert.equal(parsed.data.assets[0].purposes[0], "poster");
  assert.equal(parsed.data.theme, "light");
  assert.equal(parsed.data.blasts.length, 1);
  assert.deepEqual(parsed.data.pipeline, []);
});

test("import tags legacy assets without purposes as Email Design", () => {
  const legacy = JSON.stringify({ app: "brand-engine", version: 1, data: { brandBooks: [book("b1")], assets: [asset("a1", "b1")], blasts: [] } });
  assert.deepEqual(parseWorkspaceExport(legacy).data.assets[0].purposes, ["email"]);
});

test("import rejects foreign or malformed files", () => {
  assert.throws(() => parseWorkspaceExport("not json"), /valid JSON/);
  assert.throws(() => parseWorkspaceExport(JSON.stringify({ hello: 1 })), /isn't a Brand Engine/);
  assert.throws(() => parseWorkspaceExport(JSON.stringify({ app: "brand-engine", version: 99, data: {} })), /newer version/);
});

test("merge adds and updates by id; replace swaps everything; orphan assets are dropped on merge", () => {
  const current = { brandBooks: [book("b1")], assets: [asset("a1", "b1", ["email"])], blasts: [blast("x")], posters: [], ideaBase: [], pipeline: [] };
  const incoming = {
    brandBooks: [book("b2")],
    assets: [asset("a1", "b1", ["poster"]), asset("a2", "b2", ["email"]), asset("orphan", "missing", ["email"])],
    blasts: [blast("y")],
    posters: [],
    ideaBase: [],
    pipeline: [],
    settings: {} as never,
    theme: "dark" as const,
  };
  const merged = applyImport(current, incoming, "merge");
  assert.deepEqual(merged.brandBooks.map((b) => b.id).sort(), ["b1", "b2"]);
  assert.deepEqual(merged.assets.map((a) => a.id).sort(), ["a1", "a2"]);
  assert.deepEqual(merged.assets.find((a) => a.id === "a1")?.purposes, ["poster"]);
  assert.equal(merged.blasts.length, 2);
  const replaced = applyImport(current, incoming, "replace");
  assert.deepEqual(replaced.brandBooks.map((b) => b.id), ["b2"]);
  assert.equal(replaced.blasts.length, 1);
});

test("export and merge carry posters, idea base and calendar items", () => {
  const poster = { id: "p1", name: "P", spec: { version: 1 }, size: { width: 1 }, createdAt: 1, updatedAt: 1 } as never;
  const res = { id: "r1", name: "R", inputType: "scratch" } as never;
  const pipe = { id: "i1", scheduledDate: "2026-01-01", status: "Scheduled", ideaData: { title: "T" } } as never;
  const out = buildExport({ brandBooks: [], assets: [], blasts: [], posters: [poster], ideaBase: [res], pipeline: [pipe], settings, theme: "dark" });
  const parsed = parseWorkspaceExport(JSON.stringify(out));
  assert.equal(parsed.data.posters.length, 1);
  assert.equal(parsed.data.ideaBase.length, 1);
  assert.equal(parsed.data.pipeline.length, 1);
  const merged = applyImport({ brandBooks: [], assets: [], blasts: [], posters: [], ideaBase: [res], pipeline: [] }, parsed.data, "merge");
  assert.equal(merged.ideaBase.length, 1);
  assert.equal(merged.pipeline.length, 1);
  assert.equal(merged.posters.length, 1);
});
