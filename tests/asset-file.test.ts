import { test } from "node:test";
import assert from "node:assert/strict";
import { assetFile, assetPreviewKind, parseDataUrl, templateMode } from "../lib/asset-file";
import type { BrandAsset } from "../lib/types";

const base = { id: "a", bookId: "b", name: "file", purposes: ["email"], createdAt: 1 } satisfies Partial<BrandAsset>;

test("preview kind follows the file, and fonts stay download only", () => {
  assert.equal(assetPreviewKind({ ...base, kind: "pdf", dataUrl: "data:application/pdf;base64,QQ==" }), "pdf");
  assert.equal(assetPreviewKind({ ...base, kind: "image", dataUrl: "data:image/png;base64,QQ==" }), "image");
  assert.equal(assetPreviewKind({ ...base, kind: "cdn-url", url: "https://cdn.example/logo.png" }), "image");
  assert.equal(assetPreviewKind({ ...base, kind: "template", text: "Hello" }), "template");
  assert.equal(assetPreviewKind({ ...base, kind: "font", dataUrl: "data:font/ttf;base64,QQ==" }), null);
  assert.equal(assetPreviewKind({ ...base, kind: "cdn-url", url: "https://cdn.example/guide.pdf" }), null);
  assert.equal(assetPreviewKind({ ...base, kind: "template", text: "  " }), null);
});

test("template mode separates email markup from plain text", () => {
  assert.equal(templateMode("note.mjml", "hello"), "mjml");
  assert.equal(templateMode("note.txt", "<mj-text>Hi</mj-text>"), "mjml");
  assert.equal(templateMode("mail.html", "plain"), "html");
  assert.equal(templateMode("mail.txt", "<p>Hi</p>"), "html");
  assert.equal(templateMode("mail.txt", "Just words"), "text");
});

test("uploaded files decode to bytes and keep their names", () => {
  const pdf = assetFile({ ...base, kind: "pdf", name: "Guide.pdf", mime: "application/pdf", dataUrl: "data:application/pdf;base64,JVBERg==" });
  assert.equal(pdf?.filename, "Guide.pdf");
  assert.equal(pdf?.mime, "application/pdf");
  assert.equal(Buffer.from(pdf!.bytes).toString(), "%PDF");

  const text = assetFile({ ...base, kind: "template", name: "Notes", mime: "text/plain", text: "Hello" });
  assert.equal(text?.filename, "Notes.txt");
  assert.equal(Buffer.from(text!.bytes).toString(), "Hello");

  assert.equal(assetFile({ ...base, kind: "cdn-url", name: "Logo" }), null);
  assert.deepEqual(parseDataUrl("nope"), null);
});
