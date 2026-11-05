// Life in Weeks — the Weeks and Settings screens.
//
// Runs entirely in the browser. The birthday, chapters, important weeks and
// theme are read from (and written to) localStorage only; see storage.js.
// Nothing is sent anywhere. A backup file (backup.js) is the only way they
// leave the browser, and only when the person downloads one.
//
// Both screens live on this one page. The address picks which one shows:
// `#settings` for Settings, anything else for the weeks.

import {
  YEARS,
  WEEKS_PER_YEAR,
  BIRTH_WEEK,
  parseISODate,
  toISODate,
  formatDate,
  formatWhen,
  startOfToday,
  weekStart,
  lifeStats,
  eventsByWeek,
  sortEvents,
  cellState,
  CHAPTERS_PER_WEEK,
  chaptersByWeek,
  chapterSpan,
  sortChapters,
  describeChapter,
} from './weeks.js';
import { STORAGE_KEY, load, save, askToKeep } from './storage.js';
import {
  birthdayError,
  eventError,
  chapterError,
  lastCalendarDay,
  addEvent,
  removeEvent,
  addChapter,
  removeChapter,
  nextChapterColor,
} from './settings.js';
import { COLORS, DEFAULT_COLOR, weekColor } from './colors.js';
import { FORMATS, PICTURE_FONTS, drawPicture, pictureColors, pictureText, siteAddress } from './picture.js';
import { hasData, backupFile, sizeError, readBackup, summary, exportedOn } from './backup.js';

const $ = (id) => document.getElementById(id);
const fmtInt = (n) => n.toLocaleString('en-US');

const POP_HALF = 120; // half the popover's width, keeps it inside the grid

const CELL_CLASS = { lived: 'w', ahead: 'w f', now: 'w n', event: 'w s' };

const TITLES = { weeks: 'Life in Weeks', settings: 'Settings · Life in Weeks' };

// The input to move to when an important week or a chapter can't be added.
const EVENT_FIELDS = { birthday: 'set-birthday', date: 'event-date', label: 'event-label' };
const CHAPTER_FIELDS = { birthday: 'set-birthday', start: 'chapter-start', end: 'chapter-end', label: 'chapter-label' };

let data = load();
let gridKey = '';
let events = new Map();
let chapters = new Map(); // grid index → the chapters that week is in, in lane order
let currentBirth = null;
let currentToday = null;
let currentNowIndex = -1;
let hoverIndex = null;
let shownBirthday = null; // the saved birthday last copied into the Settings field
let askedToKeep = false; // asked the browser to keep the data, this visit

/**
 * Save a change and redraw. The patch is merged into what this page already
 * holds, so the visit keeps working even if the browser refuses to store it.
 */
function update(patch) {
  data = save({ ...data, ...patch });
  render();
  keepData();
}

/**
 * Once there is something to lose, ask the browser not to clear it (see
 * askToKeep). Once a visit is enough, and it follows a save, so Firefox's
 * question comes right after the person did something.
 */
function keepData() {
  if (askedToKeep || !hasData(data)) return;
  askedToKeep = true;
  askToKeep();
}

function currentScreen() {
  return location.hash === '#settings' ? 'settings' : 'weeks';
}

// ---- Rendering ------------------------------------------------------------

function render() {
  document.documentElement.className = `t-${data.theme}`;

  const screen = currentScreen();
  const today = startOfToday();
  const birth = parseISODate(data.birthday);
  const hasBirthday = !!birth && birth <= today;

  document.title = TITLES[screen];
  for (const tab of document.querySelectorAll('[data-tab]')) {
    if (tab.dataset.tab === screen) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  $('weeks-view').hidden = !(screen === 'weeks' && hasBirthday);
  $('setup-view').hidden = !(screen === 'weeks' && !hasBirthday);
  $('settings-view').hidden = screen !== 'settings';

  if (screen === 'settings') renderSettings(hasBirthday ? birth : null, today);
  else if (hasBirthday) renderWeeks(birth, today);
}

function renderWeeks(birth, today) {
  const stats = lifeStats(birth, today, YEARS);

  $('years').textContent = stats.years;
  $('years-2').textContent = stats.years;
  $('total').textContent = fmtInt(stats.total);
  $('born').textContent = formatDate(birth);
  $('week').textContent = stats.week;
  $('age').textContent = stats.age;
  $('lived').textContent = fmtInt(stats.lived);
  $('ahead').textContent = fmtInt(stats.ahead);
  $('pct').textContent = stats.percent.toFixed(1);

  const rows = $('rows');
  rows.setAttribute(
    'aria-label',
    `${fmtInt(stats.lived)} of ${fmtInt(stats.total)} weeks lived, ${fmtInt(stats.ahead)} ahead.`,
  );

  events = eventsByWeek(birth, data.events, YEARS);
  chapters = chaptersByWeek(birth, data.chapters, today, YEARS);
  currentBirth = birth;
  currentToday = today;
  currentNowIndex = stats.nowIndex;
  $('legend-events').hidden = events.size === 0;
  renderLegendColors();
  renderLegendChapters(birth, today);

  // Rebuilding 5,200 cells is cheap but not free; only do it when the
  // inputs that shape the grid change. A chapter that is still going grows
  // with this week, which is in the key.
  const key = [toISODate(birth), stats.nowIndex, JSON.stringify(data.events), JSON.stringify(data.chapters)].join('|');
  if (key !== gridKey) {
    gridKey = key;
    hidePopover();
    buildGrid(birth, stats.nowIndex);
  }
}

/** One legend entry per chapter on the grid, in date order: its color and name. */
function renderLegendChapters(birth, today) {
  const shown = sortChapters(data.chapters).filter((c) => chapterSpan(birth, c, today, YEARS));
  $('legend-chapters').replaceChildren(
    ...shown.map((chapter) => {
      const item = document.createElement('li');
      item.className = 'leg';
      const swatch = document.createElement('span');
      swatch.className = `lg lg-mark c-${chapter.color}`;
      item.append(swatch, chapter.label);
      return item;
    }),
  );
  $('legend-chapters').hidden = shown.length === 0;
}

/** One legend swatch per color on the grid, in palette order. */
function renderLegendColors() {
  const used = new Set([...events.values()].map(weekColor));
  $('legend-colors').replaceChildren(
    ...COLORS.filter((c) => used.has(c.id)).map((c) => {
      const swatch = document.createElement('span');
      swatch.className = `lg lg-mark c-${c.id}`;
      return swatch;
    }),
  );
}

function buildAxis() {
  const axis = $('axis');
  if (axis.childElementCount) return;
  const frag = document.createDocumentFragment();
  for (let c = 0; c < WEEKS_PER_YEAR; c++) {
    const span = document.createElement('span');
    span.className = 'ax';
    span.textContent = (c + 1) % 4 === 0 ? String(c + 1) : '';
    frag.append(span);
  }
  axis.append(frag);
}

function buildGrid(birth, nowIndex) {
  buildAxis();
  const rows = $('rows');
  rows.querySelectorAll('.row').forEach((row) => row.remove());

  const frag = document.createDocumentFragment();
  for (let r = 0; r < YEARS; r++) {
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('span');
    label.className = 'yl';
    label.textContent = r % 5 === 0 ? String(r) : '';

    const cells = document.createElement('div');
    cells.className = 'cells';

    for (let c = 0; c < WEEKS_PER_YEAR; c++) {
      const i = r * WEEKS_PER_YEAR + c;
      const state = cellState(i, nowIndex, events);
      const inChapters = chapters.get(i);
      const cell = document.createElement('span');
      cell.className = CELL_CLASS[state];
      if (state === 'event') {
        // An important week keeps its own color, set apart from its chapters'.
        cell.classList.add(`c-${weekColor(events.get(i))}`);
        if (inChapters) cell.classList.add('within');
      } else if (inChapters && state !== 'now') {
        // In chapters: a stripe of each one's color, in lane order, faded
        // for weeks ahead. This week stays as it is.
        cell.classList.add('ch');
        for (const chapter of inChapters.slice(0, CHAPTERS_PER_WEEK)) {
          const stripe = document.createElement('i');
          stripe.className = `c-${chapter.color}`;
          cell.append(stripe);
        }
      }
      // The week you were born is ringed, whatever else it is.
      if (i === BIRTH_WEEK) cell.classList.add('b');
      if (state === 'event' || i === BIRTH_WEEK || inChapters) {
        cell.dataset.week = String(i);
      } else {
        cell.title =
          `Age ${r} · week ${c + 1} · ${formatDate(weekStart(birth, r, c))}` +
          (state === 'now' ? ' · this week' : '');
      }
      cells.append(cell);
    }

    row.append(label, cells);
    frag.append(row);
  }
  rows.insertBefore(frag, $('pop'));
}

/** `birth` is the saved birthday as a Date, or null if there isn't one yet. */
function renderSettings(birth, today) {
  // Leave the field alone while someone is typing in it.
  const input = $('set-birthday');
  input.max = toISODate(today);
  if (data.birthday !== shownBirthday && document.activeElement !== input) {
    input.value = data.birthday;
    shownBirthday = data.birthday;
    showBirthdayError('');
  }

  for (const button of document.querySelectorAll('[data-set-theme]')) {
    button.setAttribute('aria-pressed', String(button.dataset.setTheme === data.theme));
  }

  // Every date field offers only the days on the calendar.
  for (const date of [$('event-date'), $('chapter-start'), $('chapter-end')]) {
    if (birth) {
      date.min = toISODate(birth);
      date.max = toISODate(lastCalendarDay(birth, YEARS));
    } else {
      date.removeAttribute('min');
      date.removeAttribute('max');
    }
  }
  limitChapterEnd();

  const sortedChapters = sortChapters(data.chapters);
  $('chapter-list').replaceChildren(...sortedChapters.map((chapter) => chapterItem(chapter, birth, today)));
  $('chapter-list').hidden = sortedChapters.length === 0;
  $('no-chapters').hidden = sortedChapters.length > 0;

  const sorted = sortEvents(data.events);
  $('event-list').replaceChildren(...sorted.map((event) => eventItem(event, birth)));
  $('event-list').hidden = sorted.length === 0;
  $('no-events').hidden = sorted.length > 0;

  // A picture needs a birthday to draw from.
  for (const button of $('share-formats').querySelectorAll('[data-format]')) button.disabled = !birth;
  $('share-needs-birthday').hidden = Boolean(birth);

  // A backup needs something in it. Restoring works any time.
  $('backup-save').disabled = !hasData(data);
  $('backup-empty').hidden = hasData(data);
}

/** One row of a list in Settings: a swatch, a label, a line under it and a remove button. */
function listItem({ id, color, label, meta }) {
  const item = $('list-item').content.firstElementChild.cloneNode(true);
  item.querySelector('.lg').classList.add(`c-${color}`);
  item.querySelector('.li-label').textContent = label;
  item.querySelector('.li-meta').textContent = meta;
  const remove = item.querySelector('.x');
  remove.dataset.remove = String(id);
  remove.setAttribute('aria-label', `Remove ${label}`);
  return item;
}

function eventItem(event, birth) {
  const date = parseISODate(event.date);
  return listItem({ ...event, meta: date ? formatWhen(birth, date) : event.date });
}

function chapterItem(chapter, birth, today) {
  return listItem({ ...chapter, meta: describeChapter(birth, chapter, today, YEARS) });
}

// ---- Week popover ------------------------------------------------------------
//
// Hovering the week you were born, an important week or a week in a chapter
// shows what it holds: the date, what happened that week, and the chapters
// it is in with their dates.

function popChapter(chapter) {
  const line = $('pop-chapter').content.firstElementChild.cloneNode(true);
  line.classList.add(`c-${chapter.color}`);
  line.querySelector('.pop-ch-name').textContent = chapter.label;
  line.querySelector('.pop-ch-when').textContent = describeChapter(currentBirth, chapter, currentToday, YEARS);
  return line;
}

function showPopover(cell) {
  const index = Number(cell.dataset.week);
  const list = events.get(index) ?? [];
  const inChapters = chapters.get(index) ?? [];
  const born = index === BIRTH_WEEK;
  if ((!list.length && !born && !inChapters.length) || hoverIndex === index) return;
  hoverIndex = index;

  // The date you were born, else the first important date that week, else
  // the day the week starts.
  const row = Math.floor(index / WEEKS_PER_YEAR);
  const when = born ? currentBirth : list.length ? parseISODate(list[0].date) : weekStart(currentBirth, row, index % WEEKS_PER_YEAR);
  $('pop-when').textContent = formatWhen(currentBirth, when) + (index === currentNowIndex ? ' · this week' : '');
  // The week you were born comes first, then its important dates, if any,
  // then the chapters it is in, top to bottom as on the grid.
  const titles = [...(born ? ['You were born'] : []), ...list.map((e) => e.label)];
  $('pop-title').textContent = titles.join('\n');
  $('pop-title').hidden = titles.length === 0;
  $('pop-chapters').replaceChildren(...inChapters.map(popChapter));
  $('pop-chapters').hidden = inChapters.length === 0;

  const rows = $('rows');
  const wrap = rows.getBoundingClientRect();
  const rc = cell.getBoundingClientRect();
  const dotX = rc.left - wrap.left + rc.width / 2;
  const x = Math.max(POP_HALF, Math.min(wrap.width - POP_HALF, dotX));

  const pop = $('pop');
  pop.style.left = `${x}px`;
  pop.style.top = `${rc.top - wrap.top}px`;
  $('pop-a').style.left = `${dotX - x + POP_HALF}px`;
  pop.hidden = false;
}

function hidePopover() {
  hoverIndex = null;
  $('pop').hidden = true;
}

$('rows').addEventListener('mouseover', (e) => {
  const cell = e.target.closest?.('[data-week]');
  if (cell) showPopover(cell);
  else if (hoverIndex !== null) hidePopover();
});
$('rows').addEventListener('mouseleave', hidePopover);

// ---- Settings: birthday ----------------------------------------------------

function showBirthdayError(message) {
  const err = $('birthday-error');
  err.textContent = message;
  err.hidden = !message;
  $('set-birthday').setAttribute('aria-invalid', message ? 'true' : 'false');
}

// Saved as soon as the field holds a usable date. While a date is being typed
// it passes through unusable values (year 0001, 0019, 0199…); those are only
// pointed out once the field loses focus.
$('set-birthday').addEventListener('change', (e) => {
  const value = e.target.value;
  if (birthdayError(value, startOfToday())) return;
  showBirthdayError('');
  shownBirthday = value;
  update({ birthday: value });
});

$('set-birthday').addEventListener('blur', (e) => {
  const input = e.target;
  if (input.value === data.birthday && !input.validity.badInput) return;
  showBirthdayError(birthdayError(input.value, startOfToday()));
});

$('set-birthday').addEventListener('input', () => showBirthdayError(''));

// ---- Settings: theme -------------------------------------------------------

for (const button of document.querySelectorAll('[data-set-theme]')) {
  button.addEventListener('click', () => update({ theme: button.dataset.setTheme }));
}

// ---- Settings: color pickers ------------------------------------------------
//
// Chapters and important weeks each have a picker with the same colors.

/** A color picker in `container`: one radio per color, in the group `name`, with `checked` checked. */
function buildColorPicker(container, name, checked) {
  const template = $('color-option').content.firstElementChild;
  $(container).replaceChildren(
    ...COLORS.map((color) => {
      const option = template.cloneNode(true);
      option.classList.add(`c-${color.id}`);
      option.title = color.name;
      const input = option.querySelector('input');
      input.name = name;
      input.value = color.id;
      input.checked = color.id === checked;
      option.querySelector('.vh').textContent = color.name;
      return option;
    }),
  );
}

function chosenColor(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? DEFAULT_COLOR;
}

function pickColor(name, id) {
  const input = document.querySelector(`input[name="${name}"][value="${id}"]`);
  if (input) input.checked = true;
}

/**
 * The remove buttons in the list `list`: each takes its item out of
 * `data[key]` with `remove`. Focus stays in the list: on the item that took
 * this one's place, else the one before it, else on `fallback`.
 */
function handleRemove(list, key, remove, fallback) {
  $(list).addEventListener('click', (e) => {
    const button = e.target.closest('[data-remove]');
    if (!button) return;
    const at = [...$(list).querySelectorAll('[data-remove]')].indexOf(button);
    update({ [key]: remove(data[key], Number(button.dataset.remove)) });
    const left = $(list).querySelectorAll('[data-remove]');
    (left[Math.min(at, left.length - 1)] ?? $(fallback)).focus();
  });
}

// ---- Settings: chapters -----------------------------------------------------

/** A chapter can't end before it began: the To picker starts from From, if it's set. */
function limitChapterEnd() {
  const start = $('chapter-start');
  const from = start.value > start.min ? start.value : start.min; // dates as YYYY-MM-DD compare as text
  if (from) $('chapter-end').min = from;
  else $('chapter-end').removeAttribute('min');
}

function showChapterError(problem) {
  const err = $('chapter-error');
  err.textContent = problem?.message ?? '';
  err.hidden = !problem;
  for (const field of ['start', 'end', 'label']) {
    $(CHAPTER_FIELDS[field]).setAttribute('aria-invalid', problem?.field === field ? 'true' : 'false');
  }
}

$('chapter-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const start = $('chapter-start');
  const end = $('chapter-end');
  const label = $('chapter-label');
  // A half-typed date reads as empty; don't take it to mean "still going".
  const endValue = end.validity.badInput ? '?' : end.value;
  const problem = chapterError(data.birthday, start.value, endValue, label.value, startOfToday(), YEARS);
  showChapterError(problem);
  if (problem) {
    $(CHAPTER_FIELDS[problem.field]).focus();
    return;
  }
  const next = addChapter(data.chapters, start.value, end.value, label.value, chosenColor('chapter-color'));
  update({ chapters: next });
  start.value = '';
  end.value = '';
  label.value = '';
  // Offer the color the fewest chapters have, so the next one stands apart.
  pickColor('chapter-color', nextChapterColor(next));
  limitChapterEnd();
  start.focus();
});

for (const id of ['chapter-start', 'chapter-end', 'chapter-label']) {
  $(id).addEventListener('input', () => showChapterError(null));
}
$('chapter-start').addEventListener('change', limitChapterEnd);

handleRemove('chapter-list', 'chapters', removeChapter, 'chapter-start');

// ---- Settings: important weeks --------------------------------------------

function showEventError(problem) {
  const err = $('event-error');
  err.textContent = problem?.message ?? '';
  err.hidden = !problem;
  $('event-date').setAttribute('aria-invalid', problem?.field === 'date' ? 'true' : 'false');
  $('event-label').setAttribute('aria-invalid', problem?.field === 'label' ? 'true' : 'false');
}

$('event-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = $('event-date');
  const label = $('event-label');
  const problem = eventError(data.birthday, date.value, label.value, YEARS);
  showEventError(problem);
  if (problem) {
    $(EVENT_FIELDS[problem.field]).focus();
    return;
  }
  // The color stays as picked, so several weeks of one kind are quick to add.
  update({ events: addEvent(data.events, date.value, label.value, chosenColor('event-color')) });
  date.value = '';
  label.value = '';
  date.focus();
});

$('event-date').addEventListener('input', () => showEventError(null));
$('event-label').addEventListener('input', () => showEventError(null));

handleRemove('event-list', 'events', removeEvent, 'event-date');

// ---- Share pictures ---------------------------------------------------------
//
// Settings has one button per picture format (js/picture.js). Each draws the
// grid as a picture in that format, shows it, and offers to save it (and,
// where the browser can, to share it straight to an app). All of it happens
// in the browser; nothing is uploaded.

let picture = null; // { url, file } for the picture on show
let pictureRun = 0; // bumped on every open and close, so a late picture is dropped
let pictureOpener = null; // the format button that opened the dialog

/** One button per format, each with a little outline of the picture's shape. */
function buildFormatButtons() {
  const template = $('format-option').content.firstElementChild;
  $('share-formats').replaceChildren(
    ...Object.values(FORMATS).map((format) => {
      const button = template.cloneNode(true);
      button.dataset.format = format.id;
      button.querySelector('.fmt-name').textContent = format.name;
      button.querySelector('.fmt-size').textContent = `${format.width} × ${format.height}`;
      const scale = Math.min(36 / format.width, 28 / format.height);
      const shape = button.querySelector('.fmt-shape');
      shape.style.width = `${Math.round(format.width * scale)}px`;
      shape.style.height = `${Math.round(format.height * scale)}px`;
      return button;
    }),
  );
}

/** The current theme's colours, read from the same tokens the page uses. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  return pictureColors((name) => css.getPropertyValue(`--${name}`).trim());
}

async function makePicture(format) {
  const today = startOfToday();
  const birth = parseISODate(data.birthday);
  const stats = lifeStats(birth, today, YEARS);

  // Draw with the page's fonts. If they can't load, system fonts stand in.
  await Promise.all(PICTURE_FONTS.map((font) => document.fonts?.load(font))).catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  drawPicture(canvas.getContext('2d'), {
    format,
    stats,
    events: eventsByWeek(birth, data.events, YEARS),
    chapters: chaptersByWeek(birth, data.chapters, today, YEARS),
    colors: themeColors(),
    site: siteAddress(location.href),
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The browser could not make the picture.');
  const text = pictureText(stats);
  return {
    blob,
    name: `life-in-weeks-${format.id}-${toISODate(today)}.png`,
    alt: `My life in weeks: ${text.lived} ${text.ahead}`,
  };
}

function setPictureStatus(message) {
  $('share-status').textContent = message;
  $('share-status').hidden = !message;
}

function setPictureError(message) {
  $('share-error').textContent = message;
  $('share-error').hidden = !message;
}

function clearPicture() {
  if (picture) URL.revokeObjectURL(picture.url);
  picture = null;
  setPictureError('');
  $('share-img').hidden = true;
  $('share-img').removeAttribute('src');
  $('share-save').removeAttribute('href');
  $('share-actions').hidden = true;
}

function showPicture({ blob, name, alt }) {
  const url = URL.createObjectURL(blob);
  const file = new File([blob], name, { type: blob.type });
  picture = { url, file };

  const img = $('share-img');
  img.src = url;
  img.alt = alt;
  img.hidden = false;
  setPictureStatus('');

  const save = $('share-save');
  save.href = url;
  save.download = name;

  // Phones (and some desktops) can hand the file to Instagram, LinkedIn or
  // X, or save it to Photos, through the share sheet; offer that first
  // where it works.
  let canShare = false;
  try {
    canShare = !!navigator.canShare?.({ files: [file] });
  } catch {
    canShare = false;
  }
  $('share-send').hidden = !canShare;
  save.className = canShare ? 'btn btn-2' : 'btn';
  $('share-actions').hidden = false;
}

/** Open the dialog for `format` and make its picture. */
async function openPicture(format, opener) {
  const run = ++pictureRun;
  pictureOpener = opener;
  clearPicture();

  $('share-title').textContent = format.name;
  $('share-note').textContent =
    `${format.width} × ${format.height}, sized for ${format.sizedFor}. Made on this device; nothing is uploaded.`;
  // The preview keeps the picture's shape; wide pictures get a wider dialog.
  $('share-shot').style.setProperty('--w', format.width);
  $('share-shot').style.setProperty('--h', format.height);
  $('share-dialog').dataset.shape = format.width > format.height ? 'wide' : 'tall';
  setPictureStatus('Making your picture…');
  $('share-dialog').showModal();

  try {
    const made = await makePicture(format);
    if (run === pictureRun) showPicture(made);
  } catch {
    if (run === pictureRun) setPictureStatus('Couldn’t make the picture. Close this and try again.');
  }
}

$('share-formats').addEventListener('click', (e) => {
  const button = e.target.closest('[data-format]');
  if (button && !button.disabled) openPicture(FORMATS[button.dataset.format], button);
});

$('share-close').addEventListener('click', () => $('share-dialog').close());

// A click on the dimmed backdrop lands on the dialog itself, not its content.
$('share-dialog').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

$('share-dialog').addEventListener('close', () => {
  pictureRun++;
  clearPicture();
  if (pictureOpener?.isConnected && !$('settings-view').hidden) pictureOpener.focus();
  pictureOpener = null;
});

$('share-send').addEventListener('click', async () => {
  if (!picture) return;
  setPictureError('');
  try {
    await navigator.share({ files: [picture.file] });
  } catch (err) {
    // Closing the share sheet is not an error.
    if (err?.name !== 'AbortError') setPictureError('Couldn’t open sharing here. Use Save image instead.');
  }
});

// ---- Backup and restore ----------------------------------------------------
//
// Download backup saves everything as a JSON file (js/backup.js). Restore
// reads one back, from Settings or from the first screen, where someone on a
// new device (or whose browser cleared the site) lands. The file only ever
// goes between the browser and the person; nothing is uploaded.

let restoreOpener = null; // the Restore button that was pressed
let pendingRestore = null; // the backup the dialog is asking about

function setBackupStatus(message) {
  $('backup-status').textContent = message;
  $('backup-status').hidden = !message;
}

/** On whichever screen the restore was started from. */
function showRestoreError(message) {
  for (const id of ['backup-error', 'setup-error']) {
    $(id).textContent = message;
    $(id).hidden = !message;
  }
}

$('backup-save').addEventListener('click', () => {
  showRestoreError('');
  const { name, text } = backupFile(data, startOfToday());
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the download time to start before letting go of the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  // The browser may still ask where to save it, so don't claim it is saved.
  setBackupStatus(`Downloading ${name}. Keep it somewhere outside this browser, like a cloud drive or an email to yourself.`);
  keepData();
});

for (const button of document.querySelectorAll('[data-restore]')) {
  button.addEventListener('click', () => {
    restoreOpener = button;
    setBackupStatus('');
    showRestoreError('');
    $('restore-file').value = ''; // so picking the same file again still counts
    $('restore-file').click();
  });
}

$('restore-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const tooBig = sizeError(file.size);
  if (tooBig) return showRestoreError(tooBig);

  let text;
  try {
    text = await file.text();
  } catch {
    return showRestoreError('Couldn’t read that file. Try again.');
  }
  const backup = readBackup(text);
  if (backup.error) return showRestoreError(backup.error);

  // Nothing here to lose: restore straight away. Otherwise check first.
  if (hasData(data)) askBeforeRestoring(backup);
  else restore(backup);
});

function askBeforeRestoring(backup) {
  pendingRestore = backup;
  const on = exportedOn(backup.exported);
  $('restore-from').textContent = on ? `The backup, from ${on}` : 'The backup';
  $('restore-new').textContent = summary(backup.data);
  $('restore-old').textContent = summary(data);
  $('restore-dialog').returnValue = ''; // only Replace sets it
  $('restore-dialog').showModal();
}

$('restore-dialog').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

$('restore-dialog').addEventListener('close', () => {
  const backup = pendingRestore;
  pendingRestore = null;
  if (backup && $('restore-dialog').returnValue === 'replace') restore(backup);
  else focusAfterRestore();
});

function restore({ data: restored, exported }) {
  update(restored);
  // A different set of chapters: offer the color they use least.
  pickColor('chapter-color', nextChapterColor(data.chapters));
  const on = exportedOn(exported);
  setBackupStatus(`Restored your backup${on ? ` from ${on}` : ''}: ${summary(data)}.`);
  focusAfterRestore();
}

/** Back to the Restore button, or, if restoring moved on from its screen, to the new one's heading. */
function focusAfterRestore() {
  const opener = restoreOpener;
  restoreOpener = null;
  if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus();
  else focusHeading();
}

// ---- Switching screens -----------------------------------------------------

function focusHeading() {
  const screen = currentScreen();
  const heading =
    screen === 'settings' ? 'settings-title' : $('weeks-view').hidden ? 'setup-title' : 'weeks-title';
  $(heading).focus({ preventScroll: true });
}

window.addEventListener('hashchange', () => {
  if ($('share-dialog').open) $('share-dialog').close();
  if ($('restore-dialog').open) $('restore-dialog').close();
  hidePopover();
  showBirthdayError('');
  showChapterError(null);
  showEventError(null);
  setBackupStatus('');
  showRestoreError('');
  shownBirthday = null; // show what is saved, not a half-typed date
  render();
  window.scrollTo(0, 0);
  focusHeading();
});

// ---- Keep in sync ----------------------------------------------------------

// Another tab of this app changed what's saved.
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  data = load();
  render();
});

// Coming back to the tab on a new day moves "this week" forward.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// ---- About ------------------------------------------------------------------

// The author's photo is copied into the site when it is deployed. Running
// locally, or if that copy failed, hide the broken image so the initials
// underneath show. It may have failed before this module ran.
function hideMissingPhoto() {
  $('me-photo').hidden = true;
}
$('me-photo').addEventListener('error', hideMissingPhoto);
if ($('me-photo').complete && !$('me-photo').naturalWidth) hideMissingPhoto();

buildColorPicker('chapter-colors', 'chapter-color', nextChapterColor(data.chapters));
buildColorPicker('event-colors', 'event-color', DEFAULT_COLOR);
buildFormatButtons();
render();
