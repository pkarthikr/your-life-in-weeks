// Rules for the Settings screen: checking a birthday or an important week
// before it is saved, and updating the list of important weeks.
// Pure functions — no DOM, no storage — so they are safe to unit test.

import { YEARS, parseISODate, addYears, addDays } from './weeks.js';
import { colorOrDefault } from './colors.js';

export const EARLIEST_YEAR = 1900;

/** Why `value` can't be saved as a birthday, or '' if it can. */
export function birthdayError(value, today) {
  const date = parseISODate(value);
  if (!date) return 'Pick your date of birth.';
  if (date.getFullYear() < EARLIEST_YEAR) return `Pick a date in ${EARLIEST_YEAR} or later.`;
  if (date > today) return 'That date is in the future.';
  return '';
}

/** The last day that still fits on the calendar for someone born on `birth`. */
export function lastCalendarDay(birth, years = YEARS) {
  return addDays(addYears(birth, years), -1);
}

/**
 * Why a new important week can't be added, or null if it can.
 * Returns `{ field, message }`; `field` names the input to fix:
 * 'birthday', 'date' or 'label'.
 */
export function eventError(birthday, value, label, years = YEARS) {
  const birth = parseISODate(birthday);
  if (!birth) return { field: 'birthday', message: 'Add your birthday first.' };
  const date = parseISODate(value);
  if (!date) return { field: 'date', message: 'Pick a date.' };
  if (!String(label ?? '').trim()) return { field: 'label', message: 'Say what happened that week.' };
  if (date < birth) return { field: 'date', message: 'That date is before you were born.' };
  if (date > lastCalendarDay(birth, years)) {
    return { field: 'date', message: 'That date is past the end of your calendar.' };
  }
  return null;
}

/**
 * A copy of `events` with one more added under the next free id.
 * A missing or unknown `color` falls back to the default.
 */
export function addEvent(events, date, label, color) {
  const id = events.reduce((max, e) => (Number.isSafeInteger(e.id) ? Math.max(max, e.id) : max), 0) + 1;
  return [...events, { id, date, label: String(label).trim(), color: colorOrDefault(color) }];
}

/** A copy of `events` without the one with this id. */
export function removeEvent(events, id) {
  return events.filter((e) => e.id !== id);
}
