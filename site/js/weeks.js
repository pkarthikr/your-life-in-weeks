// Pure date math for the week grid. No DOM, no storage — safe to unit test.
//
// Each row of the grid is one year of life, starting on the birthday.
// Each row has 52 weeks; the last week of a row absorbs the 1–2 leftover
// days so every row lines up with the next birthday.

/** The span shown until a person picks their own (see lifespan.js). */
export const YEARS = 100;
export const WEEKS_PER_YEAR = 52;

/** No span is longer than this, so nothing a person saved is ever cut off the grid. */
export const MAX_YEARS = 150;

/** The week you were born: always the first square (age 0, week 1). */
export const BIRTH_WEEK = 0;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86400000;

/** Parse a strict `YYYY-MM-DD` string into a local Date, or null. */
export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  date.setFullYear(y); // keep years < 100 from being mapped to 19xx
  // Reject roll-overs such as 2023-02-30.
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

/** Format a Date as `YYYY-MM-DD` in local time. */
export function toISODate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${String(date.getFullYear()).padStart(4, '0')}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

/** Format a Date like `Jan 1, 1990`. */
export function formatDate(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addYears(date, n) {
  return new Date(date.getFullYear() + n, date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/**
 * Where a date falls on the grid for someone born on `birth`.
 * Returns `{ row, col }` (row = full years of age, col = week of that year,
 * 0-based) or null if the date is before the birthday.
 */
export function weekPosition(birth, date) {
  if (!birth || !date || date < birth) return null;
  let row = date.getFullYear() - birth.getFullYear();
  if (addYears(birth, row) > date) row--;
  const days = Math.round((date - addYears(birth, row)) / DAY_MS);
  return { row, col: Math.min(WEEKS_PER_YEAR - 1, Math.floor(days / 7)) };
}

/** The grid index of the week `date` falls in, or null if it is before the birthday. */
export function weekIndex(birth, date) {
  const pos = weekPosition(birth, date);
  return pos ? pos.row * WEEKS_PER_YEAR + pos.col : null;
}

/**
 * A date and the week it falls in, like `Mar 2, 2015 · age 24, week 38`
 * (week counted from 1). Just the date if it is before the birthday.
 */
export function formatWhen(birth, date) {
  const pos = weekPosition(birth, date);
  return formatDate(date) + (pos ? ` · age ${pos.row}, week ${pos.col + 1}` : '');
}

/** First day of the week at `row`/`col` for someone born on `birth`. */
export function weekStart(birth, row, col) {
  return addDays(addYears(birth, row), col * 7);
}

/** The weeks in a span of `years`, which may have a fraction (72.4 years). */
export function totalWeeks(years = YEARS) {
  return Math.round(years * WEEKS_PER_YEAR);
}

/**
 * Headline numbers for the page header.
 *
 * `years` is the span the person is counted against; `reach` is the grid
 * index of the last week they have something on (an important week or a
 * chapter), or -1. The grid shows the whole span, and runs on past it only
 * as far as it must to show this week and anything they saved there:
 *
 * - `total`: weeks in the span
 * - `shown`: weeks on the grid, at least `total`
 * - `rows`: years on the grid, counting a part-year
 * - `past`: whether the grid runs on past the span
 *
 * Someone who has outlived their span has lived `nowIndex` weeks, with none
 * ahead, and is 100% of the way.
 */
export function lifeStats(birth, today, years = YEARS, reach = -1) {
  const total = totalWeeks(years);
  const now = weekPosition(birth, today) ?? { row: 0, col: 0 };
  const nowIndex = now.row * WEEKS_PER_YEAR + now.col;
  const shown = Math.max(total, nowIndex + 1, reach + 1);
  return {
    years,
    total,
    shown,
    rows: Math.ceil(shown / WEEKS_PER_YEAR),
    past: shown > total,
    age: now.row,
    week: now.col + 1,
    nowIndex,
    lived: nowIndex,
    ahead: Math.max(0, total - nowIndex - 1),
    percent: Math.min(100, (nowIndex / total) * 100),
  };
}

/**
 * How many years of calendar a new date may fall in: the span, or, for
 * someone who has outlived it, up to this week. Always a whole number.
 */
export function calendarYears(birth, today, years = YEARS) {
  const pos = weekPosition(birth, today);
  return Math.max(Math.ceil(years), pos ? pos.row + 1 : 0);
}

/** The grid index of the last week in any of these maps (grid index → things in that week), or -1 if they are all empty. */
export function reachOf(...maps) {
  let reach = -1;
  for (const map of maps) for (const i of map.keys()) if (i > reach) reach = i;
  return reach;
}

/** Important weeks in date order. Events on the same date keep their order. */
export function sortEvents(events) {
  return [...events].sort((a, z) => (a.date < z.date ? -1 : a.date > z.date ? 1 : 0));
}

/**
 * Group important weeks by grid index. Events before the birthday or past
 * the end of the grid are dropped. Within a week, events are date-ordered.
 */
export function eventsByWeek(birth, events, years = MAX_YEARS) {
  const map = new Map();
  for (const event of sortEvents(events)) {
    const pos = weekPosition(birth, parseISODate(event.date));
    if (!pos || pos.row * WEEKS_PER_YEAR + pos.col >= totalWeeks(years)) continue;
    const index = pos.row * WEEKS_PER_YEAR + pos.col;
    if (!map.has(index)) map.set(index, []);
    map.get(index).push(event);
  }
  return map;
}

// ---- Chapters --------------------------------------------------------------
//
// A chapter is a stretch of weeks: college, a job, the years in a city.
// It has a start date and an end date, or no end date while it is still
// going, in which case it runs up to this week.

const compare = (a, z) => (a < z ? -1 : a > z ? 1 : 0);

/**
 * Chapters in the order to list them: by start date, then by end date,
 * with one that is still going after one that has ended. Chapters that
 * match keep their order.
 */
export function sortChapters(chapters) {
  return [...chapters].sort((a, z) => compare(a.start, z.start) || compare(a.end || '~', z.end || '~'));
}

/**
 * The weeks a chapter covers on the grid, as `{ first, last }` grid indexes
 * (both included), or null if none of it is on the grid. One that is still
 * going runs up to the week `today` is in. A part before the birthday or
 * past the end of the grid is cut off.
 */
export function chapterSpan(birth, chapter, today, years = MAX_YEARS) {
  const start = parseISODate(chapter.start);
  const end = chapter.end ? parseISODate(chapter.end) : today;
  if (!birth || !start || !end || end < start || end < birth) return null;
  const first = start < birth ? 0 : weekIndex(birth, start);
  const last = Math.min(totalWeeks(years) - 1, weekIndex(birth, end));
  return first <= last ? { first, last } : null;
}

/**
 * A chapter's dates and how many weeks of the grid it covers, like
 * `Sep 1, 2008 – May 15, 2012 · 194 weeks`, or `Sep 1, 2019 – now · 375 weeks`
 * for one that is still going. Without a birthday, or if none of it is on
 * the grid, just the dates.
 */
export function describeChapter(birth, chapter, today, years = MAX_YEARS) {
  const show = (value) => {
    const date = parseISODate(value);
    return date ? formatDate(date) : value;
  };
  const dates = `${show(chapter.start)} – ${chapter.end ? show(chapter.end) : 'now'}`;
  const span = birth ? chapterSpan(birth, chapter, today, years) : null;
  if (!span) return dates;
  const n = span.last - span.first + 1;
  return `${dates} · ${n.toLocaleString('en-US')} ${n === 1 ? 'week' : 'weeks'}`;
}

/** At most this many chapters share a week on the grid; any more show only in its popover. */
export const CHAPTERS_PER_WEEK = 3;

/**
 * Group chapters by grid index: for each week, the chapters it is in.
 *
 * Chapters can overlap (a job, while living in a city, while in a
 * relationship), so each one gets a lane, kept for all its weeks: the
 * first lane that is free when it begins. A chapter that begins with or
 * inside another gets the lane after it. A week lists its chapters in
 * lane order, which is the order the grid stacks them in.
 */
export function chaptersByWeek(birth, chapters, today, years = MAX_YEARS) {
  const placed = chapters
    .map((chapter, order) => ({ chapter, order, span: chapterSpan(birth, chapter, today, years) }))
    .filter((c) => c.span)
    .sort((a, z) => a.span.first - z.span.first || z.span.last - a.span.last || a.order - z.order);

  const laneEnds = []; // the last week taken in each lane so far
  const map = new Map();
  for (const { chapter, span } of placed) {
    let lane = laneEnds.findIndex((end) => end < span.first);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.last;
    for (let i = span.first; i <= span.last; i++) {
      const list = map.get(i);
      if (list) list.push({ lane, chapter });
      else map.set(i, [{ lane, chapter }]);
    }
  }
  for (const [i, list] of map) map.set(i, list.sort((a, z) => a.lane - z.lane).map((c) => c.chapter));
  return map;
}

/**
 * Classify one cell: 'event', 'lived', 'now', 'past' or 'ahead'.
 * An important week wins over every other state. 'past' is a week after
 * this one that is beyond the span (`total` weeks): the grid only shows it
 * when something the person saved is out there.
 */
export function cellState(index, nowIndex, events, total = Infinity) {
  if (events.has(index)) return 'event';
  if (index < nowIndex) return 'lived';
  if (index === nowIndex) return 'now';
  return index >= total ? 'past' : 'ahead';
}
