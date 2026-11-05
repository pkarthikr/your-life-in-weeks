// Draws site/link-preview.png: the picture that shows when someone posts the
// site's address. It is a sample life on the week grid, in the dark theme,
// drawn in Chromium by the same code as the share pictures (js/picture.js),
// in the PREVIEW format.
//
// The picture is a fixed file, committed with the site. Run this again after
// changing how the pictures are drawn, the dark theme's colors or the site's
// address (og:url in index.html):
//
//   npm run link-preview
//
// It needs Playwright and its Chromium, which the site itself does not use:
//
//   npm install --no-save playwright && npx playwright install chromium

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const site = new URL('../site/', import.meta.url);
const out = new URL('link-preview.png', site);

// A sample life, seen on a fixed day so the picture only changes when the
// code does: about a third of the grid lived, and one important week in
// each color. Their labels are never drawn.
const SAMPLE = {
  birthday: '1993-04-19',
  today: '2026-11-02',
  events: [
    { date: '1998-09-07', label: 'First day of school', color: 'blue' },
    { date: '2011-08-29', label: 'Left home for university', color: 'violet' },
    { date: '2015-07-06', label: 'First job', color: 'green' },
    { date: '2018-03-12', label: 'Moved to a new city', color: 'teal' },
    { date: '2021-10-16', label: 'Got married', color: 'pink' },
    { date: '2024-05-20', label: 'Ran a marathon', color: 'red' },
  ],
};

// What the page says before a birthday is added, rather than one person's
// count of weeks.
const TEXT = { eyebrow: 'Life in Weeks', lived: 'Every square is a week.', ahead: 'See yours.' };

const TYPES = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// A blank page in the dark theme with the site's stylesheet, so the
// picture gets the same colors and fonts as the page.
const PAGE = '<!doctype html><html class="t-dark"><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body></body></html>';

async function main() {
  const html = await readFile(new URL('index.html', site), 'utf8');
  const siteUrl = /<meta property="og:url" content="([^"]+)">/.exec(html)?.[1];
  if (!siteUrl) throw new Error('index.html has no og:url to print on the picture.');

  let chromium;
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    throw new Error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  }

  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
    const file = new URL(`.${path}`, site);
    if (!file.href.startsWith(site.href)) return res.writeHead(404).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const png = await page.evaluate(async ({ sample, text, siteUrl }) => {
      const from = (path) => import(new URL(path, location.href).href);
      const { YEARS, parseISODate, lifeStats, eventsByWeek } = await from('js/weeks.js');
      const { PREVIEW, PICTURE_FONTS, drawPicture, pictureColors, siteAddress } = await from('js/picture.js');

      // Unlike the Share button, which falls back to system fonts, the
      // committed picture must be drawn in Geist.
      await Promise.all(PICTURE_FONTS.map((font) => document.fonts.load(font)));
      const missing = PICTURE_FONTS.filter((font) => !document.fonts.check(font));
      if (missing.length) throw new Error(`These fonts did not load: ${missing.join(', ')}`);

      const birth = parseISODate(sample.birthday);
      const css = getComputedStyle(document.documentElement);
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW.width;
      canvas.height = PREVIEW.height;
      drawPicture(canvas.getContext('2d'), {
        format: PREVIEW,
        stats: lifeStats(birth, parseISODate(sample.today), YEARS),
        events: eventsByWeek(birth, sample.events, YEARS),
        colors: pictureColors((name) => css.getPropertyValue(`--${name}`).trim()),
        site: siteAddress(siteUrl),
        text,
      });
      return { data: canvas.toDataURL('image/png').split(',')[1], width: canvas.width, height: canvas.height };
    }, { sample: SAMPLE, text: TEXT, siteUrl });

    const bytes = Buffer.from(png.data, 'base64');
    await writeFile(out, bytes);
    console.log(`Wrote site/link-preview.png: ${png.width} × ${png.height}, ${Math.round(bytes.length / 1024)} KB`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
