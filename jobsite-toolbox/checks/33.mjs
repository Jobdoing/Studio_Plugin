import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calculate = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-9) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const inch = 25.4;

// Manual p. 9 example: 6 in offset, 30° -> 12 in between marks, 1.5 in shrink. Marks follow the
// manual's relative rule with an assumed obstruction 40 in from the pipe start -> 41.5 in and 29.5 in.
const r = calculate.benderOffset({ offset: 6 * inch, angle: '30', obstacle: 40 * inch });
near(r.spacing, 12 * inch);
near(r.shrink, 1.5 * inch);
near(r.secondMark, 41.5 * inch);
near(r.firstMark, 29.5 * inch);
near(r.secondMark - r.firstMark, r.spacing);

// Manual p. 8 example: 5 in, 15° -> printed 19-5/16 in. Exact 5 / sin 15° = 19.3185 in, within 1/32 in.
assert.ok(Math.abs(calculate.benderOffset({ offset: 5 * inch, angle: '15' }).spacing / inch - (19 + 5 / 16)) <= 1 / 32);

// Manual p. 8 Offset Table center-to-center row (in), transcribed from the page image. Cells are printed in 1/16 in
// but not always the nearest 1/16 (45°/12 in prints 16-15/16 for 16.971); every cell is within 0.035 in of the
// exact 1 / sin value, so check within 1/16 in. The rounded 1.4 at 45° misses by up to 0.325 in and fails.
const printedCenter = {
  15: [7.75, 15 + 7 / 16, 23 + 3 / 16, 30 + 15 / 16, 38 + 5 / 8, 46 + 3 / 8, 54 + 1 / 16, 61 + 13 / 16, 69 + 9 / 16, 77.25, 85],
  30: [undefined, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44],
  45: [undefined, undefined, 8.5, 11 + 5 / 16, 14 + 1 / 8, 16 + 15 / 16, 19 + 13 / 16, 22 + 5 / 8, 25 + 7 / 16, 28.25, 31 + 1 / 8],
};
for (const [angle, row] of Object.entries(printedCenter)) {
  row.forEach((cell, i) => {
    if (cell === undefined) return;
    const spacing = calculate.benderOffset({ offset: 2 * (i + 1) * inch, angle }).spacing / inch;
    assert.ok(Math.abs(spacing - cell) <= 1 / 16, `${angle}° ${2 * (i + 1)} in: ${spacing} vs ${cell}`);
  });
}

// Every printed table row, and the table's 22-1/2° row reached via the select value "22.5".
const table = { 10: [6.0, 1 / 16], 15: [3.86, 1 / 8], 22.5: [2.6, 3 / 16], 30: [2.0, 0.25], 45: [1.4, 3 / 8], 60: [1.2, 0.5] };
// Spacing uses the exact 1 / sin(angle) (the printed multipliers are rounded to within 4%); shrink as printed.
for (const [angle, [m, s]] of Object.entries(table)) {
  const row = calculate.benderOffset({ offset: 100, angle });
  near(row.spacing, 100 / Math.sin(Number(angle) * Math.PI / 180));
  assert.ok(Math.abs(row.multiplier - m) / m < 0.045);
  near(row.shrink, 100 * s);
}

// Without an obstacle no marks are produced; doubling the offset doubles spacing and shrink.
const plain = calculate.benderOffset({ offset: 100, angle: '45' });
assert.equal(plain.secondMark, undefined);
assert.equal(plain.firstMark, undefined);
near(calculate.benderOffset({ offset: 200, angle: '45' }).spacing, 2 * plain.spacing);
near(calculate.benderOffset({ offset: 200, angle: '45' }).shrink, 2 * plain.shrink);

// Angles not in the table, and a first mark before the pipe start, are rejected.
assert.throws(() => calculate.benderOffset({ offset: 100, angle: '20' }), RangeError);
assert.throws(() => calculate.benderOffset({ offset: 100, angle: '90' }), RangeError);
assert.throws(() => calculate.benderOffset({ offset: 6 * inch, angle: '30', obstacle: 10 * inch }), RangeError);
near(calculate.benderOffset({ offset: 6 * inch, angle: '30', obstacle: 10.5 * inch }).firstMark, 0);

// Manual p. 8 Offset Table, maximum conduit size, transcribed cell by cell from the page image (2026-09-27).
const printed = {
  15: ['3/4', '1-1/2', '3-1/2', '4', '4', '4', '4', '4', '4', '4', '4'],
  30: [undefined, '3/4', '1', '1-1/2', '2', '2-1/2', '3-1/2', '4', '4', '4', '4'],
  45: [undefined, undefined, '1/2', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4'],
};
for (const [angle, row] of Object.entries(printed)) {
  row.forEach((size, i) => {
    const offsetIn = 2 * (i + 1);
    const at = calculate.benderOffset({ offset: offsetIn * inch, angle });
    assert.equal(at.maxConduit, size, `${angle}° ${offsetIn} in`);
    // Just below the next column still reads this column (conservative lower column).
    if (i < row.length - 1) assert.equal(calculate.benderOffset({ offset: (offsetIn + 1.99) * inch, angle }).maxConduit, size);
  });
}
assert.equal(calculate.benderOffset({ offset: 6 * inch, angle: '30' }).maxConduitColumn, 6);
assert.equal(calculate.benderOffset({ offset: 1.9 * inch, angle: '15' }).maxConduit, undefined); // below the first column
assert.equal(calculate.benderOffset({ offset: 3.9 * inch, angle: '30' }).maxConduit, undefined); // blank cell
assert.equal(calculate.benderOffset({ offset: 30 * inch, angle: '45' }).maxConduit, '4');       // beyond 22 in -> last column
assert.equal(calculate.benderOffset({ offset: 6 * inch, angle: '60' }).maxConduit, undefined);  // angle not in the table
assert.equal(calculate.benderOffset({ offset: 6 * inch, angle: '30', obstacle: 40 * inch }).maxConduit, '1');

console.log('#33 benderOffset checks passed.');
