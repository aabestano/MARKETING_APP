import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLUX_MODEL, fluxImageSize, friendlyFluxError, normalizeFluxModel, parseFluxResponse } from "../lib/flux";
import { buildExport } from "../lib/workspace-io";

test("normalizeFluxModel accepts model paths and fal URLs, and rejects anything odd", () => {
  assert.equal(normalizeFluxModel("fal-ai/flux/dev"), "fal-ai/flux/dev");
  assert.equal(normalizeFluxModel("https://fal.run/fal-ai/flux-pro/v1.1"), "fal-ai/flux-pro/v1.1");
  assert.equal(normalizeFluxModel("https://fal.ai/models/fal-ai/flux/schnell"), "fal-ai/flux/schnell");
  assert.equal(normalizeFluxModel(""), DEFAULT_FLUX_MODEL);
  assert.equal(normalizeFluxModel("../../etc/passwd"), DEFAULT_FLUX_MODEL);
  assert.equal(normalizeFluxModel("fal-ai/"), DEFAULT_FLUX_MODEL);
});

test("fluxImageSize maps aspect ratios", () => {
  assert.equal(fluxImageSize("4:3"), "landscape_4_3");
  assert.equal(fluxImageSize("1:1"), "square_hd");
  assert.equal(fluxImageSize(undefined), "square_hd");
});

test("parseFluxResponse only trusts fal-hosted https images", () => {
  assert.equal(parseFluxResponse({ images: [{ url: "https://v3.fal.media/files/a.png" }] }), "https://v3.fal.media/files/a.png");
  assert.throws(() => parseFluxResponse({ images: [{ url: "https://evil.example.com/a.png" }] }), /unexpected host/);
  assert.throws(() => parseFluxResponse({ images: [{ url: "http://v3.fal.media/a.png" }] }), /unexpected host/);
  assert.throws(() => parseFluxResponse({ images: [{ url: "https://fal.media.evil.com/a.png" }] }), /unexpected host/);
  assert.throws(() => parseFluxResponse({}), /no image/);
});

test("friendlyFluxError explains the common failures", () => {
  assert.match(friendlyFluxError(401), /rejected the API key/);
  assert.match(friendlyFluxError(402), /credit/);
  assert.match(friendlyFluxError(429), /rate-limiting/);
});

test("workspace export never contains any API key", () => {
  const out = buildExport({
    brandBooks: [],
    assets: [],
    blasts: [],
    settings: { geminiApiKey: "g", mailerApiKey: "m", fluxApiKey: "f", geminiModel: "x", mailerProvider: "resend", fromName: "", fromEmail: "", testRecipient: "", imageProvider: "flux" },
    theme: "dark",
  });
  const text = JSON.stringify(out);
  assert.ok(!text.includes('"g"') && !text.includes('"m"') && !text.includes('"f"'));
  assert.ok(text.includes("imageProvider"));
});
