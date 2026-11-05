// "Fit to screen": how big the week squares can be for the whole grid to fit
// in a box (the window, below what sits above the grid). No DOM; app.js
// measures the box and applies the result.
//
// Normally the grid fills the page's width, which makes it far taller than
// any screen. Fitted, every year shows at once, as on a poster.

/** The year labels' column to the left of the squares, in px (`.row` in styles.css). */
export const LABEL_WIDTH = 30;

/** Squares never get smaller than this; below it the page scrolls instead. */
export const MIN_CELL = 3;

/**
 * The gaps between squares for a square of `cell` px, in whole px so every
 * gap looks the same. Roughly in the proportions of the full-size grid:
 * a sliver between weeks, more between years so the rows read as years.
 */
export function fitGaps(cell) {
  return {
    column: Math.min(3, Math.max(1, Math.floor(cell * 0.17))),
    row: Math.min(9, Math.max(2, Math.floor(cell * 0.45))),
  };
}

/** The width and height of a grid of `rows` by `columns` squares of `cell` px, labels included. */
export function gridBox(cell, rows, columns) {
  const gap = fitGaps(cell);
  return {
    width: LABEL_WIDTH + columns * cell + (columns - 1) * gap.column,
    height: rows * cell + (rows - 1) * gap.row,
  };
}

/**
 * The biggest square that lets `rows` years of `columns` weeks fit in
 * `width` by `height` px, labels and gaps included. Squares are a whole
 * number of device pixels (`dpr` per px), so they all come out the same.
 * Never below MIN_CELL.
 *
 * Returns `{ cell, column, row }`: the square's size and the gaps, in px.
 */
export function fitCells({ width, height, rows, columns, dpr = 1 }) {
  const fits = (k) => {
    const box = gridBox(k / dpr, rows, columns);
    return box.width <= width && box.height <= height;
  };
  // A bigger square never takes less room, so search for the biggest that fits.
  let lo = Math.ceil(MIN_CELL * dpr);
  let hi = Math.max(lo, Math.floor(Math.max(width, 0) * dpr));
  if (!fits(lo)) hi = lo;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  const cell = lo / dpr;
  return { cell, ...fitGaps(cell) };
}
