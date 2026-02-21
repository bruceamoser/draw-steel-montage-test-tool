#!/usr/bin/env node
/**
 * Build script for draw-steel-montage module.
 *
 * Usage:
 *   node scripts/package.mjs [version]
 *
 * If no version is supplied the version from package.json is used.
 *
 * Outputs into dist/:
 *   module.json                  – version-stamped manifest
 *   draw-steel-montage.zip       – module archive ready for a GitHub release
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const MODULE_ID = "draw-steel-montage";
const PLACEHOLDER = "#{VERSION}#";

/* ------------------------------------------------------------------ */
/*  Determine version                                                  */
/* ------------------------------------------------------------------ */

let version = process.argv[2];
if (!version) {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  version = pkg.version;
}
// Strip leading "v" if present (e.g. from a git tag)
version = version.replace(/^v/, "");

console.log(`\n  Packaging ${MODULE_ID} v${version}\n`);

/* ------------------------------------------------------------------ */
/*  Prepare dist folder                                                */
/* ------------------------------------------------------------------ */

if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
}
mkdirSync(DIST, { recursive: true });

/* ------------------------------------------------------------------ */
/*  Build version-stamped module.json → dist/module.json               */
/* ------------------------------------------------------------------ */

const manifestRaw = readFileSync(join(ROOT, "module.json"), "utf-8");
const manifestStamped = manifestRaw.replaceAll(PLACEHOLDER, version);
const manifestOutPath = join(DIST, "module.json");
writeFileSync(manifestOutPath, manifestStamped, "utf-8");
console.log(`  ✓ module.json → dist/module.json  (version ${version})`);

/* ------------------------------------------------------------------ */
/*  Stage module files into a temp directory then zip                   */
/* ------------------------------------------------------------------ */

const STAGE = join(DIST, MODULE_ID);
mkdirSync(STAGE, { recursive: true });

// Copy the stamped module.json into the archive root
cpSync(manifestOutPath, join(STAGE, "module.json"));

// Directories / files to include in the archive
const INCLUDE = ["src", "templates", "styles", "lang", "LICENSE"];
for (const entry of INCLUDE) {
  const src = join(ROOT, entry);
  if (!existsSync(src)) {
    console.warn(`  ⚠ Skipping missing path: ${entry}`);
    continue;
  }
  cpSync(src, join(STAGE, entry), { recursive: true });
}

/* ------------------------------------------------------------------ */
/*  Create zip archive                                                 */
/* ------------------------------------------------------------------ */

const zipName = `${MODULE_ID}.zip`;
const zipPath = join(DIST, zipName);

// Use PowerShell Compress-Archive (available on all modern Windows)
// The archive contains a single top-level folder named after the module id.
try {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" },
  );
  console.log(`  ✓ ${zipName} → dist/${zipName}`);
} catch {
  console.error("  ✗ Failed to create zip. Make sure PowerShell is available.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Cleanup staging directory                                          */
/* ------------------------------------------------------------------ */

rmSync(STAGE, { recursive: true, force: true });

console.log(`\n  Done! Release artifacts are in dist/\n`);
