// Draws the app icons in site/icons/: what the site shows on a home screen,
// in a dock or in an app list once it is installed (see manifest.webmanifest
// and index.html). Each is the favicon's design, a few weeks of the grid with
// this week lit, drawn as a PNG in Chromium.
//
// The icons are fixed files, committed with the site. Run this again after
// changing the favicon's design or the dark theme's colors:
//
//   npm run app-icons
//
// It needs Playwright and its Chromium, which the site itself does not use:
//
//   npm install --no-save playwright && npx playwright install chromium

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const dir = new URL('../site/icons/', import.meta.url);

// The favicon's colors: the dark theme's background, lived weeks and this week.
const BG = '#0F1012';
const INK = '#ECECE8';
const NOW = '#FFB547';

// - `any` is drawn as it is, like the favicon: a rounded square.
// - `maskable` fills its square, for Android, which cuts it to its own
//   shape. Only the middle circle, 80% across, is sure to show, so the
//   weeks are smaller.
// - The Apple touch icon fills its square too: iOS and macOS round the
//   corners themselves, and would show transparent ones as black.
// `grid` is how much of the icon's width the weeks take up.
const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, grid: 0.5 },
  { file: 'icon-512.png', size: 512, rounded: true, grid: 0.5 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, grid: 0.4 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, grid: 0.5 },
];

/** The icon as SVG: three rows of three weeks, the middle one this week, the last four ahead. */
function iconSvg({ size, rounded, grid }) {
  // The favicon's weeks are 4 units wide with gaps of 2: 16 units in all.
  const unit = (grid * 32) / 16;
  const start = (32 - 16 * unit) / 2;
  const weeks = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      const fill = i === 4 ? NOW : INK;
      const opacity = i > 4 ? ' opacity=".3"' : '';
      const x = start + col * 6 * unit;
      const y = start + row * 6 * unit;
      weeks.push(`<rect x="${x}" y="${y}" width="${4 * unit}" height="${4 * unit}" rx="${unit}" fill="${fill}"${opacity}/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">`
    + `<rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${BG}"/>${weeks.join('')}</svg>`;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    throw new Error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  }

  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${iconSvg(icon)}`);
      const png = await page.locator('svg').screenshot({ omitBackground: true });
      await writeFile(new URL(icon.file, dir), png);
      console.log(`Wrote site/icons/${icon.file}: ${icon.size} × ${icon.size}, ${Math.round(png.length / 1024)} KB`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
