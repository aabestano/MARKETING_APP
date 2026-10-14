/** The name users see when they have not set their own. */
export const APP_NAME = "IDEAte";

/** Cap for a name typed in Settings. Keeps the sidebar and calendar product id short. */
export const APP_NAME_LIMIT = 40;

/** Blank, whitespace, or missing overrides fall back to IDEAte. */
export function displayAppName(override?: string | null): string {
  const cleaned = (override ?? "").trim().replace(/\s+/g, " ").slice(0, APP_NAME_LIMIT).trim();
  return cleaned || APP_NAME;
}
