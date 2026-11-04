import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const site = new URL('../site/', import.meta.url);
const html = readFileSync(new URL('index.html', site), 'utf8');
const css = readFileSync(new URL('styles.css', site), 'utf8');

// What the page loads: <link href>, <script src> and url() in the stylesheet.
// (Plain <a href> links are not loaded, so they are left out.)
const loadedByHtml = [
  ...[...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]),
];
const loadedByCss = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);

test('the page and its stylesheet load nothing from other sites', () => {
  for (const ref of [...loadedByHtml, ...loadedByCss]) {
    assert.doesNotMatch(ref, /^(https?:)?\/\//, `loads ${ref} from another site`);
  }
});

test('every font file the page or stylesheet asks for exists', () => {
  const fonts = [...loadedByHtml, ...loadedByCss].filter((ref) => ref.endsWith('.woff2'));
  assert.ok(fonts.length > 0);
  for (const ref of fonts) {
    assert.ok(existsSync(new URL(ref, site)), `missing site/${ref}`);
  }
});

test('Geist and Geist Mono both have a local font file, and the license ships with them', () => {
  for (const family of ['Geist', 'Geist Mono']) {
    assert.ok(css.includes(`font-family: '${family}';`), `no @font-face for ${family}`);
  }
  assert.ok(existsSync(new URL('fonts/OFL.txt', site)));
});
