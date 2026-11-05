import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  YEARS,
  WEEKS_PER_YEAR,
  BIRTH_WEEK,
  parseISODate,
  toISODate,
  formatDate,
  formatWhen,
  weekPosition,
  weekStart,
  lifeStats,
  reachOf,
  calendarYears,
  totalWeeks,
  MAX_YEARS,
  eventsByWeek,
  sortEvents,
  cellState,
  weekIndex,
  sortChapters,
  chapterSpan,
  chaptersByWeek,
  describeChapter,
  CHAPTERS_PER_WEEK,
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

test('the week you were born is the first square', () => {
  const b = d('1990-06-15');
  const { row, col } = weekPosition(b, b);
  assert.equal(row * WEEKS_PER_YEAR + col, BIRTH_WEEK);
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

test('the grid covers 90 years by default', () => {
  assert.equal(YEARS, 90);
  const s = lifeStats(d('1941-11-01'), d('2026-11-04')); // 85 years old
  assert.equal(s.total, 4680);
  assert.equal(s.age, 85);
  assert.ok(s.ahead > 0);
});

test('lifeStats for someone born today', () => {
  const s = lifeStats(d('2026-11-04'), d('2026-11-04'));
  assert.equal(s.total, YEARS * 52);
  assert.equal(s.age, 0);
  assert.equal(s.week, 1);
  assert.equal(s.lived, 0);
  assert.equal(s.ahead, s.total - 1);
});

test('lifeStats mid-life', () => {
  const s = lifeStats(d('1990-01-01'), d('2026-11-04'));
  assert.equal(s.age, 36);
  assert.equal(s.week, 44);
  assert.equal(s.nowIndex, 36 * 52 + 43);
  assert.equal(s.lived, s.nowIndex);
  assert.equal(s.lived + 1 + s.ahead, s.total);
});

test('lifeStats past the end of the span counts every week lived, with none ahead', () => {
  const s = lifeStats(d('1920-01-01'), d('2026-11-04'));
  assert.equal(s.lived, s.nowIndex);
  assert.ok(s.lived > s.total);
  assert.equal(s.ahead, 0);
  // The grid runs on just far enough to show this week.
  assert.equal(s.shown, s.nowIndex + 1);
  assert.equal(s.rows, 107);
  assert.equal(s.past, true);
});

test('lifeStats takes any span, including part of a year', () => {
  const s = lifeStats(d('1990-01-01'), d('2026-11-04'), 72.4);
  assert.equal(s.total, 3765); // 72.4 × 52, rounded
  assert.equal(s.shown, 3765);
  assert.equal(s.rows, 73); // the last row is part of a year
  assert.equal(s.past, false);
  assert.equal(s.lived + 1 + s.ahead, s.total);

  const long = lifeStats(d('1990-01-01'), d('2026-11-04'), 120);
  assert.equal(long.total, 6240);
  assert.equal(long.rows, 120);
});

test('the grid runs on past the span to hold what is saved there', () => {
  const s = lifeStats(d('1990-01-01'), d('2026-11-04'), 40, 45 * 52);
  assert.equal(s.total, 2080);
  assert.equal(s.shown, 45 * 52 + 1);
  assert.equal(s.past, true);
  assert.equal(s.ahead, s.total - s.nowIndex - 1); // saved weeks don't change the span
  assert.equal(reachOf(new Map([[3, 1]]), new Map([[9, 1], [5, 1]])), 9);
  assert.equal(reachOf(new Map()), -1);
});

test('calendarYears covers the span, or this week for someone past it', () => {
  assert.equal(calendarYears(d('1990-01-01'), d('2026-11-04'), 72.4), 73);
  assert.equal(calendarYears(d('1990-01-01'), d('2026-11-04'), 30), 37);
  assert.equal(totalWeeks(100), 5200);
});

test('events and chapters beyond the span are kept, up to MAX_YEARS', () => {
  const b = d('1990-01-01');
  assert.equal(eventsByWeek(b, [{ date: '2070-01-01', label: 'x' }]).size, 1);
  assert.equal(eventsByWeek(b, [{ date: '2200-01-01', label: 'x' }]).size, 0);
  assert.equal(MAX_YEARS, 150);
});

test('eventsByWeek groups, sorts and drops out-of-range events', () => {
  const b = d('1990-01-01');
  const map = eventsByWeek(b, [
    { id: 2, date: '2015-03-04', label: 'Second' },
    { id: 1, date: '2015-03-02', label: 'First' },
    { id: 3, date: '1989-12-31', label: 'Before birth' },
    { id: 4, date: '2080-01-01', label: 'Past the grid' },
    { id: 5, date: 'garbage', label: 'Bad date' },
    { id: 6, date: '2079-12-31', label: 'Last week of the grid' },
  ], YEARS);
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
  assert.equal(cellState(4, 3, events, 4), 'past');
  assert.equal(cellState(4, 3, events, 5), 'ahead');
  assert.equal(cellState(2, 3, events, 1), 'lived'); // outlived: still lived
  assert.equal(cellState(5, 3, events, 4), 'event');
});

// ---- Chapters -----------------------------------------------------------------

const born = d('1990-06-15');
const today = d('2026-11-05');
const at = (date) => weekIndex(born, d(date));
const ch = (id, start, end, label = `#${id}`, color = 'blue') => ({ id, start, end, label, color });

test('weekIndex is the grid index of a date, or null before the birthday', () => {
  assert.equal(weekIndex(born, born), 0);
  assert.equal(weekIndex(born, d('1990-06-22')), 1);
  assert.equal(weekIndex(born, d('1991-06-15')), WEEKS_PER_YEAR);
  assert.equal(weekIndex(born, d('1990-06-14')), null);
});

test('chapterSpan covers the weeks from start to end, both included', () => {
  assert.deepEqual(chapterSpan(born, ch(1, '2008-08-25', '2012-05-15'), today), { first: at('2008-08-25'), last: at('2012-05-15') });
  // A chapter inside a single week.
  assert.deepEqual(chapterSpan(born, ch(1, '1990-06-16', '1990-06-18'), today), { first: 0, last: 0 });
  // One that ends in the future.
  assert.deepEqual(chapterSpan(born, ch(1, '2027-09-01', '2029-06-30'), today), { first: at('2027-09-01'), last: at('2029-06-30') });
});

test('chapterSpan: a chapter still going runs up to this week', () => {
  const span = chapterSpan(born, ch(1, '2019-09-01', ''), today);
  assert.equal(span.last, lifeStats(born, today).nowIndex);
  // It can't have begun after today.
  assert.equal(chapterSpan(born, ch(1, '2027-01-01', ''), today), null);
});

test('chapterSpan cuts off what is not on the grid', () => {
  // Begins before the birthday (the birthday was changed after it was added).
  assert.deepEqual(chapterSpan(born, ch(1, '1985-01-01', '1991-01-01'), today), { first: 0, last: at('1991-01-01') });
  assert.equal(chapterSpan(born, ch(1, '1985-01-01', '1989-01-01'), today), null);
  // Runs past the end of the grid, or begins after it.
  assert.deepEqual(chapterSpan(born, ch(1, '2070-01-01', '2095-01-01'), today, YEARS), { first: at('2070-01-01'), last: YEARS * WEEKS_PER_YEAR - 1 });
  assert.equal(chapterSpan(born, ch(1, '2081-01-01', '2095-01-01'), today, YEARS), null);
  // Someone older than the grid with a chapter still going.
  const old = d('1920-01-01');
  assert.deepEqual(chapterSpan(old, ch(1, '2005-01-01', ''), today, YEARS).last, YEARS * WEEKS_PER_YEAR - 1);
});

test('chapterSpan is null for a chapter it cannot place', () => {
  assert.equal(chapterSpan(null, ch(1, '2008-08-25', '2012-05-15'), today), null);
  assert.equal(chapterSpan(born, ch(1, 'garbage', '2012-05-15'), today), null);
  assert.equal(chapterSpan(born, ch(1, '2008-08-25', '2012-02-30'), today), null);
  assert.equal(chapterSpan(born, ch(1, '2012-05-15', '2008-08-25'), today), null);
});

test('sortChapters orders by start, then end, with one still going last, and copies', () => {
  const chapters = [ch(1, '2012-06-01', ''), ch(2, '2008-08-25', '2012-05-15'), ch(3, '2012-06-01', '2017-03-31'), ch(4, '2008-08-25', '2012-05-15')];
  assert.deepEqual(sortChapters(chapters).map((c) => c.id), [2, 4, 3, 1]);
  assert.deepEqual(chapters.map((c) => c.id), [1, 2, 3, 4]);
});

test('chaptersByWeek lists the chapters of each week', () => {
  const college = ch(1, '2008-08-25', '2012-05-15');
  const map = chaptersByWeek(born, [college], today);
  assert.equal(map.size, at('2012-05-15') - at('2008-08-25') + 1);
  assert.deepEqual(map.get(at('2010-01-01')), [college]);
  assert.equal(map.has(at('2008-08-24') - 1), false);
});

test('chaptersByWeek: overlapping chapters keep a lane each, for all their weeks', () => {
  const seattle = ch(1, '2012-06-01', '2019-08-31', 'Seattle');
  const acme = ch(2, '2012-07-02', '2017-03-31', 'Acme');
  const sam = ch(3, '2014-02-14', '', 'Sam');
  const london = ch(4, '2019-09-02', '', 'London');
  // Listed in any order; lanes follow the dates.
  const map = chaptersByWeek(born, [sam, london, acme, seattle], today);
  const labels = (date) => map.get(at(date)).map((c) => c.label);
  assert.deepEqual(labels('2012-06-10'), ['Seattle']);
  assert.deepEqual(labels('2013-01-01'), ['Seattle', 'Acme']); // Acme began inside Seattle: the lane after it
  assert.deepEqual(labels('2015-01-01'), ['Seattle', 'Acme', 'Sam']);
  assert.deepEqual(labels('2018-01-01'), ['Seattle', 'Sam']); // Sam keeps its lane after Acme ends
  // London starts once Seattle has ended and takes the lane Acme left; Sam still comes after it.
  assert.deepEqual(labels('2020-01-01'), ['London', 'Sam']);
});

test('chaptersByWeek: a chapter that begins with another, and is shorter, goes in the lane after it', () => {
  const short = ch(1, '2010-01-01', '2010-06-01', 'Short');
  const long = ch(2, '2010-01-01', '2015-01-01', 'Long');
  const map = chaptersByWeek(born, [short, long], today);
  assert.deepEqual(map.get(at('2010-02-01')).map((c) => c.label), ['Long', 'Short']);
  // Same dates: the one added first comes first.
  const twin = ch(3, '2010-01-01', '2015-01-01', 'Twin');
  assert.deepEqual(chaptersByWeek(born, [long, twin], today).get(at('2012-01-01')).map((c) => c.label), ['Long', 'Twin']);
});

test('chaptersByWeek leaves out chapters that are not on the grid', () => {
  const map = chaptersByWeek(born, [ch(1, '1980-01-01', '1985-01-01'), ch(2, 'bad', '')], today);
  assert.equal(map.size, 0);
});

test('a week shows at most three chapters', () => {
  assert.equal(CHAPTERS_PER_WEEK, 3);
});

test('describeChapter gives the dates and the weeks the chapter covers', () => {
  assert.equal(describeChapter(born, ch(1, '2008-08-25', '2012-05-15'), today), 'Aug 25, 2008 – May 15, 2012 · 194 weeks');
  assert.equal(describeChapter(born, ch(1, '2026-11-02', ''), today), 'Nov 2, 2026 – now · 1 week');
  assert.equal(describeChapter(born, ch(1, '2027-09-01', '2029-06-30'), today), 'Sep 1, 2027 – Jun 30, 2029 · 96 weeks');
  // No birthday, or nothing on the grid: just the dates.
  assert.equal(describeChapter(null, ch(1, '2008-08-25', ''), today), 'Aug 25, 2008 – now');
  assert.equal(describeChapter(born, ch(1, '1980-01-01', '1985-01-01'), today), 'Jan 1, 1980 – Jan 1, 1985');
});
