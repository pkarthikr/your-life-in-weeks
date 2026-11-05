import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseISODate } from '../site/js/weeks.js';
import { STORAGE_KEY, load, save } from '../site/js/storage.js';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  hasData,
  backupFile,
  sizeError,
  readBackup,
  summary,
  exportedOn,
} from '../site/js/backup.js';

const today = parseISODate('2026-11-05');

const DATA = Object.freeze({
  birthday: '1990-06-15',
  theme: 'light',
  events: [
    { id: 1, date: '2008-09-01', label: 'Started university', color: 'violet' },
    { id: 4, date: '2015-03-02', label: 'Moved to “Seattle” — 🌧', color: 'teal' },
  ],
});

/** A backup file's text with these fields on top of a real one. */
function backupWith(fields) {
  return JSON.stringify({ ...JSON.parse(backupFile(DATA, today).text), ...fields });
}

function memoryStore(initial = {}) {
  const items = { ...initial };
  return {
    getItem: (k) => (k in items ? items[k] : null),
    setItem: (k, v) => { items[k] = String(v); },
  };
}

test('a backup is named for the day it was made and holds everything that is saved', () => {
  const { name, text } = backupFile(DATA, today);
  assert.equal(name, 'life-in-weeks-backup-2026-11-05.json');
  assert.deepEqual(JSON.parse(text), {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported: '2026-11-05',
    birthday: DATA.birthday,
    theme: DATA.theme,
    events: DATA.events,
  });
  assert.ok(text.includes('\n  "birthday"'), 'indented, so it is readable');
});

test('a backup restores exactly what was backed up', () => {
  const restored = readBackup(backupFile(DATA, today).text);
  assert.deepEqual(restored, { data: DATA, exported: '2026-11-05' });
});

test('restoring replaces everything that was in the browser', () => {
  const before = { birthday: '1985-01-01', theme: 'dark', events: [{ id: 9, date: '2000-01-01', label: 'Old', color: 'red' }] };
  const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(before) });
  save(readBackup(backupFile(DATA, today).text).data, store);
  assert.deepEqual(load(store), DATA);
});

test('a file that is not one of ours is turned away', () => {
  const notOurs = 'That file isn’t a Life in Weeks backup.';
  for (const text of [
    '',
    'not json',
    'null',
    '[]',
    '"life-in-weeks"',
    JSON.stringify(DATA), // no app marker
    backupWith({ app: 'some-other-app' }),
    backupWith({ version: undefined }),
    backupWith({ version: 0 }),
    backupWith({ version: '1' }),
    backupWith({ version: 1.5 }),
    backupWith({ events: { 1: DATA.events[0] } }),
  ]) {
    assert.deepEqual(readBackup(text), { error: notOurs }, text);
  }
});

test('a backup from a newer version asks for a reload', () => {
  assert.match(readBackup(backupWith({ version: BACKUP_VERSION + 1 })).error, /newer version.*Reload/);
});

test('a backup with a broken birthday is turned away', () => {
  for (const birthday of ['1990-02-30', 'June 1990', 19900615, null]) {
    assert.deepEqual(readBackup(backupWith({ birthday })), { error: 'The birthday in this backup isn’t a valid date.' }, String(birthday));
  }
});

test('an empty backup is turned away, so it can never wipe what is here', () => {
  const empty = { error: 'This backup is empty: it has no birthday or important weeks.' };
  assert.deepEqual(readBackup(backupWith({ birthday: '', events: [] })), empty);
  assert.deepEqual(readBackup(JSON.stringify({ app: BACKUP_APP, version: 1 })), empty);
  assert.deepEqual(readBackup(backupWith({ birthday: '', events: [{ label: 'no date' }] })), empty);
});

test('a backup with only some of it is still restored', () => {
  assert.deepEqual(readBackup(backupWith({ events: undefined })).data, { ...DATA, events: [] });
  assert.deepEqual(readBackup(backupWith({ birthday: undefined })).data, { ...DATA, birthday: '' });
  assert.equal(readBackup(backupWith({ theme: undefined })).data.theme, 'dark');
});

test('important weeks are cleaned the same way as a normal load', () => {
  const events = [
    { id: 2, date: '2001-01-01', label: 'a', color: 'neon' },
    { id: 2, date: '2002-01-01', label: 'b', color: 'pink' },
    null,
    { date: '2003-01-01' },
    { date: '2004-01-01', label: 'c', extra: true },
  ];
  assert.deepEqual(readBackup(backupWith({ events })).data.events, [
    { id: 2, date: '2001-01-01', label: 'a', color: 'blue' },
    { id: 3, date: '2002-01-01', label: 'b', color: 'pink' },
    { id: 4, date: '2004-01-01', label: 'c', color: 'blue' },
  ]);
});

test('the birthday is saved in the form the app writes', () => {
  assert.equal(readBackup(backupWith({ birthday: ' 1990-06-15 ' })).data.birthday, '1990-06-15');
});

test('a backup that does not say when it was made still restores', () => {
  for (const exported of [undefined, '', 'yesterday', 20261105]) {
    assert.equal(readBackup(backupWith({ exported })).exported, '', String(exported));
  }
});

test('sizeError turns away files far bigger than a backup', () => {
  assert.equal(sizeError(0), '');
  assert.equal(sizeError(MAX_BACKUP_BYTES), '');
  assert.equal(sizeError(MAX_BACKUP_BYTES + 1), 'That file is too big to be a Life in Weeks backup.');
});

test('the largest real backup is well under the size limit', () => {
  const events = Array.from({ length: 5200 }, (_, i) => ({ id: i + 1, date: '2000-01-01', label: 'x'.repeat(100), color: 'violet' }));
  const { text } = backupFile({ ...DATA, events }, today);
  assert.equal(sizeError(Buffer.byteLength(text)), '');
  assert.equal(readBackup(text).data.events.length, 5200);
});

test('hasData: a birthday or an important week; a theme alone is not worth a backup', () => {
  assert.equal(hasData(DATA), true);
  assert.equal(hasData({ ...DATA, birthday: '' }), true);
  assert.equal(hasData({ ...DATA, events: [] }), true);
  assert.equal(hasData({ birthday: '', events: [], theme: 'light' }), false);
});

test('summary says what a backup, or the browser, holds', () => {
  assert.equal(summary(DATA), 'Born Jun 15, 1990 · 2 important weeks');
  assert.equal(summary({ ...DATA, events: DATA.events.slice(0, 1) }), 'Born Jun 15, 1990 · 1 important week');
  assert.equal(summary({ ...DATA, events: [] }), 'Born Jun 15, 1990 · no important weeks');
  assert.equal(summary({ birthday: '', events: Array(1200).fill({}) }), 'No birthday · 1,200 important weeks');
});

test('exportedOn formats the day a backup was made', () => {
  assert.equal(exportedOn('2026-11-05'), 'Nov 5, 2026');
  assert.equal(exportedOn(''), '');
});
