import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { PREVIEW } from '../site/js/picture.js';

// When someone posts the site's address, apps build the preview from the
// Open Graph (og:) and twitter: tags in index.html. The picture is the fixed
// site/link-preview.png, drawn by scripts/link-preview.mjs.

const site = new URL('../site/', import.meta.url);
const html = readFileSync(new URL('index.html', site), 'utf8');

const meta = Object.fromEntries(
  [...html.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)">/g)].map((m) => [m[1], m[2]]),
);

test('the page has the tags apps need for a large link preview', () => {
  for (const tag of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) {
    assert.ok(meta[tag]?.trim(), `missing ${tag}`);
  }
  assert.equal(meta['og:title'], 'Life in Weeks');
  assert.equal(meta['twitter:card'], 'summary_large_image');
  assert.equal(meta['twitter:image:alt'], meta['og:image:alt']);
});

test('og:url and og:image are absolute https addresses, and the picture is served with the site', () => {
  const pageUrl = new URL(meta['og:url']);
  assert.equal(pageUrl.protocol, 'https:');
  assert.ok(pageUrl.pathname.endsWith('/'), 'og:url is the folder the site is served from');
  assert.ok(meta['og:image'].startsWith(meta['og:url']), 'og:image is a file of this site');
  const file = meta['og:image'].slice(meta['og:url'].length);
  assert.ok(existsSync(new URL(file, site)), `missing site/${file}`);
});

test('the picture is a PNG of the size the tags say, in the PREVIEW format', () => {
  const file = meta['og:image'].slice(meta['og:url'].length);
  const png = readFileSync(new URL(file, site));
  assert.equal(meta['og:image:type'], 'image/png');
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG file');
  // The IHDR chunk comes first: width and height, 4 bytes each, big-endian.
  const size = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert.deepEqual(size, [Number(meta['og:image:width']), Number(meta['og:image:height'])]);
  assert.deepEqual(size, [PREVIEW.width, PREVIEW.height]);
  // Some apps skip large preview pictures; this one is flat colors and stays small.
  assert.ok(png.length < 300 * 1024, `${Math.round(png.length / 1024)} KB`);
});
