import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, load, save, clean, askToKeep } from '../site/js/storage.js';

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
    events: [{ id: 1, date: '2020-01-01', label: 'ok', color: 'blue' }],
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
  assert.deepEqual(next, { birthday: '1990-01-01', events: [{ id: 1, date: '2010-05-01', label: 'Graduated', color: 'green' }], theme: 'light' });
  assert.deepEqual(load(store), next);
});

test('save still returns the merged data when the write fails', () => {
  const full = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assert.deepEqual(save({ birthday: '1990-01-01' }, full), { birthday: '1990-01-01', events: [], theme: 'dark' });
});

test('clean makes the saved shape from anything', () => {
  for (const odd of [undefined, null, 'text', 7, []]) {
    assert.deepEqual(clean(odd), { birthday: '', events: [], theme: 'dark' });
  }
  assert.deepEqual(clean({ birthday: '1990-01-01', theme: 'light', events: [{ date: '2000-01-01', label: 'a' }], extra: 1 }), {
    birthday: '1990-01-01',
    events: [{ id: 1, date: '2000-01-01', label: 'a', color: 'blue' }],
    theme: 'light',
  });
});

/** A stand-in for navigator.storage that records whether persist() was asked. */
function storageManager({ persisted = false, grants = true, fails = false } = {}) {
  const manager = {
    asked: 0,
    persisted: async () => persisted,
    persist: async () => {
      manager.asked++;
      if (fails) throw new Error('not allowed');
      return grants;
    },
  };
  return manager;
}

test('askToKeep asks the browser to keep the data, and says whether it agreed', async () => {
  const yes = storageManager({ grants: true });
  assert.equal(await askToKeep(yes), true);
  assert.equal(yes.asked, 1);

  const no = storageManager({ grants: false });
  assert.equal(await askToKeep(no), false);
  assert.equal(no.asked, 1);
});

test('askToKeep does not ask again once the browser keeps the data', async () => {
  const kept = storageManager({ persisted: true });
  assert.equal(await askToKeep(kept), true);
  assert.equal(kept.asked, 0);
});

test('askToKeep never fails, even where the browser has no such thing', async () => {
  assert.equal(await askToKeep(undefined), false);
  assert.equal(await askToKeep({}), false);
  assert.equal(await askToKeep(storageManager({ fails: true })), false);
  assert.equal(await askToKeep({ persist: async () => true }), true, 'works without persisted()');
});
