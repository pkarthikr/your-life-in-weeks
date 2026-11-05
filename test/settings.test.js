import { test } from 'node:test';
import assert from 'node:assert/strict';

import { YEARS, parseISODate, toISODate, addDays, weekPosition } from '../site/js/weeks.js';
import {
  birthdayError,
  eventError,
  lastCalendarDay,
  addEvent,
  updateEvent,
  removeEvent,
  chapterError,
  addChapter,
  updateChapter,
  removeChapter,
  nextChapterColor,
} from '../site/js/settings.js';
import { COLORS } from '../site/js/colors.js';

const d = (s) => parseISODate(s);
const today = d('2026-11-04');

test('birthdayError accepts real past dates from 1900 on', () => {
  assert.equal(birthdayError('1990-01-01', today), '');
  assert.equal(birthdayError('1900-01-01', today), '');
  assert.equal(birthdayError('2026-11-04', today), '');
});

test('birthdayError explains what is wrong', () => {
  assert.equal(birthdayError('', today), 'Pick your date of birth.');
  assert.equal(birthdayError('2023-02-30', today), 'Pick your date of birth.');
  assert.equal(birthdayError('0199-05-12', today), 'Pick a date in 1900 or later.');
  assert.equal(birthdayError('1899-12-31', today), 'Pick a date in 1900 or later.');
  assert.equal(birthdayError('2026-11-05', today), 'That date is in the future.');
});

test('lastCalendarDay is the final day of the last row', () => {
  const b = d('1990-06-15');
  assert.equal(toISODate(lastCalendarDay(b, 90)), '2080-06-14');
  assert.deepEqual(weekPosition(b, lastCalendarDay(b, 90)), { row: 89, col: 51 });
  // Leap-day birthdays: the 90th birthday falls on Mar 1 in a common year.
  assert.equal(toISODate(lastCalendarDay(d('2000-02-29'), 90)), '2090-02-28');
});

test('lastCalendarDay defaults to the full grid', () => {
  const b = d('1990-06-15');
  assert.deepEqual(weekPosition(b, lastCalendarDay(b)), { row: YEARS - 1, col: 51 });
});

test('eventError accepts dates from the birthday to the end of the calendar', () => {
  const last = toISODate(lastCalendarDay(d('1990-06-15')));
  assert.equal(eventError('1990-06-15', '1990-06-15', 'Born'), null);
  assert.equal(eventError('1990-06-15', '2015-03-02', '  Moved to Seattle '), null);
  assert.equal(eventError('1990-06-15', last, 'Last week'), null);
  assert.equal(eventError('1990-06-15', '2080-06-14', 'Last week', 90), null);
});

test('eventError names the field to fix', () => {
  const pastEnd = toISODate(addDays(lastCalendarDay(d('1990-06-15')), 1));
  assert.deepEqual(eventError('', '2015-03-02', 'x'), { field: 'birthday', message: 'Add your birthday first.' });
  assert.deepEqual(eventError('1990-06-15', '', 'x'), { field: 'date', message: 'Pick a date.' });
  assert.deepEqual(eventError('1990-06-15', '2015-03-02', '   '), { field: 'label', message: 'Say what happened that week.' });
  assert.deepEqual(eventError('1990-06-15', '1990-06-14', 'x'), { field: 'date', message: 'That date is before you were born.' });
  assert.deepEqual(eventError('1990-06-15', pastEnd, 'x'), { field: 'date', message: 'That date is past the end of your calendar.' });
  assert.deepEqual(eventError('1990-06-15', '2080-06-15', 'x', 90), { field: 'date', message: 'That date is past the end of your calendar.' });
});

test('addEvent appends with the next free id, trims the label and keeps the color', () => {
  assert.deepEqual(addEvent([], '2015-03-02', ' Moved ', 'teal'), [{ id: 1, date: '2015-03-02', label: 'Moved', color: 'teal' }]);
  const events = [{ id: 4, date: '2010-01-01', label: 'A' }, { id: 2, date: '2012-01-01', label: 'B' }];
  const next = addEvent(events, '2014-01-01', 'C', 'pink');
  assert.deepEqual(next.at(-1), { id: 5, date: '2014-01-01', label: 'C', color: 'pink' });
  assert.equal(events.length, 2, 'does not change the list it was given');
});

test('addEvent falls back to the default color', () => {
  assert.equal(addEvent([], '2015-03-02', 'x').at(-1).color, 'blue');
  assert.equal(addEvent([], '2015-03-02', 'x', 'neon').at(-1).color, 'blue');
});

test('updateEvent changes only the matching id, in place', () => {
  const events = [{ id: 1, date: '2010-01-01', label: 'A', color: 'blue' }, { id: 2, date: '2012-01-01', label: 'B', color: 'pink' }];
  assert.deepEqual(updateEvent(events, 2, '2013-02-02', '  Bee ', 'green'), [
    events[0],
    { id: 2, date: '2013-02-02', label: 'Bee', color: 'green' },
  ]);
  assert.equal(updateEvent(events, 2, '2013-02-02', 'x', 'neon')[1].color, 'blue');
  assert.deepEqual(updateEvent(events, 9, '2013-02-02', 'x', 'green'), events);
  assert.equal(events[1].label, 'B', 'does not change the list it was given');
});

test('removeEvent drops only the matching id', () => {
  const events = [{ id: 1, date: '2010-01-01', label: 'A' }, { id: 2, date: '2012-01-01', label: 'B' }];
  assert.deepEqual(removeEvent(events, 1), [{ id: 2, date: '2012-01-01', label: 'B' }]);
  assert.deepEqual(removeEvent(events, 9), events);
  assert.equal(events.length, 2, 'does not change the list it was given');
});

// ---- Chapters -----------------------------------------------------------------

test('chapterError accepts finished, future and still-going chapters on the calendar', () => {
  const last = toISODate(lastCalendarDay(d('1990-06-15')));
  assert.equal(chapterError('1990-06-15', '2008-08-25', '2012-05-15', 'College', today), null);
  assert.equal(chapterError('1990-06-15', '2019-09-01', '', 'London', today), null);
  assert.equal(chapterError('1990-06-15', '2026-11-04', '', 'Began today', today), null);
  assert.equal(chapterError('1990-06-15', '2027-09-01', '2029-06-30', 'Sabbatical', today), null);
  assert.equal(chapterError('1990-06-15', '1990-06-15', last, 'All of it', today), null);
  assert.equal(chapterError('1990-06-15', '2010-01-01', '2010-01-01', 'One day', today), null);
});

test('chapterError names the field to fix', () => {
  const pastEnd = toISODate(addDays(lastCalendarDay(d('1990-06-15')), 1));
  const check = (start, end, label) => chapterError('1990-06-15', start, end, label, today);
  assert.deepEqual(chapterError('', '2008-08-25', '', 'x', today), { field: 'birthday', message: 'Add your birthday first.' });
  assert.deepEqual(check('', '', 'x'), { field: 'start', message: 'Pick when it began.' });
  assert.deepEqual(check('2008-08-25', '2012-02-30', 'x'), { field: 'end', message: 'Pick when it ended, or leave To empty if it’s still going.' });
  assert.deepEqual(check('2008-08-25', '', '  '), { field: 'label', message: 'Give it a name.' });
  assert.deepEqual(check('1990-06-14', '', 'x'), { field: 'start', message: 'That date is before you were born.' });
  assert.deepEqual(check(pastEnd, '', 'x'), { field: 'start', message: 'That date is past the end of your calendar.' });
  assert.deepEqual(check('2008-08-25', pastEnd, 'x'), { field: 'end', message: 'That date is past the end of your calendar.' });
  assert.deepEqual(check('2012-05-15', '2008-08-25', 'x'), { field: 'end', message: 'That’s before it began.' });
  assert.deepEqual(check('2026-11-05', '', 'x'), { field: 'end', message: 'It hasn’t begun yet, so add when it ends.' });
});

test('important weeks and chapters use the same calendar limits', () => {
  for (const date of ['1990-06-14', '1990-06-15', '2090-06-14', '2090-06-15']) {
    const event = eventError('1990-06-15', date, 'x');
    const chapter = chapterError('1990-06-15', date, '', 'x', d('2100-01-01'));
    assert.equal(event?.message, chapter?.message, date);
  }
});

test('addChapter appends with the next free id, trims the name and keeps the color', () => {
  assert.deepEqual(addChapter([], '2008-08-25', '2012-05-15', ' College ', 'teal'), [
    { id: 1, start: '2008-08-25', end: '2012-05-15', label: 'College', color: 'teal' },
  ]);
  const chapters = [{ id: 3, start: '2008-08-25', end: '', label: 'A', color: 'blue' }];
  const next = addChapter(chapters, '2019-09-01', '', 'London', 'neon');
  assert.deepEqual(next.at(-1), { id: 4, start: '2019-09-01', end: '', label: 'London', color: 'blue' });
  assert.equal(addChapter([], '2019-09-01', undefined, 'x').at(-1).end, '');
  assert.equal(chapters.length, 1, 'does not change the list it was given');
});

test('updateChapter changes only the matching id, in place', () => {
  const chapters = [
    { id: 1, start: '2008-08-25', end: '', label: 'A', color: 'blue' },
    { id: 2, start: '2010-01-01', end: '2012-01-01', label: 'B', color: 'pink' },
  ];
  assert.deepEqual(updateChapter(chapters, 2, '2010-02-01', '', ' Bee ', 'green'), [
    chapters[0],
    { id: 2, start: '2010-02-01', end: '', label: 'Bee', color: 'green' },
  ]);
  assert.deepEqual(updateChapter(chapters, 9, '2010-02-01', '', 'x', 'green'), chapters);
  assert.equal(chapters[1].label, 'B', 'does not change the list it was given');
});

test('removeChapter drops only the matching id', () => {
  const chapters = [{ id: 1, label: 'A' }, { id: 2, label: 'B' }];
  assert.deepEqual(removeChapter(chapters, 1), [{ id: 2, label: 'B' }]);
  assert.deepEqual(removeChapter(chapters, 9), chapters);
  assert.equal(chapters.length, 2);
});

test('nextChapterColor offers the color the fewest chapters have, first in the palette on a tie', () => {
  const with_ = (...colors) => colors.map((color, i) => ({ id: i + 1, color }));
  assert.equal(nextChapterColor([]), COLORS[0].id);
  assert.equal(nextChapterColor(with_('blue')), 'violet');
  assert.equal(nextChapterColor(with_('violet')), 'blue');
  assert.equal(nextChapterColor(with_('blue', 'violet', 'pink', 'red', 'green')), 'teal');
  // Every color once: round again from the start.
  assert.equal(nextChapterColor(with_(...COLORS.map((c) => c.id))), COLORS[0].id);
  assert.equal(nextChapterColor(with_(...COLORS.map((c) => c.id), 'blue')), 'violet');
  assert.equal(nextChapterColor(with_('neon')), COLORS[0].id);
});
