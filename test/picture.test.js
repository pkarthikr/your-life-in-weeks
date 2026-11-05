import { test } from 'node:test';
import assert from 'node:assert/strict';

import { YEARS, WEEKS_PER_YEAR, BIRTH_WEEK, parseISODate, lifeStats, eventsByWeek, chaptersByWeek, weekIndex } from '../site/js/weeks.js';
import { FORMATS, PREVIEW, pictureLayout, cellBox, stripeBox, pictureText, pictureColors, siteAddress, drawPicture } from '../site/js/picture.js';
import { COLORS as PALETTE } from '../site/js/colors.js';

const d = (s) => parseISODate(s);
const ALL = Object.values(FORMATS);

test('the formats: Instagram story and post, LinkedIn and X', () => {
  const sizes = Object.fromEntries(ALL.map((f) => [f.id, [f.width, f.height]]));
  assert.deepEqual(sizes, {
    story: [1080, 1920], // 9:16
    post: [1080, 1350], // 4:5
    linkedin: [1200, 1200], // 1:1
    x: [1600, 900], // 16:9
  });
  for (const [key, f] of Object.entries(FORMATS)) {
    assert.equal(f.id, key);
    assert.ok(f.name && f.sizedFor, `${key} has a name and says what it is sized for`);
    assert.ok(['rows', 'columns'].includes(f.years));
  }
  // Tall pictures keep a year per row, as on the page; the others turn it.
  assert.equal(FORMATS.story.years, 'rows');
  for (const id of ['post', 'linkedin', 'x']) assert.equal(FORMATS[id].years, 'columns');
});

for (const format of [...ALL, PREVIEW]) {
  for (const footer of [true, false]) {
    test(`${format.id}: everything sits inside the margins, in order (footer: ${footer})`, () => {
      const layout = pictureLayout(format, { footer });
      const { grid, ages } = layout;
      const { margin } = format;
      const lines = [layout.eyebrow, layout.legend, ...(footer ? [layout.footer] : [])];
      const middles = [...lines.map((l) => l.y), ...layout.title.y, ...(ages.y ? [ages.y] : [])];

      assert.equal(layout.footer === null, !footer);
      for (const y of middles) {
        assert.ok(y > margin.top && y < format.height - margin.bottom, `text at ${y} is in a margin`);
      }
      assert.ok(grid.y > layout.title.y.at(-1) && grid.y + grid.height < layout.legend.y, 'grid sits between title and legend');
      assert.ok(grid.x >= margin.side && grid.x + grid.width <= format.width - margin.side);
      assert.ok(Math.abs(grid.x - (format.width - grid.x - grid.width)) <= 1, 'centred across');
      if (ages.along === 'left') assert.ok(ages.x > 0 && ages.x < grid.x, 'ages left of the grid');
      else assert.ok(ages.y > grid.y + grid.height && ages.y < layout.legend.y, 'ages between grid and legend');
      assert.equal(layout.title.y.length, format.titleLines);
      if (footer && format.footerBeside) assert.equal(layout.footer.y, layout.legend.y, 'address on the legend line');
    });
  }
}

for (const format of ALL) {
  test(`${format.id}: whole-pixel weeks that fill the width, with a gap between every pair`, () => {
    const { grid } = pictureLayout(format);
    const [cols, rows] = format.years === 'columns' ? [YEARS, WEEKS_PER_YEAR] : [WEEKS_PER_YEAR, YEARS];
    assert.deepEqual([grid.cols, grid.rows], [cols, rows]);
    for (const n of [grid.x, grid.y, grid.cellW, grid.cellH, grid.colGap, grid.rowGap]) assert.ok(Number.isInteger(n));
    assert.ok(grid.cellH >= 8, `weeks are tall enough to see (${grid.cellH}px)`);
    assert.ok(grid.cellW >= grid.cellH, `${grid.cellW} × ${grid.cellH}`);
    assert.ok(grid.colGap >= 1 && grid.colGap >= grid.cellH / 8, 'weeks stay apart');
    assert.equal(grid.width, grid.cols * grid.cellW + (grid.cols - 1) * grid.colGap);
    assert.equal(grid.height, grid.rows * grid.cellH + (grid.rows - 1) * grid.rowGap);
    // Only the rounding down of each week's width is left over.
    const room = format.width - 2 * format.margin.side;
    assert.ok(grid.width <= room && room - grid.width < grid.cols, `${grid.width} of ${room}px`);
  });
}

test('the link preview is 1200 × 630, has no Share button, and its weeks fill the width', () => {
  assert.deepEqual([PREVIEW.width, PREVIEW.height], [1200, 630]); // 1.91:1
  assert.ok(!Object.values(FORMATS).includes(PREVIEW));
  assert.equal(PREVIEW.years, 'columns');
  const { grid } = pictureLayout(PREVIEW);
  assert.deepEqual([grid.cols, grid.rows], [YEARS, WEEKS_PER_YEAR]);
  // 52 weeks in 630 pixels, under the title, leave them short; they stay
  // whole pixels, apart, and no narrower than they are tall.
  assert.deepEqual([grid.cellW, grid.cellH, grid.colGap, grid.rowGap], [9, 5, 1, 1]);
  const room = PREVIEW.width - 2 * PREVIEW.margin.side;
  assert.ok(grid.width <= room && room - grid.width < grid.cols, `${grid.width} of ${room}px`);
});

test('the story keeps the weeks it was approved with: 16 × 10 with 2px gaps', () => {
  const { grid } = pictureLayout(FORMATS.story);
  assert.deepEqual([grid.cellW, grid.cellH, grid.colGap, grid.rowGap], [16, 10, 2, 2]);
});

test('cellBox walks a grid of rows year by year, down the picture', () => {
  const { grid } = pictureLayout(FORMATS.story);
  assert.deepEqual(cellBox(grid, 0), { x: grid.x, y: grid.y, w: grid.cellW, h: grid.cellH });
  const second = cellBox(grid, 1);
  assert.equal(second.x, grid.x + grid.cellW + grid.colGap);
  assert.equal(second.y, grid.y);
  const nextYear = cellBox(grid, WEEKS_PER_YEAR);
  assert.equal(nextYear.x, grid.x);
  assert.equal(nextYear.y, grid.y + grid.cellH + grid.rowGap);
  const last = cellBox(grid, YEARS * WEEKS_PER_YEAR - 1);
  assert.equal(last.x + last.w, grid.x + grid.width);
  assert.equal(last.y + last.h, grid.y + grid.height);
});

test('cellBox walks a grid of columns year by year, across the picture', () => {
  const { grid } = pictureLayout(FORMATS.x);
  assert.deepEqual(cellBox(grid, 0), { x: grid.x, y: grid.y, w: grid.cellW, h: grid.cellH });
  const second = cellBox(grid, 1);
  assert.equal(second.x, grid.x);
  assert.equal(second.y, grid.y + grid.cellH + grid.rowGap);
  const nextYear = cellBox(grid, WEEKS_PER_YEAR);
  assert.equal(nextYear.x, grid.x + grid.cellW + grid.colGap);
  assert.equal(nextYear.y, grid.y);
  const last = cellBox(grid, YEARS * WEEKS_PER_YEAR - 1);
  assert.equal(last.x + last.w, grid.x + grid.width);
  assert.equal(last.y + last.h, grid.y + grid.height);
});

test('pictureText counts weeks lived and ahead', () => {
  const text = pictureText(lifeStats(d('1990-01-01'), d('2026-11-04')));
  assert.equal(text.eyebrow, 'My life in weeks');
  assert.equal(text.lived, '1,915 weeks lived.');
  assert.equal(text.ahead, '3,284 weeks ahead.');
});

test('pictureText says "week" for one', () => {
  const text = pictureText({ lived: 1, ahead: 1 });
  assert.equal(text.lived, '1 week lived.');
  assert.equal(text.ahead, '1 week ahead.');
  assert.equal(pictureText({ lived: 0, ahead: 5199 }).lived, '0 weeks lived.');
});

test('pictureColors reads each theme token, the color shades, the halo and the tint', () => {
  const tokens = {
    bg: '#000', text: '#fff', ink: '#eee', muted: '#999', future: '#222', now: '#fb4', nowA: 'rgba(1,2,3,.5)', halo: '25%', tint: '40%',
    ...Object.fromEntries(PALETTE.map((c) => [`c-${c.id}`, `#${c.id}`])),
  };
  const colors = pictureColors((name) => tokens[name] ?? '');
  assert.deepEqual(colors, {
    bg: '#000', text: '#fff', ink: '#eee', muted: '#999', future: '#222', now: '#fb4', nowA: 'rgba(1,2,3,.5)',
    marks: Object.fromEntries(PALETTE.map((c) => [c.id, `#${c.id}`])),
    halo: 0.25,
    tint: 0.4,
  });
  assert.equal(pictureColors(() => '').halo, 0.3, 'a missing halo falls back to 30%');
  assert.equal(pictureColors(() => '').tint, 0.35, 'a missing tint falls back to 35%');
});

test('siteAddress is the page address without the protocol, file or hash', () => {
  assert.equal(siteAddress('https://pkarthikr.github.io/your-life-in-weeks/#weeks'), 'pkarthikr.github.io/your-life-in-weeks');
  assert.equal(siteAddress('https://pkarthikr.github.io/your-life-in-weeks/index.html?x=1#settings'), 'pkarthikr.github.io/your-life-in-weeks');
  assert.equal(siteAddress('https://weeks.example.com/'), 'weeks.example.com');
  assert.equal(siteAddress('http://localhost:8000/#weeks'), 'localhost:8000');
  assert.equal(siteAddress('file:///home/me/site/index.html'), '');
  assert.equal(siteAddress('not a url'), '');
});

// ---- drawPicture against a fake canvas ---------------------------------------

/** A 2D context that records what is filled, and in which colour. */
function fakeContext() {
  const calls = [];
  let path = [];
  const ctx = {
    calls,
    fillStyle: '',
    font: '10px x',
    globalAlpha: 1,
    letterSpacing: '0px',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: (...args) => calls.push({ op: 'fillRect', color: ctx.fillStyle, args }),
    beginPath: () => { path = []; },
    roundRect: (...args) => path.push(args),
    rect: (...args) => path.push(args),
    fill: () => calls.push({ op: 'fill', color: ctx.fillStyle, alpha: ctx.globalAlpha, rects: path }),
    fillText: (text, x, y) => calls.push({ op: 'text', color: ctx.fillStyle, text, x, y, font: ctx.font }),
    measureText: (text) => ({ width: text.length * Number(/(\d+)px/.exec(ctx.font)[1]) * 0.55 }),
  };
  return ctx;
}

const COLORS = {
  bg: 'BG', text: 'TEXT', ink: 'INK', muted: 'MUTED', future: 'FUTURE', now: 'NOW', nowA: 'NOWA',
  marks: Object.fromEntries(PALETTE.map((c) => [c.id, c.id.toUpperCase()])),
  halo: 0.3,
  tint: 0.35,
};

function draw(birthday, today, events = [], site = 'example.github.io/weeks', format = FORMATS.story, chapters = []) {
  const born = d(birthday);
  const ctx = fakeContext();
  drawPicture(ctx, {
    format,
    stats: lifeStats(born, d(today)),
    events: eventsByWeek(born, events),
    chapters: chaptersByWeek(born, chapters, d(today)),
    colors: COLORS,
    site,
  });
  // Only what is filled on the grid; the legend and brand mark reuse its colours.
  const layout = pictureLayout(format, { footer: Boolean(site) });
  const { grid } = layout;
  const onGrid = ([x, y]) => x >= grid.x - 10 && x < grid.x + grid.width && y >= grid.y - 10 && y < grid.y + grid.height;
  // The week you were born, its ring and the gap inside the ring are all
  // centred on the first week; they are counted apart from the other weeks.
  const first = cellBox(grid, BIRTH_WEEK);
  const onBirth = ([x, y, w, h]) => x + w / 2 === first.x + first.w / 2 && y + h / 2 === first.y + first.h / 2;
  const filled = (color, alpha = 1) =>
    ctx.calls
      .filter((c) => c.op === 'fill' && c.color === color && c.alpha === alpha)
      .flatMap((c) => c.rects.filter((r) => onGrid(r) && !onBirth(r)));
  // What is painted on the week you were born, in order, biggest first.
  const birthFills = ctx.calls.filter((c) => c.op === 'fill').flatMap((c) => c.rects.filter((r) => onGrid(r) && onBirth(r)).map((r) => ({ color: c.color, w: r[2] })));
  const birth = birthFills.map((f) => f.color);
  // Swatches drawn on the legend's line, in order.
  const legend = ctx.calls
    .filter((c) => c.op === 'fill' && c.rects.some(([, y, , h]) => Math.abs(y + h / 2 - layout.legend.y) < 2))
    .map((c) => c.color);
  const textCalls = ctx.calls.filter((c) => c.op === 'text');
  const texts = textCalls.map((c) => c.text);
  return { ctx, layout, filled, birth, birthFills, first, texts, textCalls, legend };
}

for (const format of ALL) {
  test(`${format.id}: drawPicture paints the background and every week once`, () => {
    const { ctx, filled, birth } = draw('1990-01-01', '2026-11-04', [
      { id: 1, date: '2015-03-02', label: 'Moved', color: 'blue' },
      { id: 2, date: '2020-08-10', label: 'Married', color: 'blue' },
    ], 'example.github.io/weeks', format);
    assert.deepEqual(ctx.calls[0], { op: 'fillRect', color: 'BG', args: [0, 0, format.width, format.height] });
    const lived = filled('INK').length;
    const ahead = filled('FUTURE').length;
    const now = filled('NOW').length;
    const events = filled('BLUE').length;
    assert.equal(now, 1);
    assert.equal(events, 2);
    // Plus the week you were born, painted last with its ring.
    assert.equal(lived + ahead + now + events + 1, YEARS * WEEKS_PER_YEAR);
    assert.equal(lived, 1915 - 2 - 1);
    assert.deepEqual(birth, ['NOW', 'BG', 'INK']);
    // Rings behind this week and the important weeks.
    assert.equal(filled('NOWA').length, 1);
    assert.equal(filled('BLUE', 0.3).length, 2);
  });
}

test('drawPicture paints each important week in its own color, and the legend shows each color once', () => {
  const { filled, legend } = draw('1990-01-01', '2026-11-04', [
    { id: 1, date: '2015-03-02', label: 'Moved', color: 'green' },
    { id: 2, date: '2015-03-03', label: 'Same week, later', color: 'red' },
    { id: 3, date: '2020-08-10', label: 'Married', color: 'pink' },
    { id: 4, date: '2021-01-04', label: 'Old, no color' },
    { id: 5, date: '2022-01-04', label: 'Another pink', color: 'pink' },
  ]);
  assert.equal(filled('GREEN').length, 1, 'a shared week takes the earliest date\'s color');
  assert.equal(filled('RED').length, 0);
  assert.equal(filled('PINK').length, 2);
  assert.equal(filled('BLUE').length, 1, 'no color means the default');
  assert.equal(filled('PINK', 0.3).length, 2, 'each has a halo in its color');
  // Lived, ahead, this week, born (a ringed swatch: ring, gap, swatch), then
  // one swatch per color in palette order.
  assert.deepEqual(legend, ['INK', 'FUTURE', 'NOW', 'NOW', 'BG', 'INK', 'BLUE', 'PINK', 'GREEN']);
});

test('drawPicture writes the title, ages, legend and address, and no event labels', () => {
  const { texts } = draw('1990-01-01', '2026-11-04', [{ id: 1, date: '2015-03-02', label: 'Secret', color: 'teal' }]);
  assert.ok(texts.includes('1,915 weeks lived.'));
  assert.ok(texts.includes('3,284 weeks ahead.'));
  assert.deepEqual(texts.filter((t) => /^\d+$/.test(t)), ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90']);
  for (const label of ['Lived', 'Ahead', 'This week', 'Born', 'Important week']) assert.ok(texts.includes(label), label);
  assert.ok(texts.includes('example.github.io/weeks'));
  assert.ok(!texts.some((t) => t.includes('Secret')), 'important-week labels stay private');
});

test('drawPicture leaves out legend entries and the address when there is nothing to show', () => {
  const none = draw('1990-01-01', '2026-11-04', [], '');
  assert.ok(!none.texts.includes('Important week'));
  assert.ok(!none.texts.some((t) => t.includes('github.io')));

  // Past the end of the grid there is no "this week".
  const past = draw('1920-01-01', '2026-11-04');
  assert.ok(!past.texts.includes('This week'));
  assert.equal(past.filled('INK').length + 1, YEARS * WEEKS_PER_YEAR);
  assert.deepEqual(past.birth, ['NOW', 'BG', 'INK']);
  assert.ok(past.texts.includes('Born'), 'the week you were born is still ringed');
  assert.ok(past.texts.includes('0 weeks ahead.'));
});

for (const format of ALL) {
  test(`${format.id}: drawPicture keeps the title inside the grid width for the longest numbers`, () => {
    const { ctx, layout, textCalls } = draw('2026-11-04', '2026-11-04', [], 'example.github.io/weeks', format); // 5,199 weeks ahead
    const title = textCalls.filter((c) => /weeks (lived|ahead)/.test(c.text));
    assert.equal(title.length, 2);
    // Measure each line, or the two parts of a one-line title together.
    const lines = new Map();
    for (const c of title) lines.set(c.y, [...(lines.get(c.y) ?? []), c]);
    for (const parts of lines.values()) {
      ctx.font = parts[0].font;
      const right = Math.max(...parts.map((c) => c.x + ctx.measureText(c.text).width));
      assert.ok(right <= layout.left + layout.textWidth + 0.5, `${parts.map((c) => c.text).join(' ')} fits`);
    }
  });
}

test('drawPicture writes the text it is given in place of the counts', () => {
  const ctx = fakeContext();
  const born = d('1990-01-01');
  drawPicture(ctx, {
    format: PREVIEW,
    stats: lifeStats(born, d('2026-11-04')),
    events: eventsByWeek(born, []),
    colors: COLORS,
    site: 'example.com/weeks',
    text: { eyebrow: 'Life in Weeks', lived: 'Every square is a week.', ahead: 'See yours.' },
  });
  const texts = ctx.calls.filter((c) => c.op === 'text');
  const words = texts.map((c) => c.text);
  assert.ok(words.includes('LIFE IN WEEKS'));
  const first = texts.find((c) => c.text === 'Every square is a week.');
  const second = texts.find((c) => c.text === 'See yours.');
  assert.deepEqual([first.color, second.color], ['TEXT', 'MUTED']);
  assert.equal(first.y, second.y, 'one line, as the format says');
  assert.ok(!words.some((t) => /weeks (lived|ahead)/.test(t)));
});

test('the X picture puts lived and ahead on one line, and the address beside the legend', () => {
  const { textCalls, layout } = draw('1990-01-01', '2026-11-04', [], 'example.github.io/weeks', FORMATS.x);
  const lived = textCalls.find((c) => c.text === '1,915 weeks lived.');
  const ahead = textCalls.find((c) => c.text === '3,284 weeks ahead.');
  assert.equal(lived.y, ahead.y);
  assert.ok(ahead.x > lived.x);
  const site = textCalls.find((c) => c.text === 'example.github.io/weeks');
  assert.equal(site.y, layout.legend.y);
});

test('a grid of columns has its ages along the bottom, at the start of each decade', () => {
  const { textCalls, layout } = draw('1990-01-01', '2026-11-04', [], '', FORMATS.linkedin);
  const ages = textCalls.filter((c) => /^\d+$/.test(c.text));
  assert.deepEqual(ages.map((c) => c.text), ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90']);
  for (const c of ages) {
    assert.equal(c.y, layout.ages.y);
    assert.equal(c.x, cellBox(layout.grid, Number(c.text) * WEEKS_PER_YEAR).x);
  }
});

test('drawPicture rings the week you were born and keeps its own color inside', () => {
  // A lived week, an important week and, for someone born this week, this week.
  const cases = [
    ['1990-01-01', '2026-11-04', [], 'INK'],
    ['1990-01-01', '2026-11-04', [{ id: 1, date: '1990-01-03', label: 'Home from hospital', color: 'green' }], 'GREEN'],
    ['2026-11-04', '2026-11-04', [], 'NOW'],
  ];
  for (const [birthday, today, events, inside] of cases) {
    const { birth, birthFills, first, filled } = draw(birthday, today, events);
    assert.deepEqual(birth, ['NOW', 'BG', inside], `born ${birthday}`);
    const [ring, gap, week] = birthFills.map((f) => f.w);
    assert.ok(ring > gap && gap > week && week >= first.w, 'ring, then a gap, then the week');
    // Its halo, if it has one, is left off: the ring takes its place.
    assert.equal(filled(inside, 0.3).length, 0);
  }
});

// ---- Chapters on the picture ---------------------------------------------------

test('stripeBox: one chapter fills the week', () => {
  for (const format of ALL) {
    const { grid } = pictureLayout(format);
    const radius = Math.max(1, Math.round(grid.cellH / 5));
    assert.deepEqual(stripeBox(grid, 200, 0, 1), { ...cellBox(grid, 200), radii: radius });
  }
});

test('stripeBox: on a grid of rows, stripes stack top to bottom and fill the week exactly', () => {
  const { grid } = pictureLayout(FORMATS.story);
  const week = cellBox(grid, 300);
  for (const n of [2, 3]) {
    const stripes = Array.from({ length: n }, (_, k) => stripeBox(grid, 300, k, n));
    assert.equal(stripes[0].y, week.y);
    assert.equal(stripes.at(-1).y + stripes.at(-1).h, week.y + week.h);
    for (let k = 1; k < n; k++) assert.equal(stripes[k].y, stripes[k - 1].y + stripes[k - 1].h, 'no gap, no overlap');
    for (const s of stripes) assert.deepEqual([s.x, s.w], [week.x, week.w]);
    const r = Math.max(1, Math.round(grid.cellH / 5));
    assert.deepEqual(stripes[0].radii, [r, r, 0, 0], 'top corners');
    assert.deepEqual(stripes.at(-1).radii, [0, 0, r, r], 'bottom corners');
    if (n === 3) assert.deepEqual(stripes[1].radii, [0, 0, 0, 0]);
  }
});

test('stripeBox: on a grid of columns, stripes sit side by side, so they run down the year as time does', () => {
  const { grid } = pictureLayout(FORMATS.x);
  const week = cellBox(grid, 300);
  const [a, b] = [stripeBox(grid, 300, 0, 2), stripeBox(grid, 300, 1, 2)];
  assert.deepEqual([a.y, a.h, b.y, b.h], [week.y, week.h, week.y, week.h]);
  assert.equal(a.x, week.x);
  assert.equal(b.x, a.x + a.w);
  assert.equal(b.x + b.w, week.x + week.w);
  const r = Math.max(1, Math.round(grid.cellH / 5));
  assert.deepEqual(a.radii, [r, 0, 0, r], 'left corners');
  assert.deepEqual(b.radii, [0, r, r, 0], 'right corners');
});

const LIFE = [
  { id: 1, start: '2008-08-25', end: '2012-05-15', label: 'College', color: 'green' },
  { id: 2, start: '2012-06-01', end: '', label: 'Seattle', color: 'violet' },
  { id: 3, start: '2014-02-14', end: '2016-02-14', label: 'Acme', color: 'teal' },
  { id: 4, start: '2027-09-01', end: '2029-06-30', label: 'Sabbatical', color: 'red' },
];
const born1990 = d('1990-01-01');
const at = (date) => weekIndex(born1990, d(date));
const weeksOf = (start, end) => at(end) - at(start) + 1;

for (const format of ALL) {
  test(`${format.id}: drawPicture paints lived weeks in their chapters' colors, and tints weeks ahead`, () => {
    const { filled } = draw('1990-01-01', '2026-11-04', [], 'example.github.io/weeks', format, LIFE);
    const nowIndex = lifeStats(born1990, d('2026-11-04')).nowIndex;
    const college = weeksOf('2008-08-25', '2012-05-15');
    const seattle = nowIndex - at('2012-06-01'); // up to, not including, this week
    const acme = weeksOf('2014-02-14', '2016-02-14');
    const sabbatical = weeksOf('2027-09-01', '2029-06-30');
    assert.equal(filled('GREEN').length, college);
    assert.equal(filled('VIOLET').length, seattle, 'one stripe a week, with Acme or without');
    assert.equal(filled('TEAL').length, acme);
    // Lived weeks outside chapters stay ink; this week stays this week.
    assert.equal(filled('INK').length, nowIndex - 1 - college - seattle);
    assert.equal(filled('NOW').length, 1);
    // Weeks ahead keep the ahead color, with the chapter's shade over them at the tint.
    assert.equal(filled('FUTURE').length, YEARS * WEEKS_PER_YEAR - nowIndex - 1);
    assert.equal(filled('RED', 0.35).length, sabbatical);
    assert.equal(filled('RED').length, 0);
  });
}

test('drawPicture splits a week in two chapters into a stripe of each, in lane order', () => {
  const { ctx, layout } = draw('1990-01-01', '2026-11-04', [], 'example.github.io/weeks', FORMATS.story, LIFE);
  const week = at('2015-01-05');
  const stripes = ctx.calls
    .filter((c) => c.op === 'fill')
    .flatMap((c) => c.rects.filter(([x, y, w, h]) => {
      const box = cellBox(layout.grid, week);
      return x === box.x && y >= box.y && y + h <= box.y + box.h;
    }).map(([, y]) => ({ color: c.color, y })));
  assert.deepEqual(stripes.sort((a, z) => a.y - z.y).map((s) => s.color), ['VIOLET', 'TEAL'], 'Seattle on top, Acme below');
});

test('drawPicture draws an important week over its chapter, with a gap of background around it', () => {
  const events = [{ id: 1, date: '2010-03-01', label: 'Graduated', color: 'green' }];
  const { filled, layout } = draw('1990-01-01', '2026-11-04', events, 'example.github.io/weeks', FORMATS.story, LIFE);
  assert.equal(filled('GREEN').length, weeksOf('2008-08-25', '2012-05-15'), 'the important week replaces its chapter week');
  const box = cellBox(layout.grid, at('2010-03-01'));
  const centred = (r) => r[0] + r[2] / 2 === box.x + box.w / 2 && r[1] + r[3] / 2 === box.y + box.h / 2;
  const gap = filled('BG').filter(centred);
  const week = filled('GREEN').filter(centred);
  assert.equal(gap.length, 1);
  assert.ok(gap[0][2] > week[0][2], 'the gap is around the week');
});

test('drawPicture shows each chapter color once in the legend, in palette order, and no chapter names', () => {
  const { legend, texts } = draw('1990-01-01', '2026-11-04', [{ id: 1, date: '2015-03-02', label: 'Married', color: 'pink' }], 'example.github.io/weeks', FORMATS.story, LIFE);
  // Lived, ahead, this week, born (ring, gap, swatch), then chapters, then important weeks.
  assert.deepEqual(legend, ['INK', 'FUTURE', 'NOW', 'NOW', 'BG', 'INK', 'VIOLET', 'RED', 'GREEN', 'TEAL', 'PINK']);
  assert.ok(texts.includes('Chapter'));
  for (const { label } of LIFE) assert.ok(!texts.some((t) => t.includes(label)), `${label} stays private`);
  assert.ok(!draw('1990-01-01', '2026-11-04').texts.includes('Chapter'), 'no chapters, no legend entry');
});

test('drawPicture rings the week you were born and shows its chapters inside', () => {
  const childhood = [
    { id: 1, start: '1990-01-01', end: '2008-06-01', label: 'Childhood', color: 'teal' },
    { id: 2, start: '1990-01-01', end: '1990-03-01', label: 'Hospital', color: 'red' },
  ];
  const { ctx, layout } = draw('1990-01-01', '2026-11-04', [], 'example.github.io/weeks', FORMATS.story, childhood);
  const first = cellBox(layout.grid, BIRTH_WEEK);
  const inFirst = ctx.calls
    .filter((c) => c.op === 'fill')
    .flatMap((c) => c.rects.filter(([x, y, w, h]) => x <= first.x && y <= first.y + first.h && x + w >= first.x + first.w && y + h >= first.y).map(() => c.color));
  // The ring, the gap inside it, then a stripe of each chapter.
  assert.deepEqual(inFirst.slice(-4), ['NOW', 'BG', 'TEAL', 'RED']);
});
