import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COLORS, DEFAULT_COLOR, isColor, colorOrDefault } from '../site/js/colors.js';

test('every color has a unique id and a name', () => {
  const ids = COLORS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COLORS) {
    assert.match(c.id, /^[a-z]+$/);
    assert.ok(c.name);
  }
});

test('the default color is one of the colors, and comes first in the picker', () => {
  assert.ok(isColor(DEFAULT_COLOR));
  assert.equal(COLORS[0].id, DEFAULT_COLOR);
});

test('isColor and colorOrDefault', () => {
  assert.equal(isColor('violet'), true);
  assert.equal(isColor('Violet'), false);
  assert.equal(isColor(undefined), false);
  assert.equal(colorOrDefault('teal'), 'teal');
  assert.equal(colorOrDefault('neon'), DEFAULT_COLOR);
  assert.equal(colorOrDefault(null), DEFAULT_COLOR);
});

// The shades live in the stylesheet; make sure none is missing.
test('styles.css has a shade for every color in both themes, and a class for each', () => {
  const css = readFileSync(new URL('../site/styles.css', import.meta.url), 'utf8');
  const block = (selector) => css.match(new RegExp(`\\${selector} \\{([^}]*)\\}`))[1];
  for (const theme of ['.t-dark', '.t-light']) {
    for (const { id } of COLORS) {
      assert.match(block(theme), new RegExp(`--c-${id}: #[0-9A-Fa-f]{6};`), `${theme} is missing --c-${id}`);
    }
  }
  for (const { id } of COLORS) {
    assert.ok(css.includes(`.c-${id} { --mark: var(--c-${id}); }`), `missing .c-${id}`);
  }
});
