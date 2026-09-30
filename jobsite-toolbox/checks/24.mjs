import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { ceilingGrid } = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-6) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const inch = 25.4;

// USG ceiling guide (WL1004 p. 1) room example, 12.5 × 18.5 ft, 12 × 12 in tongue-and-groove tiles (layout arithmetic only):
// centre line on a grid line -> 12 × 18 full, 3 in borders; centre of a panel on the centre -> 11 × 17, 9 in borders.
const room = { length: 12.5 * 12 * inch / 1000, width: 18.5 * 12 * inch / 1000, moduleLength: 12 * inch, moduleWidth: 12 * inch };
const onLine = ceilingGrid({ ...room, mode: 'center-joint' });
assert.equal(onLine.fullAlongLength, 12);
assert.equal(onLine.fullAlongWidth, 18);
near(onLine.borderLength, 3 * inch);
near(onLine.borderWidth, 3 * inch);
const onPanel = ceilingGrid({ ...room, mode: 'center-tile' });
assert.equal(onPanel.fullAlongLength, 11);
assert.equal(onPanel.fullAlongWidth, 17);
near(onPanel.borderLength, 9 * inch);
near(onPanel.borderWidth, 9 * inch);
// Panel counts follow the grid: (full + 2 borders) per axis.
assert.equal(onLine.fullPanels, 12 * 18);
assert.equal(onLine.fullPanels + onLine.cutPanels, 14 * 20);
// Exact division leaves no border; 600 × 1200 modules use each axis's own module.
const exact = ceilingGrid({ length: 2.4, width: 4.8, moduleLength: 600, moduleWidth: 1200, mode: 'center-joint' });
assert.deepEqual([exact.fullAlongLength, exact.borderLength, exact.fullAlongWidth, exact.borderWidth], [4, 0, 4, 0]);
// An odd module count cannot centre on a grid line: 3.6 m of 1200 mm gives 2 full + 600 mm borders.
const oddCount = ceilingGrid({ length: 2.4, width: 3.6, moduleLength: 600, moduleWidth: 1200, mode: 'center-joint' });
assert.equal(oddCount.fullAlongWidth, 2);
near(oddCount.borderWidth, 600);
// Borders are the same on both ends and never exceed one module.
const odd = ceilingGrid({ length: 4.1, width: 3.3, moduleLength: 600, moduleWidth: 600, mode: 'center-tile' });
near(odd.fullAlongLength * 600 + 2 * odd.borderLength, 4100);
assert.ok(odd.borderLength < 600 && odd.borderWidth < 600);
// A room narrower than one module, centre of a panel on the centre: one 500 mm cut piece, not two 500 mm borders.
const tiny = ceilingGrid({ length: 0.5, width: 0.5, moduleLength: 600, moduleWidth: 600, mode: 'center-tile' });
assert.equal(tiny.singleLength, 500);
assert.equal(tiny.borderLength, undefined);
assert.equal(tiny.cutPanels, 1);
// The same room centred on a grid line is two 250 mm pieces, reported as borders.
const tinyLine = ceilingGrid({ length: 0.5, width: 0.5, moduleLength: 600, moduleWidth: 600, mode: 'center-joint' });
near(tinyLine.borderLength, 250);
assert.equal(tinyLine.singleLength, undefined);
// Exactly one module wide is one full panel with no border.
const one = ceilingGrid({ length: 0.6, width: 0.6, moduleLength: 600, moduleWidth: 600, mode: 'center-tile' });
assert.deepEqual([one.fullAlongLength, one.borderLength, one.singleLength], [1, 0, undefined]);
// Grids above 100,000 pieces are refused (a half-typed module such as 6 mm in a 50 m room).
assert.throws(() => ceilingGrid({ length: 50, width: 50, moduleLength: 6, moduleWidth: 6, mode: 'center-joint' }), RangeError);
const example = globalThis.toolboxExamples.ceilingGrid;
near(ceilingGrid(example.values).borderLength, example.expect.borderLength);

console.log('#24 ceilingGrid checks passed.');
