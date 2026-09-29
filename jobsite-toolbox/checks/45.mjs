import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const calculate = globalThis.toolboxCalculate;

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const flat = value => `${value} ${value}\n${value} ${value}`;

// Spec example: one 10 m x 10 m cell, existing 102.0, design 101.5 -> cut 50, fill 0.
const one = calculate.cutFill({ spacingX: 10, spacingY: 10, existing: flat(102), design: flat(101.5) });
near(one.cut, 50);
near(one.fill, 0);
near(one.net, 50);
assert.equal(one.cells.length, 1);
assert.equal(one.maxCell, 0);

// Swapped surfaces -> cut and fill swap.
const swapped = calculate.cutFill({ spacingX: 10, spacingY: 10, existing: flat(101.5), design: flat(102) });
near(swapped.cut, 0);
near(swapped.fill, 50);
near(swapped.net, -50);

// Equal surfaces -> nothing.
const equal = calculate.cutFill({ spacingX: 10, spacingY: 10, existing: flat(102), design: flat(102) });
assert.equal(equal.cut, 0);
assert.equal(equal.fill, 0);

// Different X/Y spacing changes volume by cell area: 0.5 x 4 x 7.
near(calculate.cutFill({ spacingX: 4, spacingY: 7, existing: flat(102), design: flat(101.5) }).cut, 14);

// 3x3 points (2x2 cells), X=2, Y=3, cell area 6. Corner diffs (existing - design):
//  1  0  -1
//  2  0  -0.5
//  3  0  -2
// cell(0,0) avg 0.75 -> cut 4.5; cell(0,1) avg -0.375 -> fill 2.25;
// cell(1,0) avg 1.25 -> cut 7.5; cell(1,1) avg -0.625 -> fill 3.75.
const uneven = calculate.cutFill({
  spacingX: 2,
  spacingY: 3,
  existing: '101 100.5 100\n102, 100.5, 100.5\n103\t100.5\t99',
  design: '100 100.5 101\n100 100.5 101\n100 100.5 101',
});
assert.deepEqual(uneven.cells.map(cell => [cell.row, cell.col, cell.mixed]), [[0, 0, false], [0, 1, false], [1, 0, false], [1, 1, false]]);
[[0.75, 4.5, 0], [-0.375, 0, 2.25], [1.25, 7.5, 0], [-0.625, 0, 3.75]].forEach(([avg, cut, fill], index) => {
  near(uneven.cells[index].avgDiff, avg);
  near(uneven.cells[index].cut, cut);
  near(uneven.cells[index].fill, fill);
});
near(uneven.cut, 12);
near(uneven.fill, 6);
near(uneven.total, 18);
near(uneven.net, 6);
assert.equal(uneven.mixedCount, 0);
assert.equal(uneven.maxCell, 2);

// Mixed cell (corner diffs +1 and -1) is flagged, excluded from totals, and not chosen as max.
const mixed = calculate.cutFill({ spacingX: 1, spacingY: 2, existing: '1 1 1\n1 1 1', design: '0 0 2\n0 0 2' });
assert.equal(mixed.mixedCount, 1);
assert.equal(mixed.cells[1].mixed, true);
assert.equal(mixed.cells[1].cut, 0);
assert.equal(mixed.cells[1].fill, 0);
near(mixed.cut, 2);
near(mixed.fill, 0);
assert.equal(mixed.maxCell, 0);

// Negative and zero elevations are valid input.
near(calculate.cutFill({ spacingX: 1, spacingY: 1, existing: flat(-1), design: flat(0) }).fill, 1);

// Parse and shape errors.
const bad = (existing, design = existing) => assert.throws(
  () => calculate.cutFill({ spacingX: 1, spacingY: 1, existing, design }), RangeError);
bad('1 2\n3');
bad('1 2\n3 abc');
bad('1 2');
bad('1\n2');
bad('');
bad('1 2\n3 4', '1 2 3\n4 5 6');
bad('1 2\n3 4', '1 2\n3 4\n5 6');

// Row-end separators (CSV trailing comma, pasted leading comma) must not add a 0 column:
// with them, one 10 x 10 cell at +0.5 m is still exactly 50 m³ of cut.
for (const [ground, target] of [['102,102,\n102,102,', '101.5,101.5,\n101.5,101.5,'], [',102,102\n,102,102', ',101.5,101.5\n,101.5,101.5']]) {
  const edged = calculate.cutFill({ spacingX: 10, spacingY: 10, existing: ground, design: target });
  assert.equal(edged.cells.length, 1);
  near(edged.cut, 50);
}
// Spreadsheet paste (tabs) parses; a blank cell is an error, never a shifted row.
near(calculate.cutFill({ spacingX: 10, spacingY: 10, existing: '102\t102\n102\t102', design: flat(101.5) }).cut, 50);
bad('1,,2\n3,4,5');
bad('1\t\t2\n3\t4\t5');
bad('1,,2\n3,,4');

console.log('All cutFill checks passed.');
