// Rules for the Settings screen: checking a birthday, an important week or
// a chapter before it is saved, and updating the lists of them.
// Pure functions — no DOM, no storage — so they are safe to unit test.

import { YEARS, parseISODate, addYears, addDays } from './weeks.js';
import { COLORS, colorOrDefault } from './colors.js';

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

/** Why `date` isn't on the calendar for someone born on `birth`, or '' if it is. */
function offCalendar(birth, date, years) {
  if (date < birth) return 'That date is before you were born.';
  if (date > lastCalendarDay(birth, years)) return 'That date is past the end of your calendar.';
  return '';
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
  const off = offCalendar(birth, date, years);
  return off ? { field: 'date', message: off } : null;
}

/**
 * Why a new chapter can't be added, or null if it can. `end` is '' for a
 * chapter that is still going. Returns `{ field, message }`; `field` names
 * the input to fix: 'birthday', 'start', 'end' or 'label'.
 */
export function chapterError(birthday, start, end, label, today, years = YEARS) {
  const birth = parseISODate(birthday);
  if (!birth) return { field: 'birthday', message: 'Add your birthday first.' };
  const from = parseISODate(start);
  if (!from) return { field: 'start', message: 'Pick when it began.' };
  const to = end ? parseISODate(end) : null;
  if (end && !to) return { field: 'end', message: 'Pick when it ended, or leave To empty if it’s still going.' };
  if (!String(label ?? '').trim()) return { field: 'label', message: 'Give it a name.' };
  const startOff = offCalendar(birth, from, years);
  if (startOff) return { field: 'start', message: startOff };
  if (to) {
    const endOff = offCalendar(birth, to, years);
    if (endOff) return { field: 'end', message: endOff };
    if (to < from) return { field: 'end', message: 'That’s before it began.' };
  } else if (from > today) {
    return { field: 'end', message: 'It hasn’t begun yet, so add when it ends.' };
  }
  return null;
}

/** The id after the largest one in `list`. */
function nextId(list) {
  return list.reduce((max, item) => (Number.isSafeInteger(item.id) ? Math.max(max, item.id) : max), 0) + 1;
}

/**
 * A copy of `events` with one more added under the next free id.
 * A missing or unknown `color` falls back to the default.
 */
export function addEvent(events, date, label, color) {
  return [...events, { id: nextId(events), date, label: String(label).trim(), color: colorOrDefault(color) }];
}

/** A copy of `events` without the one with this id. */
export function removeEvent(events, id) {
  return events.filter((e) => e.id !== id);
}

/**
 * A copy of `chapters` with one more added under the next free id. `end` is
 * '' (or left out) for one that is still going. A missing or unknown
 * `color` falls back to the default.
 */
export function addChapter(chapters, start, end, label, color) {
  return [
    ...chapters,
    { id: nextId(chapters), start, end: end || '', label: String(label).trim(), color: colorOrDefault(color) },
  ];
}

/** A copy of `chapters` without the one with this id. */
export function removeChapter(chapters, id) {
  return chapters.filter((c) => c.id !== id);
}

/**
 * The color to offer for the next chapter: the one the fewest chapters
 * have, first in the palette if several tie. So chapters added one after
 * another come out in different colors unless one is picked.
 */
export function nextChapterColor(chapters) {
  const uses = new Map(COLORS.map((c) => [c.id, 0]));
  for (const c of chapters) if (uses.has(c.color)) uses.set(c.color, uses.get(c.color) + 1);
  let best = COLORS[0].id;
  for (const [id, n] of uses) if (n < uses.get(best)) best = id;
  return best;
}
