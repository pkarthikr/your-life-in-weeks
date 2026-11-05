import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, load, save } from '../site/js/storage.js';

const EMPTY = { birthday: '', events: [], chapters: [], theme: 'dark' };

function memoryStore(initial = {}) {
  const items = { ...initial };
  return {
    getItem: (k) => (k in items ? items[k] : null),
    setItem: (k, v) => { items[k] = String(v); },
    items,
  };
}

test('load returns defaults when nothing is saved', () => {
  assert.deepEqual(load(memoryStore()), EMPTY);
});

test('load returns defaults when storage is unavailable', () => {
  assert.deepEqual(load(null), EMPTY);
  const throwing = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(load(throwing), EMPTY);
});

test('load ignores corrupt or unexpected data', () => {
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: '{not json' })), EMPTY);
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: '[1,2]' })), EMPTY);
  const odd = JSON.stringify({ birthday: 42, events: [null, { date: '2020-01-01' }, { date: '2020-01-01', label: 'ok' }], theme: 'neon' });
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: odd })), {
    ...EMPTY,
    events: [{ id: 1, date: '2020-01-01', label: 'ok', color: 'blue' }],
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
  assert.deepEqual(loaded.events.at(-1), { id: 7, date: '2005-01-01', label: 'e', color: 'blue' });
});

test('load keeps each important week\'s color and defaults the rest to blue', () => {
  const events = [
    { id: 1, date: '2001-01-01', label: 'a', color: 'violet' },
    { id: 2, date: '2002-01-01', label: 'b' }, // saved before colors existed
    { id: 3, date: '2003-01-01', label: 'c', color: 'chartreuse' },
    { id: 4, date: '2004-01-01', label: 'd', color: 7 },
  ];
  const loaded = load(memoryStore({ [STORAGE_KEY]: JSON.stringify({ events }) }));
  assert.deepEqual(loaded.events.map((e) => e.color), ['violet', 'blue', 'blue', 'blue']);
});

test('save merges into what is stored and round-trips', () => {
  const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ theme: 'light', events: [{ id: 1, date: '2010-05-01', label: 'Graduated', color: 'green' }] }) });
  const next = save({ birthday: '1990-01-01' }, store);
  assert.deepEqual(next, { birthday: '1990-01-01', events: [{ id: 1, date: '2010-05-01', label: 'Graduated', color: 'green' }], chapters: [], theme: 'light' });
  assert.deepEqual(load(store), next);
});

test('save still returns the merged data when the write fails', () => {
  const full = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assert.deepEqual(save({ birthday: '1990-01-01' }, full), { ...EMPTY, birthday: '1990-01-01' });
});

test('load keeps well-formed chapters, with an id each, and an empty end for one still going', () => {
  const chapters = [
    { id: 2, start: '2008-08-25', end: '2012-05-15', label: 'College', color: 'green' },
    { id: 2, start: '2012-06-01', label: 'Seattle', color: 'neon' }, // duplicate id, no end, unknown color
    { start: '2019-09-01', end: null, label: 'London' }, // no id, odd end, no color
    { start: 20190901, label: 'bad start' },
    { start: '2020-01-01' }, // no label
    'not a chapter',
    null,
  ];
  const loaded = load(memoryStore({ [STORAGE_KEY]: JSON.stringify({ chapters }) }));
  assert.deepEqual(loaded.chapters, [
    { id: 2, start: '2008-08-25', end: '2012-05-15', label: 'College', color: 'green' },
    { id: 3, start: '2012-06-01', end: '', label: 'Seattle', color: 'blue' },
    { id: 4, start: '2019-09-01', end: '', label: 'London', color: 'blue' },
  ]);
  assert.deepEqual(load(memoryStore({ [STORAGE_KEY]: JSON.stringify({ chapters: 'nope' }) })).chapters, []);
});

test('chapters and important weeks are saved side by side, and data saved before chapters still loads', () => {
  const before = { birthday: '1990-01-01', events: [{ id: 1, date: '2010-05-01', label: 'Graduated', color: 'green' }], theme: 'light' };
  const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(before) });
  assert.deepEqual(load(store), { ...before, chapters: [] });
  const chapter = { id: 1, start: '2008-08-25', end: '', label: 'College', color: 'violet' };
  save({ chapters: [chapter] }, store);
  assert.deepEqual(load(store), { ...before, chapters: [chapter] });
});
