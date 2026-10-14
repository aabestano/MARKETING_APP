import { test } from "node:test";
import assert from "node:assert/strict";
import { assetForBook, designsForBook, matchesBrandBook, selectedCreateBookId, toggleSharedBook } from "../lib/brand-scope";
import { clearEdgeWhite } from "../lib/poster-trim";
import { cleanCopyText, uiCopy } from "../lib/ui-copy";
import { copyColorToBrandTokens, emailContrastWarnings } from "../lib/email-colors";

test("brand scope keeps all-book files and hides a file tagged to another book", () => {
  assert.equal(matchesBrandBook(undefined, "book-a"), true);
  assert.equal(matchesBrandBook("all", "book-a"), true);
  assert.equal(matchesBrandBook("book-a", "book-a"), true);
  assert.equal(matchesBrandBook("book-b", "book-a"), false);
  assert.equal(matchesBrandBook("book-b", null), true);
  assert.equal(selectedCreateBookId(null, "book-a"), null);
  assert.equal(selectedCreateBookId(undefined, "book-a"), "book-a");
  assert.equal(selectedCreateBookId("book-b", "book-a"), "book-b");
});

test("assets without the new flag stay available, and an explicit false stays on its book", () => {
  assert.equal(assetForBook({ bookId: "home" }, "other"), true);
  assert.equal(assetForBook({ bookId: "home", sharedWithAll: true }, "other"), true);
  assert.equal(assetForBook({ bookId: "home", sharedWithAll: false }, "other"), false);
  assert.equal(assetForBook({ bookId: "home", sharedWithAll: false }, "home"), true);
});

test("saved designs are listed only on the brand books they were added to", () => {
  const designs = [{ id: "p", sharedBookIds: ["a"] }, { id: "e", sharedBookIds: ["b", "a"] }, { id: "solo" }];
  assert.deepEqual(designsForBook(designs, "a").map((item) => item.id), ["p", "e"]);
  assert.deepEqual(toggleSharedBook(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(toggleSharedBook(["a", "b"], "a", false), ["b"]);
});

test("edge white becomes transparent and enclosed white stays", () => {
  const width = 5;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const paint = (x: number, y: number, r: number, g: number, b: number) => {
    const index = (y * width + x) * 4;
    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = 255;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) paint(x, y, 255, 255, 255);
  }
  for (let x = 1; x <= 3; x++) {
    paint(x, 1, 1, 80, 200);
    paint(x, 3, 1, 80, 200);
  }
  paint(1, 2, 1, 80, 200);
  paint(3, 2, 1, 80, 200);
  paint(2, 2, 255, 255, 255);
  clearEdgeWhite(pixels, width, height);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[((2 * width + 2) * 4) + 3], 255);
  assert.equal(pixels[((1 * width + 1) * 4) + 3], 255);
});

test("interface text falls back when blank and slices long overrides", () => {
  assert.equal(uiCopy("nav.plan", undefined), "Plan");
  assert.equal(uiCopy("nav.plan", { "nav.plan": "   " }), "Plan");
  assert.equal(uiCopy("nav.plan", { "nav.plan": "  Studio  " }), "Studio");
  assert.equal(cleanCopyText("a".repeat(200), 120).length, 120);
  assert.equal(uiCopy("repo.hint", { "repo.hint": "x".repeat(400) }).length, 280);
});

test("email copy fills token fields and contrast stays a warning", () => {
  const next = copyColorToBrandTokens({ fontFamily: "Poppins", primary: "#0150C8" }, "#112233");
  assert.equal(next.primary, "#112233");
  assert.equal(next.textColor, "#112233");
  assert.equal(next.fontFamily, "Poppins");
  const notes = emailContrastWarnings({ textColor: "#ffffff", canvasBg: "#ffffff", containerBg: "#ffffff", mutedColor: "#ffffff", accent: "#ffffff" });
  assert.ok(notes.length > 0);
  assert.equal(emailContrastWarnings({ textColor: "#111111", canvasBg: "#ffffff", containerBg: "#ffffff", mutedColor: "#333333", accent: "#0150C8" }).length, 0);
});
