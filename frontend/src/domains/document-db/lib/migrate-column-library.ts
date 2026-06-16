import { importColumnTemplates } from "../api/column-templates.api";
import type { ColumnTemplate, ColumnTemplateInput } from "../model/types";

/**
 * One-time migration of the legacy localStorage Column Library to the server.
 *
 * Reads the old `tabular-review-column-library` key, bulk-imports it via the
 * `:import` API, then sets a migrated flag. The old key is NOT deleted (kept as
 * a recovery copy; the flag prevents re-import). Known limitation: with no auth,
 * each browser migrates independently → duplicates possible across users
 * (manual delete in the modal; idempotent import is a follow-up).
 */

const LEGACY_KEY = "tabular-review-column-library";
const MIGRATED_KEY = "tabular-review-column-library-migrated";

let ranThisSession = false; // guards React StrictMode double-invoke in dev

export async function migrateLocalColumnLibrary(): Promise<number> {
  if (ranThisSession || typeof window === "undefined") return 0;
  ranThisSession = true;

  if (localStorage.getItem(MIGRATED_KEY)) return 0;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, "1"); // nothing to migrate; don't re-check
    return 0;
  }

  let templates: ColumnTemplate[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.templates)) templates = parsed.templates;
  } catch {
    localStorage.setItem(MIGRATED_KEY, "1"); // corrupt legacy data; skip permanently
    return 0;
  }

  if (templates.length === 0) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return 0;
  }

  const inputs: ColumnTemplateInput[] = templates.map((t) => ({
    name: t.name,
    type: t.type,
    prompt: t.prompt,
    category: t.category,
  }));
  // On failure the flag is NOT set → retried on next load (safe; one transaction).
  const created = await importColumnTemplates(inputs);
  localStorage.setItem(MIGRATED_KEY, "1");
  return created.length;
}
