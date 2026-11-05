// Everything the app remembers lives in this browser's localStorage under a
// single key. There is no server and no account: clearing site data, or
// opening the app in another browser, starts fresh.

import { colorOrDefault } from './colors.js';

export const STORAGE_KEY = 'liw:v1';

const DEFAULTS = Object.freeze({ birthday: '', events: [], chapters: [], theme: 'dark' });

function defaultStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage throws when site data is blocked.
    return null;
  }
}

const isId = (id) => Number.isSafeInteger(id) && id > 0;

/**
 * Keep the well-formed items of a saved list, each reshaped by `shape`, and
 * make sure each has its own positive integer id, so any one of them can
 * be removed. `keep` says whether an item is well-formed.
 */
function cleanList(list, keep, shape) {
  if (!Array.isArray(list)) return [];
  const valid = list.filter((item) => item && typeof item === 'object' && keep(item));
  let next = valid.reduce((max, item) => (isId(item.id) ? Math.max(max, item.id) : max), 0) + 1;
  const seen = new Set();
  return valid.map((item) => {
    const id = isId(item.id) && !seen.has(item.id) ? item.id : next++;
    seen.add(id);
    return { id, ...shape(item) };
  });
}

/**
 * Important weeks. A missing or unknown color (weeks saved before colors
 * existed) becomes the default.
 */
const cleanEvents = (list) =>
  cleanList(
    list,
    (e) => typeof e.date === 'string' && typeof e.label === 'string',
    (e) => ({ date: e.date, label: e.label, color: colorOrDefault(e.color) }),
  );

/** Chapters. A missing end means the chapter is still going. */
const cleanChapters = (list) =>
  cleanList(
    list,
    (c) => typeof c.start === 'string' && typeof c.label === 'string',
    (c) => ({ start: c.start, end: typeof c.end === 'string' ? c.end : '', label: c.label, color: colorOrDefault(c.color) }),
  );

/**
 * Read saved data. Always returns a complete, well-formed object, even when
 * storage is unavailable, empty or holds something unexpected.
 *
 * Shape: {
 *   birthday: 'YYYY-MM-DD' | '',
 *   events: [{ id, date, label, color }],
 *   chapters: [{ id, start, end, label, color }],
 *   theme: 'dark' | 'light',
 * }
 * Dates are 'YYYY-MM-DD'. A chapter's `end` is '' while it is still going.
 * `color` is one of the ids in colors.js.
 */
export function load(store = defaultStore()) {
  let saved = {};
  try {
    saved = JSON.parse(store?.getItem(STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  return {
    birthday: typeof saved.birthday === 'string' ? saved.birthday : DEFAULTS.birthday,
    events: cleanEvents(saved.events),
    chapters: cleanChapters(saved.chapters),
    theme: saved.theme === 'light' ? 'light' : DEFAULTS.theme,
  };
}

/**
 * Merge `patch` into what is saved and write it back. Returns the merged data.
 * Returns it even if the write fails (private mode, quota), so the page keeps
 * working for this visit.
 */
export function save(patch, store = defaultStore()) {
  const next = { ...load(store), ...patch };
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not persisted; nothing else to do.
  }
  return next;
}
