import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LABEL_WIDTH, MIN_CELL, fitGaps, gridBox, fitCells } from '../site/js/fit.js';

const fitsIn = ({ cell }, { width, height, rows, columns }) => {
  const box = gridBox(cell, rows, columns);
  return box.width <= width && box.height <= height;
};

test('gaps are whole pixels, a sliver between weeks and more between years', () => {
  assert.deepEqual(fitGaps(3), { column: 1, row: 2 });
  assert.deepEqual(fitGaps(8), { column: 1, row: 3 });
  assert.deepEqual(fitGaps(18), { column: 3, row: 8 });
  assert.deepEqual(fitGaps(40), { column: 3, row: 9 });
});

test('gridBox counts the labels, the squares and the gaps between them', () => {
  // 52 squares of 10 with 51 gaps of 1, plus the labels; 90 rows of 10 with 89 gaps of 4.
  assert.deepEqual(gridBox(10, 90, 52), { width: LABEL_WIDTH + 520 + 51, height: 900 + 356 });
});

test('on a wide screen the height decides, and the squares are as big as still fits', () => {
  const box = { width: 1112, height: 760, rows: 90, columns: 52 };
  const fit = fitCells(box);
  assert.ok(fitsIn(fit, box));
  assert.ok(gridBox(fit.cell, 90, 52).width < 1112, 'narrower than the page');
  assert.ok(!fitsIn({ cell: fit.cell + 1 }, box), 'a pixel bigger would not fit');
});

test('on a tall, narrow screen the width decides', () => {
  const box = { width: 358, height: 3000, rows: 90, columns: 52 };
  const fit = fitCells(box);
  assert.ok(fitsIn(fit, box));
  assert.ok(!fitsIn({ cell: fit.cell + 1 }, box));
  assert.ok(gridBox(fit.cell, 90, 52).height < 3000);
});

test('squares are a whole number of device pixels', () => {
  const box = { width: 1112, height: 700, rows: 77, columns: 52 };
  for (const dpr of [1, 1.5, 2, 3]) {
    const fit = fitCells({ ...box, dpr });
    assert.ok(Number.isInteger(Math.round(fit.cell * dpr * 1e9) / 1e9), `dpr ${dpr}: ${fit.cell}`);
    assert.ok(fitsIn(fit, box), `dpr ${dpr}`);
  }
  // More device pixels give a finer choice, never a smaller square.
  assert.ok(fitCells({ ...box, dpr: 2 }).cell >= fitCells({ ...box, dpr: 1 }).cell);
});

test('a window too small for the grid gets the smallest squares, and scrolls', () => {
  assert.equal(fitCells({ width: 1112, height: 120, rows: 90, columns: 52 }).cell, MIN_CELL);
  assert.equal(fitCells({ width: 0, height: 0, rows: 90, columns: 52 }).cell, MIN_CELL);
  assert.equal(fitCells({ width: -50, height: -50, rows: 90, columns: 52, dpr: 2 }).cell, MIN_CELL);
});
