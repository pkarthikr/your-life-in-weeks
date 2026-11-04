// Life in Weeks — the Weeks and Settings screens.
//
// Runs entirely in the browser. The birthday, important weeks and theme are
// read from (and written to) localStorage only; see storage.js. Nothing is
// sent anywhere.
//
// Both screens live on this one page. The address picks which one shows:
// `#settings` for Settings, anything else for the weeks.

import {
  YEARS,
  WEEKS_PER_YEAR,
  parseISODate,
  toISODate,
  formatDate,
  startOfToday,
  weekPosition,
  weekStart,
  lifeStats,
  eventsByWeek,
  sortEvents,
  cellState,
} from './weeks.js';
import { STORAGE_KEY, load, save } from './storage.js';
import { birthdayError, eventError, lastCalendarDay, addEvent, removeEvent } from './settings.js';

const $ = (id) => document.getElementById(id);
const fmtInt = (n) => n.toLocaleString('en-US');

const POP_HALF = 120; // half the popover's width, keeps it inside the grid

const CELL_CLASS = { lived: 'w', ahead: 'w f', now: 'w n', event: 'w s' };

const TITLES = { weeks: 'Life in Weeks', settings: 'Settings · Life in Weeks' };

// The input to move to when an important week can't be added.
const EVENT_FIELDS = { birthday: 'set-birthday', date: 'event-date', label: 'event-label' };

let data = load();
let gridKey = '';
let events = new Map();
let currentBirth = null;
let hoverIndex = null;
let shownBirthday = null; // the saved birthday last copied into the Settings field

/**
 * Save a change and redraw. The patch is merged into what this page already
 * holds, so the visit keeps working even if the browser refuses to store it.
 */
function update(patch) {
  data = save({ ...data, ...patch });
  render();
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
  currentBirth = birth;
  $('legend-events').hidden = events.size === 0;

  // Rebuilding 5,200 cells is cheap but not free; only do it when the
  // inputs that shape the grid change.
  const key = [toISODate(birth), stats.nowIndex, JSON.stringify(data.events)].join('|');
  if (key !== gridKey) {
    gridKey = key;
    hidePopover();
    buildGrid(birth, stats.nowIndex);
  }
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
      const cell = document.createElement('span');
      cell.className = CELL_CLASS[state];
      if (state === 'event') {
        cell.dataset.ev = String(i);
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

  const date = $('event-date');
  if (birth) {
    date.min = toISODate(birth);
    date.max = toISODate(lastCalendarDay(birth, YEARS));
  } else {
    date.removeAttribute('min');
    date.removeAttribute('max');
  }

  const sorted = sortEvents(data.events);
  $('event-list').replaceChildren(...sorted.map((event) => eventItem(event, birth)));
  $('event-list').hidden = sorted.length === 0;
  $('no-events').hidden = sorted.length > 0;
}

function eventItem(event, birth) {
  const item = $('event-item').content.firstElementChild.cloneNode(true);
  const date = parseISODate(event.date);
  const pos = weekPosition(birth, date);
  item.querySelector('.li-label').textContent = event.label;
  item.querySelector('.li-meta').textContent =
    (date ? formatDate(date) : event.date) + (pos ? ` · age ${pos.row}, week ${pos.col + 1}` : '');
  const remove = item.querySelector('.x');
  remove.dataset.remove = String(event.id);
  remove.setAttribute('aria-label', `Remove ${event.label}`);
  return item;
}

// ---- Important-week popover ----------------------------------------------

function showPopover(cell) {
  const index = Number(cell.dataset.ev);
  const list = events.get(index);
  if (!list || hoverIndex === index) return;
  hoverIndex = index;

  const first = parseISODate(list[0].date);
  const pos = weekPosition(currentBirth, first);
  $('pop-when').textContent = formatDate(first) + (pos ? ` · age ${pos.row}` : '');
  $('pop-title').textContent = list.map((e) => e.label).join('\n');

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
  const cell = e.target.closest?.('[data-ev]');
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
  update({ events: addEvent(data.events, date.value, label.value) });
  date.value = '';
  label.value = '';
  date.focus();
});

$('event-date').addEventListener('input', () => showEventError(null));
$('event-label').addEventListener('input', () => showEventError(null));

$('event-list').addEventListener('click', (e) => {
  const button = e.target.closest('[data-remove]');
  if (!button) return;
  const at = [...$('event-list').querySelectorAll('[data-remove]')].indexOf(button);
  update({ events: removeEvent(data.events, Number(button.dataset.remove)) });
  // Keep focus in the list: on the item that took this one's place, else the
  // one before it, else back on the form.
  const left = $('event-list').querySelectorAll('[data-remove]');
  (left[Math.min(at, left.length - 1)] ?? $('event-date')).focus();
});

// ---- Switching screens -----------------------------------------------------

window.addEventListener('hashchange', () => {
  hidePopover();
  showBirthdayError('');
  showEventError(null);
  shownBirthday = null; // show what is saved, not a half-typed date
  render();
  window.scrollTo(0, 0);

  const screen = currentScreen();
  const heading =
    screen === 'settings' ? 'settings-title' : $('weeks-view').hidden ? 'setup-title' : 'weeks-title';
  $(heading).focus({ preventScroll: true });
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

render();
