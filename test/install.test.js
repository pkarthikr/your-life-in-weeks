import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { installWay, keepsOwnData } from '../site/js/install.js';

const site = new URL('../site/', import.meta.url);
const read = (path) => readFileSync(new URL(path, site), 'utf8');
const html = read('index.html');
const css = read('styles.css');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // Safari on a Mac, and on an iPad asking for desktop sites: the same.
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  macEdge: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0',
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0',
};

test('Chrome, Edge and Samsung Internet use their own prompt, once they offer it', () => {
  assert.equal(installWay({ canPrompt: true, userAgent: UA.androidChrome }), 'prompt');
  assert.equal(installWay({ canPrompt: true, userAgent: UA.macEdge }), 'prompt');
  // Not offered (yet, or after a refusal): the browser's menu still has it.
  assert.equal(installWay({ userAgent: UA.androidChrome }), 'other');
  assert.equal(installWay({ userAgent: UA.macChrome }), 'other');
});

test('iPhone and iPad add it from the Share menu, in Safari or any other browser there', () => {
  assert.equal(installWay({ userAgent: UA.iphone, maxTouchPoints: 5 }), 'ios');
  assert.equal(installWay({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 }), 'ios');
  assert.equal(installWay({ userAgent: UA.ipad, maxTouchPoints: 5 }), 'ios');
  // An iPad asking for desktop sites says it is a Mac; its touch screen gives it away.
  assert.equal(installWay({ userAgent: UA.macSafari, maxTouchPoints: 5 }), 'ios');
});

test('Safari on a Mac adds it to the Dock, from version 17', () => {
  assert.equal(installWay({ userAgent: UA.macSafari, maxTouchPoints: 0 }), 'mac');
  assert.equal(installWay({ userAgent: UA.macSafari16, maxTouchPoints: 0 }), 'other');
  // Other browsers on a Mac also say "Safari/", but not "Version/".
  assert.equal(installWay({ userAgent: UA.macChrome }), 'other');
  assert.equal(installWay({ userAgent: UA.macFirefox }), 'other');
});

test('anywhere else, the browser’s menu', () => {
  assert.equal(installWay({ userAgent: UA.androidFirefox }), 'other');
  assert.equal(installWay({}), 'other');
  assert.equal(installWay(), 'other');
});

test('the installed app offers nothing, and installing it says so', () => {
  assert.equal(installWay({ standalone: true, canPrompt: true, userAgent: UA.androidChrome }), 'app');
  assert.equal(installWay({ standalone: true, userAgent: UA.iphone }), 'app');
  assert.equal(installWay({ installed: true, userAgent: UA.androidChrome }), 'done');
});

test('only Apple’s apps keep their own data, apart from the browser’s', () => {
  assert.equal(keepsOwnData('ios'), true);
  assert.equal(keepsOwnData('mac'), true);
  for (const way of ['app', 'done', 'prompt', 'other']) assert.equal(keepsOwnData(way), false, way);
});

test('Settings has instructions for every way, and an Install button for the prompt', () => {
  for (const way of ['prompt', 'ios', 'mac', 'other', 'done']) {
    assert.match(html, new RegExp(`data-install="${way}"`), `no instructions for ${way}`);
  }
  assert.match(html, /<button[^>]*id="install-app"/);
});

// ---- The manifest and icons -----------------------------------------------

const manifest = JSON.parse(read('manifest.webmanifest'));

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(path) {
  const png = readFileSync(new URL(path, site));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${path} is a PNG`);
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

/** A color token's value in one theme's block of styles.css. */
function token(theme, name) {
  const block = new RegExp(`\\.t-${theme} \\{([^}]*)\\}`).exec(css)[1];
  return new RegExp(`--${name}: ([^;]+);`).exec(block)[1];
}

test('the page links the manifest, and it has what browsers need to install the site', () => {
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.equal(manifest.name, 'Life in Weeks');
  assert.ok(manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  // Relative, so the app works wherever the site is served from.
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});

test('the app opens in the dark theme’s colors, like the page before anything is chosen', () => {
  assert.equal(manifest.background_color, token('dark', 'bg'));
  assert.equal(manifest.theme_color, token('dark', 'bg'));
  assert.match(html, new RegExp(`<meta name="theme-color" content="${token('dark', 'bg')}"`));
});

test('every icon exists at the size the manifest says, including the sizes and shape Android needs', () => {
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png');
    assert.ok(existsSync(new URL(icon.src, site)), `missing site/${icon.src}`);
    assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  }
  const has = (sizes, purpose) => manifest.icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);
  assert.ok(has('192x192', 'any'));
  assert.ok(has('512x512', 'any'));
  assert.ok(has('512x512', 'maskable'));
});

test('iPhone, iPad and Mac get their own icon, 180 × 180', () => {
  const href = /<link rel="apple-touch-icon" href="([^"]+)">/.exec(html)?.[1];
  assert.ok(href, 'no apple-touch-icon');
  assert.equal(pngSize(href), '180x180');
});

// ---- The service worker's copy of the site --------------------------------

const sw = read('sw.js');
const FILES = [...(/const FILES = \[([^\]]*)\]/.exec(sw)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('every file the service worker copies exists (one missing would stop it installing)', () => {
  assert.ok(FILES.length > 0, 'no FILES in sw.js');
  assert.ok(FILES.includes('./'), 'the page itself');
  for (const file of FILES.filter((f) => f !== './')) {
    assert.ok(existsSync(new URL(file, site)), `missing site/${file}`);
  }
});

test('the copy has everything the page loads to start, so it opens offline', () => {
  const loaded = [
    ...[...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]),
  ];
  for (const file of loaded) assert.ok(FILES.includes(file), `sw.js doesn't copy ${file}`);
  // Every module, since app.js imports them all, directly or not.
  for (const file of readdirSync(new URL('js/', site)).filter((f) => f.endsWith('.js'))) {
    assert.ok(FILES.includes(`js/${file}`), `sw.js doesn't copy js/${file}`);
  }
});
