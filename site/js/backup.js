// Backup files: everything the app saves, as a JSON file the person keeps.
//
// The only other copy of their data is in this browser, which may clear it
// (Safari does after seven days of use without a visit), and which another
// device can't see. A backup outlives both, and there is still no server: the
// file goes from the browser to the person and back.
//
// Pure functions — no DOM, no storage — so they are safe to unit test.

import { clean } from './storage.js';
import { parseISODate, toISODate, formatDate } from './weeks.js';

/** Marks a file as one of ours, so a stray JSON file can't be restored by mistake. */
export const BACKUP_APP = 'life-in-weeks';

/**
 * Bump when the file's shape changes; older versions must still restore.
 * 1: birthday, theme and important weeks. 2: adds chapters. 3: adds the life span.
 */
export const BACKUP_VERSION = 3;

/** Far bigger than any real backup (a week for every square, with long labels, is under 1 MB). */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const NOT_A_BACKUP = 'That file isn’t a Life in Weeks backup.';

/** Whether `data` holds anything worth keeping: a birthday, a chapter or an important week. */
export function hasData(data) {
  return Boolean(data.birthday) || data.events.length > 0 || data.chapters?.length > 0;
}

/**
 * The backup of `data`, made on `today`: a file name and its text. The JSON
 * is indented so the file is readable; it is the person's data, after all.
 */
export function backupFile(data, today) {
  const exported = toISODate(today);
  const { birthday, theme, lifespan, chapters, events } = clean(data);
  const body = { app: BACKUP_APP, version: BACKUP_VERSION, exported, birthday, theme, lifespan, chapters, events };
  return {
    name: `life-in-weeks-backup-${exported}.json`,
    text: `${JSON.stringify(body, null, 2)}\n`,
  };
}

/** Why a file of this many bytes can't be a backup, or '' if it could be. Check before reading it. */
export function sizeError(bytes) {
  return bytes > MAX_BACKUP_BYTES ? 'That file is too big to be a Life in Weeks backup.' : '';
}

/**
 * Read a backup file's text.
 *
 * Returns `{ data, exported }`: `data` in the shape storage.load() returns,
 * ready to save in place of what is there, and `exported` the day the backup
 * was made ('YYYY-MM-DD', or '' if the file doesn't say). Or returns
 * `{ error }`, a sentence saying why it can't be restored.
 *
 * Chapters and important weeks go through the same cleaning as a normal
 * load, so one malformed entry is dropped rather than spoiling the rest. A
 * version 1 backup, from before chapters, restores with none; one from before
 * the life span restores with the default 90 years.
 */
export function readBackup(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: NOT_A_BACKUP };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.app !== BACKUP_APP) {
    return { error: NOT_A_BACKUP };
  }
  if (!Number.isSafeInteger(body.version) || body.version < 1) return { error: NOT_A_BACKUP };
  if (body.version > BACKUP_VERSION) {
    return { error: 'This backup is from a newer version of Life in Weeks. Reload the page, then try again.' };
  }
  for (const list of [body.events, body.chapters]) {
    if (list !== undefined && !Array.isArray(list)) return { error: NOT_A_BACKUP };
  }

  const birth = body.birthday === undefined || body.birthday === '' ? null : parseISODate(body.birthday);
  if (body.birthday !== undefined && body.birthday !== '' && !birth) {
    return { error: 'The birthday in this backup isn’t a valid date.' };
  }

  // Fit to screen is about a screen, not a person, so it never comes from a backup.
  const data = clean({ ...body, birthday: birth ? toISODate(birth) : '', fit: false });
  if (!hasData(data)) return { error: 'This backup is empty: it has no birthday, chapters or important weeks.' };
  return { data, exported: parseISODate(body.exported) ? body.exported : '' };
}

/**
 * What `data` holds, in a line: `Born Jun 15, 1990 · 3 chapters · 20 important weeks`.
 * Chapters are only mentioned if there are some.
 */
export function summary(data) {
  const birth = parseISODate(data.birthday);
  const count = (n, what) => `${n.toLocaleString('en-US')} ${what}${n === 1 ? '' : 's'}`;
  const chapters = data.chapters?.length ?? 0;
  const n = data.events.length;
  return [
    birth ? `Born ${formatDate(birth)}` : 'No birthday',
    ...(chapters ? [count(chapters, 'chapter')] : []),
    n === 0 ? 'no important weeks' : count(n, 'important week'),
  ].join(' · ');
}

/** The day a backup was made, like `Nov 5, 2026`, or '' if unknown. */
export function exportedOn(exported) {
  const date = parseISODate(exported);
  return date ? formatDate(date) : '';
}
