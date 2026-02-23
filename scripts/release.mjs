#!/usr/bin/env node
/**
 * Release script — creates a GitHub release via `gh` CLI.
 *
 * Usage:
 *   node scripts/release.mjs [--draft] [--prerelease] [--tag vX.Y.Z]
 *
 * Requires:
 *   - `gh` CLI on PATH and authenticated
 *   - dist/module.json and dist/draw-steel-montage.zip (run build first)
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

/* ------------------------------------------------------------------ */
/*  Parse args                                                         */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const draft = args.includes("--draft");
const prerelease = args.includes("--prerelease");

let tagOverride = null;
const tagIndex = args.indexOf("--tag");
if (tagIndex !== -1 && args[tagIndex + 1]) {
  tagOverride = args[tagIndex + 1];
}

/* ------------------------------------------------------------------ */
/*  Read module metadata                                               */
/* ------------------------------------------------------------------ */

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const moduleId = "draw-steel-montage";
const version = pkg.version;
const tag = tagOverride ?? `v${version}`;

const manifestPath = join(DIST, "module.json");
const zipPath = join(DIST, `${moduleId}.zip`);

/* ------------------------------------------------------------------ */
/*  Validate prerequisites                                             */
/* ------------------------------------------------------------------ */

try {
  execSync("gh auth status", { stdio: "pipe" });
} catch {
  console.error("ERROR: gh CLI is not authenticated. Run `gh auth login` first.");
  process.exit(1);
}

import { existsSync } from "node:fs";
if (!existsSync(manifestPath)) {
  console.error(`ERROR: ${manifestPath} not found. Run 'npm run build' first.`);
  process.exit(1);
}
if (!existsSync(zipPath)) {
  console.error(`ERROR: ${zipPath} not found. Run 'npm run build' first.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Create release                                                     */
/* ------------------------------------------------------------------ */

const ghArgs = [
  "release", "create", tag,
  manifestPath,
  zipPath,
  "--title", `${moduleId} ${version}`,
  "--generate-notes",
];

if (draft) ghArgs.push("--draft");
if (prerelease) ghArgs.push("--prerelease");

console.log(`\n  Creating GitHub release '${tag}'`);
console.log(`  Assets: module.json, ${moduleId}.zip`);
if (draft) console.log("  (draft)");
console.log();

try {
  execSync(`gh ${ghArgs.map((a) => `"${a}"`).join(" ")}`, {
    cwd: ROOT,
    stdio: "inherit",
  });
  console.log(`\n  Release ${tag} created successfully!\n`);
} catch (err) {
  console.error(`\n  Failed to create release: ${err.message}\n`);
  process.exit(1);
}
