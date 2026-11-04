// Life in Weeks — home page.
//
// Runs entirely in the browser. The birthday, important weeks and theme are
// read from (and written to) localStorage only; see storage.js.

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
  cellState,
} from './weeks.js';
import { STORAGE_KEY, load, save } from './storage.js';

const $ = (id) => document.getElementById(id);
const fmtInt = (n) => n.toLocaleString('en-US');

const POP_HALF = 120; // half the popover's width, keeps it inside the grid

const CELL_CLASS = { lived: 'w', ahead: 'w f', now: 'w n', event: 'w s' };

let data = load();
let editing = false;
let gridKey = '';
let events = new Map();
let currentBirth = null;
let hoverIndex = null;

// ---- Rendering ------------------------------------------------------------

function render() {
  document.documentElement.className = `t-${data.theme}`;

  const today = startOfToday();
  const birth = parseISODate(data.birthday);
  const hasBirthday = !!birth && birth <= today;
  const showWeeks = hasBirthday && !editing;

  $('weeks').hidden = !showWeeks;
  $('setup').hidden = showWeeks;

  if (showWeeks) renderWeeks(birth, today);
  else renderSetup(today, hasBirthday);
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

function renderSetup(today, hasBirthday) {
  const input = $('birthday');
  input.max = toISODate(today);
  if (!input.value && parseISODate(data.birthday)) input.value = data.birthday;
  $('setup-sub').textContent = editing ? 'Pick a new date of birth.' : 'Add your birthday to see yours.';
  $('cancel-change').hidden = !(editing && hasBirthday);
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

// ---- Birthday form ---------------------------------------------------------

function showError(message) {
  const err = $('birthday-error');
  err.textContent = message;
  err.hidden = !message;
  $('birthday').setAttribute('aria-invalid', message ? 'true' : 'false');
}

$('birthday-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const value = $('birthday').value;
  const date = parseISODate(value);
  if (!date) return showError('Pick your date of birth.');
  if (date.getFullYear() < 1900) return showError('Pick a date after 1900.');
  if (date > startOfToday()) return showError('That date is in the future.');

  showError('');
  data = save({ birthday: toISODate(date) });
  editing = false;
  render();
  $('change-birthday').focus({ preventScroll: true });
});

$('birthday').addEventListener('input', () => showError(''));

$('change-birthday').addEventListener('click', () => {
  editing = true;
  $('birthday').value = data.birthday;
  showError('');
  render();
  $('birthday').focus();
});

$('cancel-change').addEventListener('click', () => {
  editing = false;
  showError('');
  render();
  $('change-birthday').focus({ preventScroll: true });
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
