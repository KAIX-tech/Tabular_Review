#!/usr/bin/env node
/**
 * FSD dependency-rule checker.
 *
 * Enforces: app → domains → widgets → features → shared (top imports lower only).
 * Same-layer cross-slice imports must go through the slice Public API (index.ts),
 * never deep internal paths.
 *
 * Run: node scripts/check-fsd-imports.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

// Lower index = higher layer. A layer may only import layers with a >= index.
const LAYERS = ["app", "domains", "widgets", "features", "shared"];
const rank = (layer) => LAYERS.indexOf(layer);

const IMPORT_RE = /(?:import|export)\s[^"']*?["'](@\/[^"']+)["']/g;

/** @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const errors = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replaceAll("\\", "/");
  const [fromLayer, fromSlice] = rel.split("/");
  if (!LAYERS.includes(fromLayer)) continue;

  const code = readFileSync(file, "utf8");
  for (const match of code.matchAll(IMPORT_RE)) {
    const target = match[1].slice(2); // strip "@/"
    const [toLayer, toSlice] = target.split("/");
    if (!LAYERS.includes(toLayer)) continue;

    // Rule 1: no importing a higher layer.
    if (rank(toLayer) < rank(fromLayer)) {
      errors.push(`${rel}: '${fromLayer}' must not import higher layer '${toLayer}' (${match[1]})`);
      continue;
    }

    // Rule 2: same-layer cross-slice imports must use the Public API (index.ts),
    // i.e. exactly '@/<layer>/<slice>' with no deeper segment.
    // Only sliced layers have Public APIs; `shared` and `app` are segment-organized.
    const SLICED = ["domains", "widgets", "features"];
    if (SLICED.includes(fromLayer) && toLayer === fromLayer && toSlice && toSlice !== fromSlice) {
      const segments = target.split("/");
      if (segments.length > 2) {
        errors.push(
          `${rel}: cross-slice import must use Public API '@/${toLayer}/${toSlice}', got ${match[1]}`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(`\n✗ FSD import violations (${errors.length}):\n`);
  for (const e of errors) console.error("  " + e);
  console.error("");
  process.exit(1);
}
console.log("✓ FSD import rules pass");
