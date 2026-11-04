import { test } from 'node:test';
import assert from 'node:assert/strict';

import { YEARS, parseISODate, toISODate, addDays, weekPosition } from '../site/js/weeks.js';
import {
  birthdayError,
  eventError,
  lastCalendarDay,
  addEvent,
  removeEvent,
} from '../site/js/settings.js';

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

test('addEvent appends with the next free id and trims the label', () => {
  assert.deepEqual(addEvent([], '2015-03-02', ' Moved '), [{ id: 1, date: '2015-03-02', label: 'Moved' }]);
  const events = [{ id: 4, date: '2010-01-01', label: 'A' }, { id: 2, date: '2012-01-01', label: 'B' }];
  const next = addEvent(events, '2014-01-01', 'C');
  assert.deepEqual(next.at(-1), { id: 5, date: '2014-01-01', label: 'C' });
  assert.equal(events.length, 2, 'does not change the list it was given');
});

test('removeEvent drops only the matching id', () => {
  const events = [{ id: 1, date: '2010-01-01', label: 'A' }, { id: 2, date: '2012-01-01', label: 'B' }];
  assert.deepEqual(removeEvent(events, 1), [{ id: 2, date: '2012-01-01', label: 'B' }]);
  assert.deepEqual(removeEvent(events, 9), events);
  assert.equal(events.length, 2, 'does not change the list it was given');
});
