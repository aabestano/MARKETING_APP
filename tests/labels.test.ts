import { test } from "node:test";
import assert from "node:assert/strict";
import { COHORTS, SOURCE_TYPES, type IdeaCard, type IdeaResource, type PipelineItem } from "../lib/idea-types";
import { applyLabelMigration, restoreLegacyLabel } from "../lib/label-migration";
import { parseIdeateExport } from "../lib/pipeline";
import { parseWorkspaceExport } from "../lib/workspace-io";

test("the old cohort and source names are gone from the choices", () => {
  const cohorts = COHORTS.join(" | ");
  const sources = SOURCE_TYPES.join(" | ");
  assert.equal(cohorts.includes("Unactivated") || cohorts.includes("Lapsed") || cohorts.includes("/"), false);
  assert.deepEqual(
    [...COHORTS],
    ["All Members", "Unconverted", "Ordered within the past 90 days", "Ordered more than 90 days ago"],
  );
  assert.equal(sources.includes("Clinical Guide") || sources.includes("DOH Calendar") || sources.includes("Copay Brief"), false);
  assert.ok(SOURCE_TYPES.includes("Health Advisories"));
  assert.ok(SOURCE_TYPES.includes("Program Brief"));
});

test("saved labels are renamed in place, nothing is dropped, and the previous name is kept", () => {
  const before = {
    ideaBase: [
      { id: "a", name: "Guide", sourceType: "Clinical Guide", cohort: "All Members" },
      { id: "b", name: "Brief", sourceType: "Copay Brief", cohort: "Lapsed (45+ Days)" },
      { id: "c", name: "Scratch", sourceType: "Scratch Idea", cohort: "Unactivated (0 Orders)" },
    ] as IdeaResource[],
    pipeline: [{ id: "p", scheduledDate: "2026-10-01", status: "Scheduled", ideaData: { cohort: "Active / Adherent", title: "T" } as IdeaCard, campaign: { cohort: "All Members" } as PipelineItem["campaign"] }] as PipelineItem[],
    generatedIdeas: [{ cohort: "Lapsed" } as IdeaCard],
  };
  const after = applyLabelMigration(before);
  assert.equal(after.ideaBase.length, 3);
  assert.equal(after.ideaBase[0].sourceType, "Health Advisories");
  assert.equal(after.ideaBase[0].legacySourceType, "Clinical Guide");
  assert.equal(after.ideaBase[0].cohort, "All Members");
  assert.equal(after.ideaBase[0].legacyCohort, undefined);
  assert.equal(after.ideaBase[1].sourceType, "Program Brief");
  assert.equal(after.ideaBase[1].cohort, "Ordered more than 90 days ago");
  assert.equal(after.ideaBase[2].sourceType, "Scratch Idea");
  assert.equal(after.ideaBase[2].cohort, "Unconverted");
  assert.equal(after.pipeline[0].ideaData.cohort, "Ordered within the past 90 days");
  assert.equal(after.pipeline[0].ideaData.legacyCohort, "Active / Adherent");
  assert.equal(after.generatedIdeas[0].cohort, "Ordered more than 90 days ago");
  assert.equal(applyLabelMigration(after), after);

  const restored = restoreLegacyLabel(after.ideaBase[0], "sourceType");
  assert.equal(restored.sourceType, "Clinical Guide");
  assert.equal(restored.legacySourceType, undefined);
});

test("old IDEAte pastes and workspace files arrive with the new labels", () => {
  const pasted = parseIdeateExport(
    JSON.stringify({
      ideaBase: [{ id: "r", name: "Advisory", inputType: "scratch", sourceType: "DOH Calendar", cohort: "Active / Adherent" }],
      pipeline: [{ id: "p", scheduledDate: "2026-10-01", ideaData: { title: "T", cohort: "Lapsed (45+ Days)" } }],
    }),
  );
  assert.equal(pasted.ideaBase[0].sourceType, "Health Advisories");
  assert.equal(pasted.ideaBase[0].legacySourceType, "DOH Calendar");
  assert.equal(pasted.ideaBase[0].cohort, "Ordered within the past 90 days");
  assert.equal(pasted.pipeline[0].ideaData.cohort, "Ordered more than 90 days ago");

  const file = parseWorkspaceExport(
    JSON.stringify({
      app: "brand-engine",
      version: 1,
      data: { ideaBase: [{ id: "r", name: "Guide", sourceType: "Clinical Guide", cohort: "All Members" }], pipeline: [] },
    }),
  );
  assert.equal(file.data.ideaBase[0].sourceType, "Health Advisories");
  assert.equal(file.data.ideaBase[0].legacySourceType, "Clinical Guide");
  assert.equal(file.data.ideaBase[0].cohort, "All Members");
});
