// Run: node check.mjs — asserts the pedestal point count against Schluter TROBA-LEVEL estimator runs.
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calc = globalThis.toolboxCalculate;
const example = globalThis.toolboxExamples.pedestals;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const inch = 25.4;
const paver = 23.62 * inch; // 599.948 mm
const run = (Lin, Win, perPack) => calc.pedestals({ length: Lin * inch / 1000, width: Win * inch / 1000, paverLength: paver, paverWidth: paver, perPack });

// Source case (research file): 120 × 120 in -> 36 pavers (16 full + 20 cut) = 6 × 6, 49 support points.
const r = calc.pedestals(example.values);
assert.equal(r.points, example.expect.points);
assert.equal(r.alongLength, example.expect.alongLength);
assert.equal(r.alongWidth, example.expect.alongWidth);
close(r.lastLength, 3048 - 5 * 599.948); // 48.26 mm
close(r.lastLength, example.expect.lastLength);

// Extra estimator runs on 2026-09-26 (same defaults): 100 × 100 in -> 25 pavers, 36 points;
// 93.48 × 93.48 in (just under 4 pavers) -> 16 pavers, 25 points.
assert.equal(run(100, 100).points, 36);
assert.equal(run(93.48, 93.48).points, 25);
// Known difference: 94.5 × 47 in leaves a 0.5 mm sliver along the length; the estimator dropped it
// (8 pavers, 15 points) while this rule counts the extra row (5 × 2 pavers, 18 points).
assert.equal(run(94.5, 47).points, 18);
close(run(94.5, 47).lastLength, 94.5 * inch - 4 * paver); // 0.508 mm

// Grid properties: swapping both axes keeps the count; exact multiples do not add a row;
// a paver larger than the area still needs its 4 corners.
assert.equal(calc.pedestals({ length: 2, width: 3, paverLength: 500, paverWidth: 600 }).points,
  calc.pedestals({ length: 3, width: 2, paverLength: 600, paverWidth: 500 }).points);
assert.equal(calc.pedestals({ length: 1.8, width: 1.2, paverLength: 600, paverWidth: 600 }).points, 4 * 3);
assert.equal(calc.pedestals({ length: 0.3, width: 0.3, paverLength: 600, paverWidth: 600 }).points, 4);
// Rectangular pavers: 3 × 1.2 m with 1200 × 300 mm pavers -> 3 × 4 pieces, 4 × 5 = 20 points.
assert.equal(calc.pedestals({ length: 3, width: 1.2, paverLength: 1200, paverWidth: 300 }).points, 20);
// Growing the area never lowers the count.
assert.ok(run(121, 120).points >= run(120, 120).points);

// Independent recount: walk each axis laying pavers from one corner and collect every support line
// (edges plus paver joints), then multiply. Must agree with (m + 1)(n + 1) for any input.
const lines = (sideMm, paverMm) => {
  const at = [0];
  while (sideMm - at.at(-1) > 1e-6) at.push(Math.min(at.at(-1) + paverMm, sideMm));
  return at.length;
};
const recount = ({ length, width, paverLength, paverWidth }) => lines(length * 1000, paverLength) * lines(width * 1000, paverWidth);
for (const input of [example.values, { length: 1.8, width: 1.2, paverLength: 600, paverWidth: 600 },
  { length: 94.5 * inch / 1000, width: 47 * inch / 1000, paverLength: paver, paverWidth: paver }]) {
  assert.equal(calc.pedestals(input).points, recount(input));
}
assert.equal(recount({ length: 1.8, width: 1.2, paverLength: 600, paverWidth: 600 }), 12);
assert.equal(recount({ length: 94.5 * inch / 1000, width: 47 * inch / 1000, paverLength: paver, paverWidth: paver }), 18);
let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 2000; i++) {
  const input = { length: 0.1 + random() * 20, width: 0.1 + random() * 20, paverLength: 100 + random() * 900, paverWidth: 100 + random() * 900 };
  assert.equal(calc.pedestals(input).points, recount(input), JSON.stringify(input));
}

// Optional packs (user-entered pack size): exact division adds no pack; a remainder adds one; blank -> no field.
const grid = { length: 1.8, width: 1.2, paverLength: 600, paverWidth: 600 }; // 12 points
assert.equal(calc.pedestals({ ...grid, perPack: 4 }).packs, 3);
assert.equal(calc.pedestals({ ...grid, perPack: 5 }).packs, 3);
assert.equal(calc.pedestals({ ...grid, perPack: 12 }).packs, 1);
assert.equal(calc.pedestals({ ...grid, perPack: 7 }).packs, 2);
assert.equal(calc.pedestals(grid).packs, undefined);
assert.equal(calc.pedestals(example.values).packs, example.expect.packs);
// TROBA-LEVEL rerun 2026-09-27: the estimator's pack counts match this tool at 6 per pack (inferred from the
// numbers, not printed). 94.5 × 47 in is left out: 18 vs the estimator's 15 points only coincide at 3 packs.
assert.equal(run(120, 120, 6).packs, 9);
assert.equal(run(100, 100, 6).packs, 6);
assert.equal(run(93.48, 93.48, 6).packs, 5);
assert.equal(run(95, 47).points, 18); // rerun probe: estimator also 18 points
assert.equal(run(95, 47, 6).packs, 3);

console.log('pedestals check passed');
