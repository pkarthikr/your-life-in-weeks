import { test } from 'node:test';
import assert from 'node:assert/strict';

import { YEARS, WEEKS_PER_YEAR, BIRTH_WEEK, parseISODate, lifeStats, eventsByWeek } from '../site/js/weeks.js';
import { FORMATS, storyLayout, cellBox, storyText, siteAddress, drawStory } from '../site/js/story.js';
import { COLORS as PALETTE } from '../site/js/colors.js';

const d = (s) => parseISODate(s);
const story = FORMATS.story;

test('the story format is a vertical Instagram story', () => {
  assert.equal(story.width, 1080);
  assert.equal(story.height, 1920);
  assert.equal(story.width / story.height, 9 / 16);
});

for (const footer of [true, false]) {
  test(`storyLayout keeps everything inside the picture and text out of the safe zones (footer: ${footer})`, () => {
    const layout = storyLayout(story, { footer });
    const { grid } = layout;
    const lines = [layout.eyebrow, layout.legend, ...(footer ? [layout.footer] : [])];
    const middles = [...lines.map((l) => l.y), ...layout.title.y];

    assert.equal(layout.footer === null, !footer);
    for (const y of middles) {
      assert.ok(y > story.safeTop && y < story.height - story.safeBottom, `text at ${y} is in a safe zone`);
    }
    assert.ok(grid.y > layout.title.y[1] && grid.y + grid.height < layout.legend.y, 'grid sits between title and legend');
    assert.ok(grid.x >= story.sideMargin && grid.x + grid.width <= story.width - story.sideMargin);
    assert.ok(layout.years.x > 0 && layout.years.x < grid.x, 'year labels sit left of the grid');
    // Centred across the picture.
    assert.ok(Math.abs(grid.x - (story.width - grid.x - grid.width)) <= 1);
  });
}

test('storyLayout draws whole-pixel weeks with a gap between every pair', () => {
  const { grid } = storyLayout(story);
  assert.equal(grid.cols, WEEKS_PER_YEAR);
  assert.equal(grid.rows, YEARS);
  for (const n of [grid.x, grid.y, grid.cellW, grid.cellH, grid.colGap, grid.rowGap]) assert.ok(Number.isInteger(n));
  assert.ok(grid.cellH >= 8, `weeks are tall enough to see (${grid.cellH}px)`);
  assert.ok(grid.colGap >= 1 && grid.rowGap >= grid.colGap);
  assert.equal(grid.width, grid.cols * grid.cellW + (grid.cols - 1) * grid.colGap);
  assert.equal(grid.height, grid.rows * grid.cellH + (grid.rows - 1) * grid.rowGap);
});

test('storyLayout fills the width with weeks wider than they are tall', () => {
  const { grid } = storyLayout(story);
  const room = story.width - 2 * story.sideMargin;
  assert.ok(grid.cellW > grid.cellH, `${grid.cellW} × ${grid.cellH}`);
  // Only the rounding down of each week's width is left over.
  assert.ok(grid.width <= room && room - grid.width < grid.cols, `${grid.width} of ${room}px`);
});

test('cellBox walks the grid row by row', () => {
  const { grid } = storyLayout(story);
  assert.deepEqual(cellBox(grid, 0), { x: grid.x, y: grid.y, w: grid.cellW, h: grid.cellH });
  const second = cellBox(grid, 1);
  assert.equal(second.x, grid.x + grid.cellW + grid.colGap);
  assert.equal(second.y, grid.y);
  const nextRow = cellBox(grid, WEEKS_PER_YEAR);
  assert.equal(nextRow.x, grid.x);
  assert.equal(nextRow.y, grid.y + grid.cellH + grid.rowGap);
  const last = cellBox(grid, YEARS * WEEKS_PER_YEAR - 1);
  assert.equal(last.x + last.w, grid.x + grid.width);
  assert.equal(last.y + last.h, grid.y + grid.height);
});

test('storyText counts weeks lived and ahead', () => {
  const text = storyText(lifeStats(d('1990-01-01'), d('2026-11-04')));
  assert.equal(text.eyebrow, 'My life in weeks');
  assert.equal(text.lived, '1,915 weeks lived.');
  assert.equal(text.ahead, '3,284 weeks ahead.');
});

test('storyText says "week" for one', () => {
  const text = storyText({ lived: 1, ahead: 1 });
  assert.equal(text.lived, '1 week lived.');
  assert.equal(text.ahead, '1 week ahead.');
  assert.equal(storyText({ lived: 0, ahead: 5199 }).lived, '0 weeks lived.');
});

test('siteAddress is the page address without the protocol, file or hash', () => {
  assert.equal(siteAddress('https://pkarthikr.github.io/your-life-in-weeks/#weeks'), 'pkarthikr.github.io/your-life-in-weeks');
  assert.equal(siteAddress('https://pkarthikr.github.io/your-life-in-weeks/index.html?x=1#settings'), 'pkarthikr.github.io/your-life-in-weeks');
  assert.equal(siteAddress('https://weeks.example.com/'), 'weeks.example.com');
  assert.equal(siteAddress('http://localhost:8000/#weeks'), 'localhost:8000');
  assert.equal(siteAddress('file:///home/me/site/index.html'), '');
  assert.equal(siteAddress('not a url'), '');
});

// ---- drawStory against a fake canvas ---------------------------------------

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
};

function draw(birthday, today, events = [], site = 'example.github.io/weeks') {
  const born = d(birthday);
  const ctx = fakeContext();
  drawStory(ctx, { stats: lifeStats(born, d(today)), events: eventsByWeek(born, events), colors: COLORS, site });
  // Only what is filled on the grid; the legend and brand mark reuse its colours.
  const { grid } = storyLayout(story, { footer: Boolean(site) });
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
  const layout = storyLayout(story, { footer: Boolean(site) });
  const legend = ctx.calls
    .filter((c) => c.op === 'fill' && c.rects.some(([, y, , h]) => Math.abs(y + h / 2 - layout.legend.y) < 2))
    .map((c) => c.color);
  const texts = ctx.calls.filter((c) => c.op === 'text').map((c) => c.text);
  return { ctx, filled, birth, birthFills, first, texts, legend };
}

test('drawStory paints the background and every week once', () => {
  const { ctx, filled, birth } = draw('1990-01-01', '2026-11-04', [
    { id: 1, date: '2015-03-02', label: 'Moved', color: 'blue' },
    { id: 2, date: '2020-08-10', label: 'Married', color: 'blue' },
  ]);
  assert.deepEqual(ctx.calls[0], { op: 'fillRect', color: 'BG', args: [0, 0, 1080, 1920] });
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

test('drawStory paints each important week in its own color, and the legend shows each color once', () => {
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

test('drawStory writes the title, ages, legend and address, and no event labels', () => {
  const { texts } = draw('1990-01-01', '2026-11-04', [{ id: 1, date: '2015-03-02', label: 'Secret', color: 'teal' }]);
  assert.ok(texts.includes('1,915 weeks lived.'));
  assert.ok(texts.includes('3,284 weeks ahead.'));
  assert.deepEqual(texts.filter((t) => /^\d+$/.test(t)), ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90']);
  for (const label of ['Lived', 'Ahead', 'This week', 'Born', 'Important week']) assert.ok(texts.includes(label), label);
  assert.ok(texts.includes('example.github.io/weeks'));
  assert.ok(!texts.some((t) => t.includes('Secret')), 'important-week labels stay private');
});

test('drawStory leaves out legend entries and the address when there is nothing to show', () => {
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

test('drawStory keeps the title inside the grid width for the longest numbers', () => {
  const { ctx } = draw('2026-11-04', '2026-11-04'); // 5,199 weeks ahead
  const { textWidth } = storyLayout(story);
  for (const call of ctx.calls.filter((c) => c.op === 'text' && /weeks (lived|ahead)/.test(c.text))) {
    ctx.font = call.font;
    assert.ok(ctx.measureText(call.text).width <= textWidth, `${call.text} fits`);
  }
});

test('drawStory rings the week you were born and keeps its own color inside', () => {
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
