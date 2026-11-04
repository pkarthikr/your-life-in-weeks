import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  YEARS,
  parseISODate,
  toISODate,
  formatDate,
  formatWhen,
  weekPosition,
  weekStart,
  lifeStats,
  eventsByWeek,
  sortEvents,
  cellState,
} from '../site/js/weeks.js';

const d = (s) => parseISODate(s);

test('parseISODate accepts real dates and rejects everything else', () => {
  assert.equal(toISODate(d('1990-01-01')), '1990-01-01');
  assert.equal(toISODate(d('2024-02-29')), '2024-02-29');
  assert.equal(d('2023-02-29'), null);
  assert.equal(d('2023-13-01'), null);
  assert.equal(d('1990-1-1'), null);
  assert.equal(d(''), null);
  assert.equal(d(undefined), null);
  assert.equal(d('not a date'), null);
  assert.equal(d('0099-06-01').getFullYear(), 99);
});

test('formatDate', () => {
  assert.equal(formatDate(d('1990-01-01')), 'Jan 1, 1990');
  assert.equal(formatDate(d('2026-11-04')), 'Nov 4, 2026');
});

test('weekPosition: rows start on the birthday', () => {
  const b = d('1990-06-15');
  assert.deepEqual(weekPosition(b, b), { row: 0, col: 0 });
  assert.deepEqual(weekPosition(b, d('1990-06-21')), { row: 0, col: 0 });
  assert.deepEqual(weekPosition(b, d('1990-06-22')), { row: 0, col: 1 });
  assert.deepEqual(weekPosition(b, d('1991-06-14')), { row: 0, col: 51 });
  assert.deepEqual(weekPosition(b, d('1991-06-15')), { row: 1, col: 0 });
  assert.equal(weekPosition(b, d('1990-06-14')), null);
});

test('weekPosition: last week of a year absorbs leftover days', () => {
  const b = d('2001-01-01');
  // Day 364 of the year (Dec 31) is past 52 * 7 = 364 days, still week 52.
  assert.deepEqual(weekPosition(b, d('2001-12-31')), { row: 0, col: 51 });
});

test('weekPosition: leap-day birthdays', () => {
  const b = d('2000-02-29');
  assert.deepEqual(weekPosition(b, d('2001-02-28')), { row: 0, col: 51 });
  assert.deepEqual(weekPosition(b, d('2001-03-01')), { row: 1, col: 0 });
  assert.deepEqual(weekPosition(b, d('2004-02-29')), { row: 4, col: 0 });
});

test('formatWhen gives the date, age and week (counted from 1)', () => {
  const b = d('1990-06-15');
  assert.equal(formatWhen(b, d('2015-03-02')), 'Mar 2, 2015 · age 24, week 38');
  assert.equal(formatWhen(b, b), 'Jun 15, 1990 · age 0, week 1');
  assert.equal(formatWhen(b, d('1991-06-14')), 'Jun 14, 1991 · age 0, week 52');
  assert.equal(formatWhen(b, d('1990-06-14')), 'Jun 14, 1990');
});

test('weekStart is the inverse of weekPosition', () => {
  const b = d('1985-03-10');
  for (const [row, col] of [[0, 0], [12, 7], [40, 51]]) {
    assert.deepEqual(weekPosition(b, weekStart(b, row, col)), { row, col });
  }
});

test('the grid covers 100 years', () => {
  assert.equal(YEARS, 100);
  const s = lifeStats(d('1931-11-10'), d('2026-11-04')); // 94 years old
  assert.equal(s.total, 5200);
  assert.equal(s.age, 94);
  assert.ok(s.ahead > 0);
});

test('lifeStats for someone born today', () => {
  const s = lifeStats(d('2026-11-04'), d('2026-11-04'));
  assert.equal(s.total, YEARS * 52);
  assert.equal(s.age, 0);
  assert.equal(s.week, 1);
  assert.equal(s.lived, 0);
  assert.equal(s.ahead, s.total - 1);
  assert.equal(s.percent, 0);
});

test('lifeStats mid-life', () => {
  const s = lifeStats(d('1990-01-01'), d('2026-11-04'));
  assert.equal(s.age, 36);
  assert.equal(s.week, 44);
  assert.equal(s.nowIndex, 36 * 52 + 43);
  assert.equal(s.lived, s.nowIndex);
  assert.equal(s.lived + 1 + s.ahead, s.total);
});

test('lifeStats past the end of the grid caps at 100%', () => {
  const s = lifeStats(d('1920-01-01'), d('2026-11-04'));
  assert.equal(s.lived, s.total);
  assert.equal(s.ahead, 0);
  assert.equal(s.percent, 100);
});

test('eventsByWeek groups, sorts and drops out-of-range events', () => {
  const b = d('1990-01-01');
  const map = eventsByWeek(b, [
    { id: 2, date: '2015-03-04', label: 'Second' },
    { id: 1, date: '2015-03-02', label: 'First' },
    { id: 3, date: '1989-12-31', label: 'Before birth' },
    { id: 4, date: '2090-01-01', label: 'Past the grid' },
    { id: 5, date: 'garbage', label: 'Bad date' },
    { id: 6, date: '2089-12-31', label: 'Last week of the grid' },
  ]);
  assert.equal(map.size, 2);
  assert.ok(map.has(YEARS * 52 - 1));
  const [index, list] = [...map][0];
  const pos = weekPosition(b, d('2015-03-02'));
  assert.equal(index, pos.row * 52 + pos.col);
  assert.deepEqual(list.map((e) => e.label), ['First', 'Second']);
});

test('sortEvents orders by date, keeps same-day order, and copies', () => {
  const events = [
    { id: 1, date: '2015-03-04' },
    { id: 2, date: '2010-01-01' },
    { id: 3, date: '2015-03-04' },
  ];
  assert.deepEqual(sortEvents(events).map((e) => e.id), [2, 1, 3]);
  assert.deepEqual(events.map((e) => e.id), [1, 2, 3]);
});

test('cellState', () => {
  const events = new Map([[5, [{}]]]);
  assert.equal(cellState(1, 3, events), 'lived');
  assert.equal(cellState(3, 3, events), 'now');
  assert.equal(cellState(4, 3, events), 'ahead');
  assert.equal(cellState(5, 3, events), 'event');
});
