// The story picture: the whole week grid on one tall image, sized for
// Instagram stories (1080 × 1920). It is drawn on a canvas in the browser;
// nothing is uploaded.
//
// storyLayout, storyText and siteAddress are pure, so they are unit tested.
// drawStory only uses the 2D canvas context it is given.

import { YEARS, WEEKS_PER_YEAR, cellState } from './weeks.js';
import { COLORS, weekColor } from './colors.js';

/**
 * Picture formats. Only the vertical story for now. The layout is worked out
 * from a format's size, so another format is another entry here.
 *
 * Text stays out of `safeTop` and `safeBottom`: Instagram draws the poster's
 * name over the top of a story and the reply bar over the bottom.
 */
export const FORMATS = Object.freeze({
  story: Object.freeze({ id: 'story', width: 1080, height: 1920, safeTop: 180, safeBottom: 180, sideMargin: 90 }),
});

const SANS = "'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";

// Type sizes and line heights, and the space between blocks, in pixels of
// the picture.
const TYPE = {
  eyebrow: { size: 26, line: 32 },
  title: { size: 60, line: 66 },
  year: { size: 18 },
  legend: { size: 24, line: 30 },
  footer: { size: 22, line: 28 },
};
const SPACE = { eyebrow: 26, title: 48, grid: 40, legend: 14 };
const YEAR_GUTTER = 14; // between a year label and the grid
const MARK = { square: 7, gap: 3, text: 14 }; // the brand mark before the eyebrow

/** Years between the labels down the left of the grid. */
export const YEAR_LABEL_EVERY = 10;

/** The fonts the picture uses, to load before drawing. */
export const STORY_FONTS = [
  `500 ${TYPE.title.size}px ${SANS}`,
  `400 ${TYPE.legend.size}px ${SANS}`,
  `400 ${TYPE.eyebrow.size}px ${MONO}`,
];

const fmtInt = (n) => n.toLocaleString('en-US');
const weeks = (n) => `${fmtInt(n)} ${n === 1 ? 'week' : 'weeks'}`;

/** The words on the picture. `stats` is lifeStats(). */
export function storyText(stats) {
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
 * The largest whole-pixel grid that fits in `maxWidth` × `maxHeight`.
 * Rows get a little more space between them than columns where it fits,
 * as on the page, so each year reads as a line.
 */
function fitGrid(maxWidth, maxHeight, cols, rows) {
  for (let cell = 40; cell >= 1; cell--) {
    const colGap = Math.max(1, Math.round(cell * 0.2));
    for (const rowGap of [Math.max(colGap, Math.round(cell * 0.3)), colGap]) {
      const width = cols * cell + (cols - 1) * colGap;
      const height = rows * cell + (rows - 1) * rowGap;
      if (width <= maxWidth && height <= maxHeight) {
        return { cols, rows, cell, colGap, rowGap, width, height };
      }
    }
  }
  throw new Error('The picture is too small for the grid.');
}

/**
 * Where everything goes on the picture. Text `y` values are the middle of
 * the line. The grid is centred across the picture and everything is
 * centred as one block between the safe zones. Leave out the footer when
 * there is no site address to print.
 */
export function storyLayout(format = FORMATS.story, { years = YEARS, footer = true } = {}) {
  const { width, height, safeTop, safeBottom, sideMargin } = format;
  const head = TYPE.eyebrow.line + SPACE.eyebrow + 2 * TYPE.title.line + SPACE.title;
  const foot = SPACE.grid + TYPE.legend.line + (footer ? SPACE.legend + TYPE.footer.line : 0);
  const room = height - safeTop - safeBottom;

  const grid = fitGrid(width - 2 * sideMargin, room - head - foot, WEEKS_PER_YEAR, years);
  grid.x = Math.round((width - grid.width) / 2);

  let y = safeTop + Math.floor((room - head - grid.height - foot) / 2);
  const line = (h) => {
    const middle = y + h / 2;
    y += h;
    return middle;
  };

  const eyebrow = { y: line(TYPE.eyebrow.line), size: TYPE.eyebrow.size };
  y += SPACE.eyebrow;
  const title = { y: [line(TYPE.title.line), line(TYPE.title.line)], size: TYPE.title.size };
  y += SPACE.title;
  grid.y = y;
  y += grid.height + SPACE.grid;
  const legend = { y: line(TYPE.legend.line), size: TYPE.legend.size };
  let footerLine = null;
  if (footer) {
    y += SPACE.legend;
    footerLine = { y: line(TYPE.footer.line), size: TYPE.footer.size };
  }

  return {
    width,
    height,
    left: grid.x,
    textWidth: grid.width,
    eyebrow,
    title,
    grid,
    years: { x: grid.x - YEAR_GUTTER, size: TYPE.year.size, every: YEAR_LABEL_EVERY },
    legend,
    footer: footerLine,
  };
}

/** The top-left corner and size of week `index` on the grid. */
export function cellBox(grid, index) {
  const row = Math.floor(index / grid.cols);
  const col = index % grid.cols;
  return {
    x: grid.x + col * (grid.cell + grid.colGap),
    y: grid.y + row * (grid.cell + grid.rowGap),
    size: grid.cell,
  };
}

// ---- Drawing ---------------------------------------------------------------

function addRect(ctx, x, y, size, radius) {
  if (ctx.roundRect) ctx.roundRect(x, y, size, size, radius);
  else ctx.rect(x, y, size, size);
}

/** Fill the weeks at `indexes` in one go, each grown by `grow` on every side. */
function fillCells(ctx, grid, indexes, color, grow = 0) {
  if (!indexes.length) return;
  const radius = Math.max(1, Math.round(grid.cell / 5));
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const index of indexes) {
    const box = cellBox(grid, index);
    addRect(ctx, box.x - grow, box.y - grow, box.size + 2 * grow, radius + grow);
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
    addRect(ctx, x + (i % 3) * step, top + Math.floor(i / 3) * step, MARK.square, 1.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return 3 * step - MARK.gap;
}

/**
 * Draw the story picture on `ctx`, whose canvas is `format.width` ×
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
 * picture is meant to be posted, the labels are private.
 */
export function drawStory(ctx, { format = FORMATS.story, stats, events, colors, site = '' }) {
  const layout = storyLayout(format, { years: stats.years, footer: Boolean(site) });
  const { grid } = layout;
  const text = storyText(stats);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Eyebrow: the mark, then MY LIFE IN WEEKS.
  const markWidth = drawMark(ctx, layout.left, layout.eyebrow.y, colors);
  ctx.font = `400 ${layout.eyebrow.size}px ${MONO}`;
  ctx.fillStyle = colors.muted;
  spacedText(ctx, text.eyebrow.toUpperCase(), layout.left + markWidth + MARK.text, layout.eyebrow.y, layout.eyebrow.size * 0.08);

  // Title, shrunk if a long number would run past the grid.
  const titleFont = (s) => `500 ${s}px ${SANS}`;
  const titleSpacing = 'letterSpacing' in ctx;
  const titleSize = fitFont(ctx, titleFont, layout.title.size, layout.textWidth, () =>
    Math.max(ctx.measureText(text.lived).width, ctx.measureText(text.ahead).width),
  );
  if (titleSpacing) ctx.letterSpacing = `${-titleSize * 0.025}px`;
  ctx.fillStyle = colors.text;
  ctx.fillText(text.lived, layout.left, layout.title.y[0]);
  ctx.fillStyle = colors.muted;
  ctx.fillText(text.ahead, layout.left, layout.title.y[1]);
  if (titleSpacing) ctx.letterSpacing = '0px';

  // Ages down the left.
  ctx.font = `400 ${layout.years.size}px ${MONO}`;
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'right';
  for (let row = 0; row < grid.rows; row += layout.years.every) {
    const box = cellBox(grid, row * grid.cols);
    ctx.fillText(String(row), layout.years.x, box.y + box.size / 2);
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
  // as on the page.
  const grow = Math.max(1, Math.round(grid.cell * 0.1));
  const ring = (share) => grow + Math.max(2, Math.round(grid.cell * share));
  fillCells(ctx, grid, groups.lived, colors.ink);
  fillCells(ctx, grid, groups.ahead, colors.future);
  fillCells(ctx, grid, groups.now, colors.nowA, ring(0.35));
  fillCells(ctx, grid, groups.now, colors.now, grow);
  ctx.globalAlpha = colors.halo;
  for (const { shade, indexes } of marks) fillCells(ctx, grid, indexes, shade, ring(0.18));
  ctx.globalAlpha = 1;
  for (const { shade, indexes } of marks) fillCells(ctx, grid, indexes, shade, grow);

  // Legend, shrunk to the grid's width if it has to be. Important weeks get
  // one swatch per color on the grid, side by side, as on the page.
  const items = [
    ['Lived', [colors.ink]],
    ['Ahead', [colors.future]],
  ];
  if (groups.now.length) items.push(['This week', [colors.now]]);
  if (marks.length) items.push(['Important week', marks.map((m) => m.shade)]);
  const legendFont = (s) => `400 ${s}px ${SANS}`;
  const swatchSize = (s) => Math.round(s * 0.75);
  const swatchGap = 4;
  const swatchesWidth = (s, n) => n * swatchSize(s) + (n - 1) * swatchGap;
  const legendWidth = (s) =>
    items.reduce(
      (sum, [label, shades]) => sum + swatchesWidth(s, shades.length) + s * 0.45 + ctx.measureText(label).width,
      (items.length - 1) * s * 1.1,
    );
  const legendSize = fitFont(ctx, legendFont, layout.legend.size, layout.textWidth, legendWidth);
  const swatch = swatchSize(legendSize);
  let x = layout.left;
  for (const [label, shades] of items) {
    for (const shade of shades) {
      ctx.fillStyle = shade;
      ctx.beginPath();
      addRect(ctx, x, Math.round(layout.legend.y - swatch / 2), swatch, 3);
      ctx.fill();
      x += swatch + swatchGap;
    }
    x += legendSize * 0.45 - swatchGap;
    ctx.fillStyle = colors.muted;
    ctx.fillText(label, x, layout.legend.y);
    x += ctx.measureText(label).width + legendSize * 1.1;
  }

  // Where to make your own.
  if (layout.footer) {
    const footerFont = (s) => `400 ${s}px ${MONO}`;
    fitFont(ctx, footerFont, layout.footer.size, layout.textWidth, () => ctx.measureText(site).width);
    ctx.fillStyle = colors.muted;
    ctx.fillText(site, layout.left, layout.footer.y);
  }
}
