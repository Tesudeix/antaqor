// Generate PWA icon PNGs from logo
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, "..", "public");

const BG = "#0A0A0A";

// Create a simple "A" icon SVG
function iconSvg(size, padding = 0) {
  const fontSize = Math.round((size - padding * 2) * 0.68);
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial Black,Arial,sans-serif" font-weight="900"
      font-size="${fontSize}" fill="#FFFF01">A</text>
  </svg>`);
}

async function generate() {
  // Regular icons
  for (const s of [192, 512]) {
    await sharp(iconSvg(s))
      .png()
      .toFile(join(pub, `icon-${s}.png`));
    console.log(`icon-${s}.png`);
  }

  // Maskable icons (with safe zone: 10% padding)
  for (const s of [192, 512]) {
    const pad = Math.round(s * 0.1);
    await sharp(iconSvg(s, pad))
      .png()
      .toFile(join(pub, `icon-${s}-maskable.png`));
    console.log(`icon-${s}-maskable.png`);
  }

  // Apple touch icon (180x180)
  await sharp(iconSvg(180))
    .png()
    .toFile(join(pub, "apple-touch-icon.png"));
  console.log("apple-touch-icon.png");

  console.log("Done.");
}

generate().catch(console.error);
