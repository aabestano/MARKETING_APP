import assert from "node:assert/strict";
import test from "node:test";
import { GUIDE_KEYS, GUIDE_SEGMENTS, WORKSPACE_DRIVE_URL } from "../lib/how-to";

test("the guide covers setup, plan, create, and library", () => {
  assert.deepEqual(
    GUIDE_SEGMENTS.map((segment) => segment.id),
    ["setup", "plan", "create", "library"],
  );
  const titles = GUIDE_SEGMENTS.flatMap((segment) => segment.cards.map((card) => card.title));
  for (const title of ["API and Mail Settings", "Calendar", "Idea Generator", "Idea Studio", "Design Studio", "Idea Base", "Brand Books", "Design Repository"]) {
    assert.ok(titles.includes(title), title);
  }
  for (const card of GUIDE_SEGMENTS.flatMap((segment) => segment.cards)) {
    const count = card.groups.reduce((sum, group) => sum + group.items.length, 0);
    if (card.id !== "keys") assert.ok(count > 0, card.title);
  }
});

test("shared setup names the three key fields and the workspace folder", () => {
  assert.deepEqual(
    GUIDE_KEYS.map((key) => key.id),
    ["gemini", "fal", "resend"],
  );
  assert.ok(GUIDE_KEYS.every((key) => key.where.length > 0 && key.powers.length > 0));
  assert.equal(WORKSPACE_DRIVE_URL, "https://drive.google.com/drive/folders/1Wc7G4TQ8owuQKwJZpxNqQF5lKvBmFrnF?usp=drive_link");
});
