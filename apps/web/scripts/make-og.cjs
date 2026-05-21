/**
 * Generates the static Open Graph image (src/app/opengraph-image.png).
 * One-off: run `node scripts/make-og.cjs` from apps/web after editing the SVG.
 */
const path = require("node:path");
const sharp = require(
  path.join(__dirname, "../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp"),
);

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0a0a0b"/>
  <circle cx="1010" cy="110" r="340" fill="#34d399" opacity="0.10"/>
  <circle cx="170" cy="600" r="300" fill="#6366f1" opacity="0.10"/>
  <circle cx="112" cy="108" r="33" fill="none" stroke="#34d399" stroke-width="6"/>
  <circle cx="112" cy="108" r="11" fill="#34d399"/>
  <text x="172" y="121" font-family="Helvetica,Arial,sans-serif" font-size="34" fill="#9ca3af">Playlist Analyzer</text>
  <text x="88" y="312" font-family="Helvetica,Arial,sans-serif" font-size="88" font-weight="700" fill="#ffffff">Understand your</text>
  <text x="88" y="416" font-family="Helvetica,Arial,sans-serif" font-size="88" font-weight="700" fill="#34d399">music taste.</text>
  <text x="90" y="498" font-family="Helvetica,Arial,sans-serif" font-size="31" fill="#9ca3af">Taste DNA &#183; interactive artist map &#183; recommendations</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(__dirname, "../src/app/opengraph-image.png"))
  .then((info) => console.log(`✅ OG image ${info.width}x${info.height}, ${info.size} bytes`))
  .catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  });
