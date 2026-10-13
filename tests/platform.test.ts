import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_NAME, displayAppName } from "../lib/app-name";
import { moveTab, orderedTabIds } from "../lib/nav";
import { pipelineToIcs } from "../lib/pipeline";
import { escapeXml, layerId, posterLayerName } from "../lib/poster-svg";
import { buildExport, parseWorkspaceExport } from "../lib/workspace-io";
import type { PosterSpec } from "../lib/poster-types";
import type { Settings } from "../lib/types";

const settings = {
  geminiApiKey: "SECRET-G",
  geminiModel: "m",
  mailerProvider: "resend",
  mailerApiKey: "SECRET-M",
  fluxApiKey: "SECRET-F",
  fromName: "n",
  fromEmail: "e@x.com",
  testRecipient: "t@x.com",
  displayName: "  Studio   Nine ",
  tabOrder: { create: ["design-studio", "nope", "idea-studio"] },
} as Settings;

const spec = {
  version: 1,
  theme: { background: "#fff", surface: "#fff", text: "#111", muted: "#666", primary: "#0150C8", accent: "#E0610C", onPrimary: "#fff" },
  header: { brandName: "Maxicare" },
  headline: "Heat",
  sections: [{ type: "tips", title: "Stay cool", items: [{ text: "Drink water", icon: "drop" }] }],
} satisfies PosterSpec;

test("display name falls back to IDEAte and stays within 40 characters", () => {
  assert.equal(displayAppName(undefined), APP_NAME);
  assert.equal(displayAppName("   "), APP_NAME);
  assert.equal(displayAppName("  Studio   Nine "), "Studio Nine");
  assert.equal(displayAppName("x".repeat(80)).length, 40);
});

test("subtab order stays inside its section and missing tabs are appended", () => {
  assert.deepEqual(orderedTabIds("create", { create: ["design-studio", "idea-studio", "nope" as never, "idea-studio"] }), [
    "design-studio",
    "idea-studio",
    "idea-generator",
  ]);
  assert.deepEqual(orderedTabIds("plan", { plan: ["repository", "idea-studio", "calendar"] }), ["repository", "calendar"]);
  assert.deepEqual(orderedTabIds("library", undefined), ["idea-base", "brands"]);
  assert.deepEqual(moveTab(["idea-studio", "idea-generator", "design-studio"], "idea-generator", -1), [
    "idea-generator",
    "idea-studio",
    "design-studio",
  ]);
  const pinned = ["calendar", "repository"] as const;
  assert.equal(moveTab([...pinned], "calendar", -1).join(), pinned.join());
});

test("workspace export keeps the app name and tab order, and still omits API keys", () => {
  const out = buildExport({ brandBooks: [], assets: [], blasts: [], settings, theme: "dark" });
  const text = JSON.stringify(out);
  assert.ok(!text.includes("SECRET-G") && !text.includes("SECRET-M") && !text.includes("SECRET-F"));
  assert.equal(out.data.settings.displayName, "  Studio   Nine ");
  const parsed = parseWorkspaceExport(text);
  assert.equal(parsed.data.settings.displayName, "Studio Nine");
  assert.deepEqual(parsed.data.settings.tabOrder?.create, ["design-studio", "idea-studio", "idea-generator"]);
  assert.equal("geminiApiKey" in parsed.data.settings, false);
});

test("older exports still import, and a bad tab list cannot move a tab into another section", () => {
  const legacy = parseWorkspaceExport(JSON.stringify({ app: "brand-engine", version: 1, data: { brandBooks: [], assets: [], blasts: [] } }));
  assert.equal(legacy.data.settings.displayName, undefined);
  assert.equal(legacy.data.settings.tabOrder, undefined);
  const messy = parseWorkspaceExport(
    JSON.stringify({
      app: "brand-engine",
      version: 1,
      data: { settings: { displayName: "  Hello   there  ", tabOrder: { plan: ["repository", "brands", "calendar"], nope: [1] }, geminiApiKey: "SECRET-G" } },
    }),
  );
  assert.equal(messy.data.settings.displayName, "Hello there");
  assert.deepEqual(messy.data.settings.tabOrder?.plan, ["repository", "calendar"]);
  assert.equal(messy.data.settings.tabOrder?.library, undefined);
  assert.equal("geminiApiKey" in messy.data.settings, false);
  assert.throws(() => parseWorkspaceExport(JSON.stringify({ hello: 1 })), /isn't an IDEAte/);
  assert.throws(() => parseWorkspaceExport(JSON.stringify({ hello: 1 }), "Studio Nine"), /isn't an Studio Nine/);
});

test("calendar product id uses the display name and still defaults to IDEAte", () => {
  assert.match(pipelineToIcs([]), /PRODID:-\/\/IDEAte\/\/Best Life Pipeline\/\/EN/);
  assert.match(pipelineToIcs([], "Studio Nine"), /PRODID:-\/\/Studio Nine\/\/Best Life Pipeline\/\/EN/);
});

test("Figma layer ids are readable and XML-safe", () => {
  assert.equal(posterLayerName(spec, "headline"), "Headline");
  assert.equal(posterLayerName(spec, "illustration"), "Hero illustration");
  assert.equal(posterLayerName(spec, "section:0"), "Tip grid: Stay cool");
  assert.equal(posterLayerName(spec, "button"), "Button");
  assert.equal(posterLayerName(spec, "qr"), "QR code");
  const used = new Set<string>();
  assert.equal(layerId("Hero illustration", used), "Hero-illustration");
  assert.equal(layerId("Hero illustration", used), "Hero-illustration-2");
  assert.equal(layerId("QR code", used), "QR-code");
  assert.equal(layerId("9 lives", used), "Layer-9-lives");
  assert.equal(escapeXml(`a & b <c> "d"`), "a &amp; b &lt;c&gt; &quot;d&quot;");
});
