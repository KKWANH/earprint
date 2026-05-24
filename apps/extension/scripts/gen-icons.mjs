#!/usr/bin/env node
/**
 * Regenerates the toolbar icons from assets/logo.svg.
 * Run after editing the master SVG:
 *   pnpm --filter @playlist-analyzer/extension exec node scripts/gen-icons.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const svg = await readFile(join(repoRoot, "assets", "logo.svg"));
const outDir = join(here, "..", "icons");
await mkdir(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const out = join(outDir, `icon-${size}.png`);
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}
