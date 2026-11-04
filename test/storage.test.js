import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, load, save } from '../site/js/storage.js';

function memoryStore(initial = {}) {
  const items = { ...initial };
  return {
    getItem: (k) => (k in items ? items[k] : null),
    setItem: (k, v) => { items[k] = String(v); },
    items,
  };
}

test('load returns defaults when nothing is saved', () => {
  assert.deepEqual(load(memoryStore()), { birthday: '', events: [], theme: 'dark' });
});

test('load returns defaults when storage is unavailable', () => {
  assert.deepEqual(load(null), { birthday: '', events: [], theme: 'dark' });
  const throwing = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(load(throwing), { birthday: '', events: [], theme: 'dark' });
});

test('load ignores corrupt or unexpected data', () => {
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: '{not json' })), { birthday: '', events: [], theme: 'dark' });
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: '[1,2]' })), { birthday: '', events: [], theme: 'dark' });
  const odd = JSON.stringify({ birthday: 42, events: [null, { date: '2020-01-01' }, { date: '2020-01-01', label: 'ok' }], theme: 'neon' });
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: odd })), {
    birthday: '',
    events: [{ id: 1, date: '2020-01-01', label: 'ok' }],
    theme: 'dark',
  });
});

test('load gives every important week its own id', () => {
  const events = [
    { id: 3, date: '2001-01-01', label: 'a' },
    { id: 3, date: '2002-01-01', label: 'b' },
    { date: '2003-01-01', label: 'c' },
    { id: -1, date: '2004-01-01', label: 'd' },
    { id: '2', date: '2005-01-01', label: 'e', extra: true },
  ];
  const loaded = load(memoryStore({ [STORAGE_KEY]: JSON.stringify({ events }) }));
  assert.deepEqual(loaded.events.map((e) => e.id), [3, 4, 5, 6, 7]);
  assert.deepEqual(loaded.events.at(-1), { id: 7, date: '2005-01-01', label: 'e' });
});

test('save merges into what is stored and round-trips', () => {
  const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ theme: 'light', events: [{ id: 1, date: '2010-05-01', label: 'Graduated' }] }) });
  const next = save({ birthday: '1990-01-01' }, store);
  assert.deepEqual(next, { birthday: '1990-01-01', events: [{ id: 1, date: '2010-05-01', label: 'Graduated' }], theme: 'light' });
  assert.deepEqual(load(store), next);
});

test('save still returns the merged data when the write fails', () => {
  const full = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assert.deepEqual(save({ birthday: '1990-01-01' }, full), { birthday: '1990-01-01', events: [], theme: 'dark' });
});
