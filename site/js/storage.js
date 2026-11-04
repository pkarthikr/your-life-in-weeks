// Everything the app remembers lives in this browser's localStorage under a
// single key. There is no server and no account: clearing site data, or
// opening the app in another browser, starts fresh.

export const STORAGE_KEY = 'liw:v1';

const DEFAULTS = Object.freeze({ birthday: '', events: [], theme: 'dark' });

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
 * Keep the well-formed important weeks and make sure each has its own
 * positive integer id, so any one of them can be removed.
 */
function cleanEvents(list) {
  if (!Array.isArray(list)) return [];
  const valid = list.filter((e) => e && typeof e.date === 'string' && typeof e.label === 'string');
  let next = valid.reduce((max, e) => (isId(e.id) ? Math.max(max, e.id) : max), 0) + 1;
  const seen = new Set();
  return valid.map((e) => {
    const id = isId(e.id) && !seen.has(e.id) ? e.id : next++;
    seen.add(id);
    return { id, date: e.date, label: e.label };
  });
}

/**
 * Read saved data. Always returns a complete, well-formed object, even when
 * storage is unavailable, empty or holds something unexpected.
 *
 * Shape: { birthday: 'YYYY-MM-DD' | '', events: [{ id, date, label }], theme: 'dark' | 'light' }
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
