/**
 * Generate Farcaster-safe 1200×800 embed preview (3:2) with ≥120px edge padding.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = 1200;
const HEIGHT = 800;
const PAD = 120;
const SAFE_W = WIDTH - PAD * 2;
const SAFE_H = HEIGHT - PAD * 2;

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "embed-image.png");
const OUT_FC = path.join(ROOT, "public", "farcaster-embed.png");
const ICON = path.join(ROOT, "public", "app-icon.png");

async function main() {
  const logoSize = 148;

  const logoPng = await sharp(ICON)
    .resize(logoSize, logoSize, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${logoSize}" height="${logoSize}"><rect width="${logoSize}" height="${logoSize}" rx="36" ry="36" fill="white"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const glow = await sharp({
    create: {
      width: 220,
      height: 220,
      channels: 4,
      background: { r: 0, g: 82, b: 255, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="220" height="220" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#0052FF" stop-opacity="0.55"/>
                <stop offset="70%" stop-color="#0052FF" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="#0052FF" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="110" cy="110" r="110" fill="url(#g)"/>
          </svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();

  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050914"/>
      <stop offset="45%" stop-color="#070b18"/>
      <stop offset="100%" stop-color="#0a1633"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="42%" r="68%">
      <stop offset="0%" stop-color="#0052FF" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#0052FF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#1b3d8f" stroke-width="1" opacity="0.28"/>
    </pattern>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1a3a" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#0a142c" stop-opacity="0.88"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#0052FF" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity="0.55"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>

  <text x="600" y="318" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="22" font-weight="700" letter-spacing="3.5" fill="#8eb6ff">BASEQUEST REWARDS</text>

  <text x="600" y="392" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="44" font-weight="800" fill="#ffffff">Complete quests.</text>
  <text x="600" y="448" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="44" font-weight="800" fill="#ffffff">Earn XP.</text>
  <text x="600" y="504" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="44" font-weight="800" fill="#ffffff">Unlock rewards.</text>

  <g filter="url(#softShadow)">
    <rect x="280" y="548" width="640" height="112" rx="22" ry="22" fill="url(#card)"
          stroke="#0052FF" stroke-opacity="0.75" stroke-width="2"/>
    <rect x="280" y="548" width="8" height="112" rx="4" fill="#0052FF"/>
    <rect x="308" y="574" width="60" height="60" rx="14" fill="#0052FF" fill-opacity="0.22" stroke="#3d7cff" stroke-width="1.5"/>
    <path d="M330 592 h16 a2 2 0 0 1 2 2 v4 h-20 v-4 a2 2 0 0 1 2-2 z M328 600 h24 v22 a4 4 0 0 1-4 4 h-16 a4 4 0 0 1-4-4 z"
          fill="#7eb6ff"/>
    <path d="M336 612 l5 5 10-11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="388" y="600" font-family="Segoe UI, Arial, Helvetica, sans-serif"
          font-size="24" font-weight="700" fill="#ffffff">Daily Check-In</text>
    <text x="388" y="630" font-family="Segoe UI, Arial, Helvetica, sans-serif"
          font-size="18" font-weight="600" fill="#5ad0ff">+10 XP</text>
    <rect x="780" y="584" width="112" height="40" rx="12" fill="#0052FF"/>
    <text x="836" y="610" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif"
          font-size="16" font-weight="700" fill="#ffffff">Open</text>
  </g>
</svg>`);

  const logoX = Math.round((WIDTH - logoSize) / 2);
  const logoY = PAD + 8;
  const glowX = Math.round((WIDTH - 220) / 2);
  const glowY = logoY - 36;

  const png = await sharp(svg)
    .composite([
      { input: glow, left: glowX, top: glowY },
      { input: logoPng, left: logoX, top: logoY },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.promises.writeFile(OUT, png);
  await fs.promises.writeFile(OUT_FC, png);

  const meta = await sharp(png).metadata();
  console.log(
    JSON.stringify(
      {
        out: [OUT, OUT_FC],
        width: meta.width,
        height: meta.height,
        ratio: (meta.width / meta.height).toFixed(3),
        safePaddingPx: PAD,
        contentBox: { x: PAD, y: PAD, w: SAFE_W, h: SAFE_H },
        bytes: png.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
