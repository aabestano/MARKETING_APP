import { useStore } from "./store";
import type { SavedBlast } from "./types";
import type { SavedPoster } from "./poster-types";

/** Loads a saved poster into the Poster Illustrator for further editing. */
export function openSavedPoster(p: SavedPoster) {
  const s = useStore.getState();
  s.updatePoster({
    prompt: p.prompt,
    spec: p.spec,
    size: p.size,
    source: "manual",
    warnings: [],
    savedId: p.id,
    pipelineId: null,
    removeBackground: !!p.removeBackground,
  });
  if (p.brandBookId) s.updateWorkspace({ brandBookId: p.brandBookId });
  s.setDesignMode("poster");
  s.setTab("design-studio");
}

/** Loads a saved email into the Email Designer for further editing. */
export function openSavedBlast(b: SavedBlast) {
  const s = useStore.getState();
  s.updateWorkspace({
    blueprint: b.blueprint,
    mjml: b.mjml,
    html: b.html,
    brandBookId: b.brandBookId,
    source: "manual",
    warnings: [],
    viewMode: "preview",
    pipelineId: null,
  });
  s.setDesignMode("email");
  s.setTab("design-studio");
}
