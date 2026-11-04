// The share pictures: the whole week grid on one image, sized for a story or
// post on Instagram, a LinkedIn post or a post on X. Drawn on a canvas in
// the browser; nothing is uploaded.
//
// pictureLayout, pictureText and siteAddress are pure, so they are unit
// tested. drawPicture only uses the 2D canvas context it is given.

import { YEARS, WEEKS_PER_YEAR, BIRTH_WEEK, cellState } from './weeks.js';
import { COLORS, weekColor } from './colors.js';

/**
 * The picture formats, in the order the Share buttons show them. Each is
 * laid out from its own size, so another format is another entry here.
 *
 * - `years`: 'rows' puts one year per row, as on the page, for tall
 *   pictures; 'columns' turns the grid on its side, one year per column with
 *   life running left to right, for square and wide ones.
 * - `margin`: space kept clear of text. A story's top and bottom are large
 *   because Instagram draws the poster's name over the top of a story and
 *   the reply bar over the bottom.
 * - `type`: font sizes in pixels of the picture. `titleLines` is 2 for
 *   "N weeks lived." over "N weeks ahead.", or 1 for both on one line.
 * - `footerBeside`: put the site's address at the right end of the legend's
 *   line instead of on a line of its own.
 *
 * The grid fills the width between the side margins. Weeks are as tall as
 * the height left after the text allows, so they can come out wider than
 * they are tall.
 */
export const FORMATS = Object.freeze({
  story: Object.freeze({
    id: 'story', name: 'Instagram story', sizedFor: 'Instagram stories',
    width: 1080, height: 1920, years: 'rows',
    margin: { top: 180, bottom: 180, side: 72 },
    type: { eyebrow: 26, title: 60, year: 18, legend: 24, footer: 22 }, titleLines: 2,
  }),
  post: Object.freeze({
    id: 'post', name: 'Instagram post', sizedFor: 'Instagram posts',
    width: 1080, height: 1350, years: 'columns',
    margin: { top: 96, bottom: 96, side: 72 },
    type: { eyebrow: 26, title: 96, year: 18, legend: 24, footer: 22 }, titleLines: 2,
  }),
  linkedin: Object.freeze({
    id: 'linkedin', name: 'LinkedIn post', sizedFor: 'LinkedIn posts',
    width: 1200, height: 1200, years: 'columns',
    margin: { top: 96, bottom: 96, side: 72 },
    type: { eyebrow: 28, title: 104, year: 20, legend: 26, footer: 24 }, titleLines: 2,
  }),
  x: Object.freeze({
    id: 'x', name: 'X / Twitter post', sizedFor: 'posts on X (Twitter)',
    width: 1600, height: 900, years: 'columns',
    margin: { top: 64, bottom: 64, side: 80 },
    type: { eyebrow: 26, title: 64, year: 20, legend: 26, footer: 24 }, titleLines: 1, footerBeside: true,
  }),
});

const SANS = "'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";
const MARK = { square: 7, gap: 3, text: 14 }; // the brand mark before the eyebrow

/** Years between the age labels along the grid. */
export const YEAR_LABEL_EVERY = 10;

/** The fonts the pictures use, to load before drawing. */
export const PICTURE_FONTS = [`500 60px ${SANS}`, `400 24px ${SANS}`, `400 24px ${MONO}`];

const fmtInt = (n) => n.toLocaleString('en-US');
const weeks = (n) => `${fmtInt(n)} ${n === 1 ? 'week' : 'weeks'}`;

/** The words on the picture. `stats` is lifeStats(). */
export function pictureText(stats) {
  return {
    eyebrow: 'My life in weeks',
    lived: `${weeks(stats.lived)} lived.`,
    ahead: `${weeks(stats.ahead)} ahead.`,
  };
}

/**
 * The app's address to print on the picture, like `example.github.io/weeks`,
 * so friends can make their own. '' when the page isn't served over the web.
 */
export function siteAddress(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  return url.host + url.pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
}

/**
 * The largest whole-pixel grid of `cols` × `rows` weeks that fits in
 * `maxWidth` × `maxHeight`. Weeks are as tall as the height allows, then as
 * wide as the width allows (never narrower than tall), so the grid fills
 * the width. The gap between weeks is a fifth of their height, or a pixel
 * less if that lets them be taller, but never under an eighth of it, so
 * the weeks stay apart.
 */
function fitGrid(maxWidth, maxHeight, cols, rows) {
  for (let cellH = 40; cellH >= 1; cellH--) {
    const gap = Math.max(1, Math.round(cellH * 0.2));
    for (const g of new Set([gap, Math.max(1, gap - 1, Math.ceil(cellH / 8))])) {
      const cellW = Math.floor((maxWidth - (cols - 1) * g) / cols);
      const height = rows * cellH + (rows - 1) * g;
      if (cellW >= cellH && height <= maxHeight) {
        return { cols, rows, cellW, cellH, colGap: g, rowGap: g, width: cols * cellW + (cols - 1) * g, height };
      }
    }
  }
  throw new Error('The picture is too small for the grid.');
}

const lineOf = (size) => Math.round(size * 1.25);
const titleLineOf = (size) => Math.round(size * 1.1);

/**
 * Where everything goes on the picture, from top to bottom: eyebrow, title,
 * grid (with the age labels beside or below it), legend and site address.
 * Text `y` values are the middle of the line. The grid is centred across the
 * picture and everything is centred as one block between the margins.
 * Leave out the footer when there is no site address to print.
 */
export function pictureLayout(format = FORMATS.story, { years = YEARS, footer = true } = {}) {
  const { width, height, margin, type, titleLines } = format;
  const byColumns = format.years === 'columns';
  const footerLine = footer && !format.footerBeside;

  const space = {
    eyebrow: type.eyebrow,
    title: Math.round(type.title * 0.8),
    grid: Math.round(type.legend * 1.6),
    ages: Math.round(type.year * 0.6), // between the grid and the ages below it
    legend: Math.round(type.legend * 0.6),
  };
  const agesBelow = byColumns ? space.ages + lineOf(type.year) : 0;
  const head = lineOf(type.eyebrow) + space.eyebrow + titleLines * titleLineOf(type.title) + space.title;
  const foot = agesBelow + space.grid + lineOf(type.legend) + (footerLine ? space.legend + lineOf(type.footer) : 0);
  const room = height - margin.top - margin.bottom;

  const [cols, rows] = byColumns ? [years, WEEKS_PER_YEAR] : [WEEKS_PER_YEAR, years];
  const grid = fitGrid(width - 2 * margin.side, room - head - foot, cols, rows);
  grid.byColumns = byColumns;
  grid.x = Math.round((width - grid.width) / 2);

  let y = margin.top + Math.floor((room - head - grid.height - foot) / 2);
  const line = (h) => {
    const middle = y + h / 2;
    y += h;
    return middle;
  };

  const eyebrow = { y: line(lineOf(type.eyebrow)), size: type.eyebrow };
  y += space.eyebrow;
  const titleYs = [];
  for (let i = 0; i < titleLines; i++) titleYs.push(line(titleLineOf(type.title)));
  y += space.title;
  grid.y = y;
  y += grid.height;
  let ages;
  if (byColumns) {
    y += space.ages;
    ages = { along: 'below', y: line(lineOf(type.year)), size: type.year, every: YEAR_LABEL_EVERY };
  } else {
    ages = { along: 'left', x: grid.x - Math.round(type.year * 0.8), size: type.year, every: YEAR_LABEL_EVERY };
  }
  y += space.grid;
  const legend = { y: line(lineOf(type.legend)), size: type.legend };
  let footerAt = null;
  if (footer && format.footerBeside) footerAt = { y: legend.y, size: type.footer, beside: true };
  else if (footer) {
    y += space.legend;
    footerAt = { y: line(lineOf(type.footer)), size: type.footer, beside: false };
  }

  return {
    width,
    height,
    left: grid.x,
    textWidth: grid.width,
    eyebrow,
    title: { y: titleYs, size: type.title },
    grid,
    ages,
    legend,
    footer: footerAt,
  };
}

/**
 * The top-left corner, width and height of week `index` (counted from the
 * week you were born) on the grid, whichever way the grid runs.
 */
export function cellBox(grid, index) {
  const year = Math.floor(index / WEEKS_PER_YEAR);
  const week = index % WEEKS_PER_YEAR;
  const [col, row] = grid.byColumns ? [year, week] : [week, year];
  return {
    x: grid.x + col * (grid.cellW + grid.colGap),
    y: grid.y + row * (grid.cellH + grid.rowGap),
    w: grid.cellW,
    h: grid.cellH,
  };
}

// ---- Drawing ---------------------------------------------------------------

function addRect(ctx, x, y, w, h, radius) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
}

/**
 * A ring of `color` around a box `x, y, w, h` (corner `radius`), `gap` away
 * from it and `width` wide. The gap is painted `bg`; draw the box after.
 */
function ringBox(ctx, { x, y, w, h }, radius, { color, bg, gap, width }) {
  for (const [fill, out] of [[color, gap + width], [bg, gap]]) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    addRect(ctx, x - out, y - out, w + 2 * out, h + 2 * out, radius + out);
    ctx.fill();
  }
}

/** Fill the weeks at `indexes` in one go, each grown by `grow` on every side. */
function fillCells(ctx, grid, indexes, color, grow = 0) {
  if (!indexes.length) return;
  const radius = Math.max(1, Math.round(grid.cellH / 5));
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const index of indexes) {
    const box = cellBox(grid, index);
    addRect(ctx, box.x - grow, box.y - grow, box.w + 2 * grow, box.h + 2 * grow, radius + grow);
  }
  ctx.fill();
}

/** Letter-spaced text, also where the canvas has no letterSpacing. */
function spacedText(ctx, text, x, y, spacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
    return;
  }
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

/** Set the largest `font(size)`, up to `size`, at which `widthAt()` is at most `max`. Returns that size. */
function fitFont(ctx, font, size, max, widthAt) {
  let s = size;
  ctx.font = font(s);
  while (s > 10 && widthAt(s) > max) {
    s -= 1;
    ctx.font = font(s);
  }
  return s;
}

/** The three-by-three mark from the top bar, `MARK` sized, centred on `y`. */
function drawMark(ctx, x, y, colors) {
  const step = MARK.square + MARK.gap;
  const top = Math.round(y - (3 * step - MARK.gap) / 2);
  for (let i = 0; i < 9; i++) {
    ctx.globalAlpha = i > 4 ? 0.25 : 1;
    ctx.fillStyle = i === 4 ? colors.now : colors.text;
    ctx.beginPath();
    addRect(ctx, x + (i % 3) * step, top + Math.floor(i / 3) * step, MARK.square, MARK.square, 1.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return 3 * step - MARK.gap;
}

/**
 * Draw the picture for `format` on `ctx`, whose canvas is `format.width` ×
 * `format.height`.
 *
 * - `stats`: lifeStats() for today
 * - `events`: eventsByWeek(), the important weeks by grid index
 * - `colors`: the theme's bg, text, ink, muted, future, now and nowA; `marks`,
 *   the shade of each important-week color by id (from colors.js); and
 *   `halo`, how opaque (0–1) the ring around an important week is
 * - `site`: the address to print at the bottom, or ''
 *
 * Important weeks show in their colors but their labels are left off: the
 * picture is meant to be posted, the labels are private. The week you were
 * born is ringed in the this-week color, as on the page.
 */
export function drawPicture(ctx, { format = FORMATS.story, stats, events, colors, site = '' }) {
  const layout = pictureLayout(format, { years: stats.years, footer: Boolean(site) });
  const { grid } = layout;
  const text = pictureText(stats);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Eyebrow: the mark, then MY LIFE IN WEEKS.
  const markWidth = drawMark(ctx, layout.left, layout.eyebrow.y, colors);
  ctx.font = `400 ${layout.eyebrow.size}px ${MONO}`;
  ctx.fillStyle = colors.muted;
  spacedText(ctx, text.eyebrow.toUpperCase(), layout.left + markWidth + MARK.text, layout.eyebrow.y, layout.eyebrow.size * 0.08);

  // Title: lived over ahead, or both on one line. Shrunk if a long number
  // would run past the grid.
  const titleFont = (s) => `500 ${s}px ${SANS}`;
  const titleSpacing = 'letterSpacing' in ctx;
  const oneLine = layout.title.y.length === 1;
  const titleWidth = () =>
    oneLine
      ? ctx.measureText(`${text.lived} ${text.ahead}`).width
      : Math.max(ctx.measureText(text.lived).width, ctx.measureText(text.ahead).width);
  const titleSize = fitFont(ctx, titleFont, layout.title.size, layout.textWidth, titleWidth);
  if (titleSpacing) ctx.letterSpacing = `${-titleSize * 0.025}px`;
  ctx.fillStyle = colors.text;
  ctx.fillText(text.lived, layout.left, layout.title.y[0]);
  ctx.fillStyle = colors.muted;
  if (oneLine) ctx.fillText(text.ahead, layout.left + ctx.measureText(`${text.lived} `).width, layout.title.y[0]);
  else ctx.fillText(text.ahead, layout.left, layout.title.y[1]);
  if (titleSpacing) ctx.letterSpacing = '0px';

  // Ages: down the left of a grid of rows, or along the bottom of a grid of
  // columns, at the start of each decade.
  const { ages } = layout;
  ctx.font = `400 ${ages.size}px ${MONO}`;
  ctx.fillStyle = colors.muted;
  for (let age = 0; age < stats.years; age += ages.every) {
    const box = cellBox(grid, age * WEEKS_PER_YEAR);
    if (ages.along === 'left') {
      ctx.textAlign = 'right';
      ctx.fillText(String(age), ages.x, box.y + box.h / 2);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(String(age), box.x, ages.y);
    }
  }
  ctx.textAlign = 'left';

  // The weeks.
  const total = grid.rows * grid.cols;
  const groups = { lived: [], ahead: [], now: [], event: [] };
  for (let i = 0; i < total; i++) groups[cellState(i, stats.nowIndex, events)].push(i);

  // Important weeks by color, in palette order.
  const byColor = new Map(COLORS.map((c) => [c.id, []]));
  for (const index of groups.event) byColor.get(weekColor(events.get(index))).push(index);
  const marks = [...byColor].filter(([, indexes]) => indexes.length).map(([id, indexes]) => ({ shade: colors.marks[id], indexes }));

  // This week and important weeks are drawn a little bigger, with a ring,
  // as on the page. The week you were born is left for last, since its ring
  // goes over its neighbours.
  const grow = Math.max(1, Math.round(grid.cellH * 0.1));
  const ring = (share) => grow + Math.max(2, Math.round(grid.cellH * share));
  const notBirth = (indexes) => indexes.filter((i) => i !== BIRTH_WEEK);
  fillCells(ctx, grid, notBirth(groups.lived), colors.ink);
  fillCells(ctx, grid, notBirth(groups.ahead), colors.future);
  fillCells(ctx, grid, notBirth(groups.now), colors.nowA, ring(0.35));
  fillCells(ctx, grid, notBirth(groups.now), colors.now, grow);
  ctx.globalAlpha = colors.halo;
  for (const { shade, indexes } of marks) fillCells(ctx, grid, notBirth(indexes), shade, ring(0.18));
  ctx.globalAlpha = 1;
  for (const { shade, indexes } of marks) fillCells(ctx, grid, notBirth(indexes), shade, grow);

  // The week you were born: its own color inside a ring of the this-week
  // color, with a gap of background between.
  const birthState = cellState(BIRTH_WEEK, stats.nowIndex, events);
  const [birthColor, birthGrow] = {
    lived: [colors.ink, 0],
    now: [colors.now, grow],
    event: [colors.marks[weekColor(events.get(BIRTH_WEEK) ?? [])], grow],
  }[birthState];
  const radius = Math.max(1, Math.round(grid.cellH / 5));
  const birthBox = cellBox(grid, BIRTH_WEEK);
  const birthRing = { color: colors.now, bg: colors.bg, gap: Math.max(1, Math.round(grid.cellH * 0.1)), width: Math.max(2, Math.round(grid.cellH * 0.2)) };
  ringBox(ctx, { x: birthBox.x - birthGrow, y: birthBox.y - birthGrow, w: birthBox.w + 2 * birthGrow, h: birthBox.h + 2 * birthGrow }, radius + birthGrow, birthRing);
  fillCells(ctx, grid, [BIRTH_WEEK], birthColor, birthGrow);

  // The site's address, at the right end of the legend's line or on a line
  // of its own below it.
  const footerFont = (s) => `400 ${s}px ${MONO}`;
  let footerRoom = 0;
  if (layout.footer) {
    const max = layout.footer.beside ? layout.textWidth / 2 : layout.textWidth;
    fitFont(ctx, footerFont, layout.footer.size, max, () => ctx.measureText(site).width);
    ctx.fillStyle = colors.muted;
    if (layout.footer.beside) {
      ctx.textAlign = 'right';
      ctx.fillText(site, layout.left + layout.textWidth, layout.footer.y);
      ctx.textAlign = 'left';
      footerRoom = ctx.measureText(site).width + layout.legend.size * 2;
    } else {
      ctx.fillText(site, layout.left, layout.footer.y);
    }
  }

  // Legend, shrunk to the room it has if it has to be. Important weeks get
  // one swatch per color on the grid, side by side, as on the page. Born's
  // swatch is ringed like the week.
  const items = [
    ['Lived', [colors.ink]],
    ['Ahead', [colors.future]],
  ];
  if (groups.now.length) items.push(['This week', [colors.now]]);
  items.push(['Born', [colors.ink], true]);
  if (marks.length) items.push(['Important week', marks.map((m) => m.shade)]);
  const legendFont = (s) => `400 ${s}px ${SANS}`;
  const swatchSize = (s) => Math.round(s * 0.75);
  const swatchGap = 4;
  const swatchRing = { color: colors.now, bg: colors.bg, gap: 2, width: 3 };
  const ringRoom = swatchRing.gap + swatchRing.width;
  const swatchesWidth = (s, n, ringed) => n * swatchSize(s) + (n - 1) * swatchGap + (ringed ? 2 * ringRoom : 0);
  const legendWidth = (s) =>
    items.reduce(
      (sum, [label, shades, ringed]) => sum + swatchesWidth(s, shades.length, ringed) + s * 0.45 + ctx.measureText(label).width,
      (items.length - 1) * s * 1.1,
    );
  const legendSize = fitFont(ctx, legendFont, layout.legend.size, layout.textWidth - footerRoom, legendWidth);
  const swatch = swatchSize(legendSize);
  let x = layout.left;
  for (const [label, shades, ringed] of items) {
    if (ringed) x += ringRoom;
    for (const shade of shades) {
      const box = { x, y: Math.round(layout.legend.y - swatch / 2), w: swatch, h: swatch };
      if (ringed) ringBox(ctx, box, 3, swatchRing);
      ctx.fillStyle = shade;
      ctx.beginPath();
      addRect(ctx, box.x, box.y, box.w, box.h, 3);
      ctx.fill();
      x += swatch + swatchGap;
    }
    if (ringed) x += ringRoom;
    x += legendSize * 0.45 - swatchGap;
    ctx.fillStyle = colors.muted;
    ctx.fillText(label, x, layout.legend.y);
    x += ctx.measureText(label).width + legendSize * 1.1;
  }
}
