// Pure date math for the week grid. No DOM, no storage — safe to unit test.
//
// Each row of the grid is one year of life, starting on the birthday.
// Each row has 52 weeks; the last week of a row absorbs the 1–2 leftover
// days so every row lines up with the next birthday.

export const YEARS = 100;
export const WEEKS_PER_YEAR = 52;

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

/** First day of the week at `row`/`col` for someone born on `birth`. */
export function weekStart(birth, row, col) {
  return addDays(addYears(birth, row), col * 7);
}

/** Headline numbers for the page header. */
export function lifeStats(birth, today, years = YEARS) {
  const total = years * WEEKS_PER_YEAR;
  const now = weekPosition(birth, today) ?? { row: 0, col: 0 };
  const nowIndex = now.row * WEEKS_PER_YEAR + now.col;
  const lived = Math.min(total, nowIndex);
  return {
    years,
    total,
    age: now.row,
    week: now.col + 1,
    nowIndex,
    lived,
    ahead: Math.max(0, total - lived - 1),
    percent: (lived / total) * 100,
  };
}

/** Important weeks in date order. Events on the same date keep their order. */
export function sortEvents(events) {
  return [...events].sort((a, z) => (a.date < z.date ? -1 : a.date > z.date ? 1 : 0));
}

/**
 * Group important weeks by grid index. Events before the birthday or past
 * the end of the grid are dropped. Within a week, events are date-ordered.
 */
export function eventsByWeek(birth, events, years = YEARS) {
  const map = new Map();
  for (const event of sortEvents(events)) {
    const pos = weekPosition(birth, parseISODate(event.date));
    if (!pos || pos.row >= years) continue;
    const index = pos.row * WEEKS_PER_YEAR + pos.col;
    if (!map.has(index)) map.set(index, []);
    map.get(index).push(event);
  }
  return map;
}

/**
 * Classify one cell: 'event', 'now', 'lived' or 'ahead'.
 * An important week wins over every other state.
 */
export function cellState(index, nowIndex, events) {
  if (events.has(index)) return 'event';
  if (index < nowIndex) return 'lived';
  if (index === nowIndex) return 'now';
  return 'ahead';
}
