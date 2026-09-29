import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const calculate = globalThis.toolboxCalculate;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

// 300×300 tile, 10 mm depth, 3 mm joint: 600/90000 × 10 × 3 = 0.2 L/m².
const base = { area: 10, tileLength: 300, tileWidth: 300, depth: 10, joint: 3, density: 1.6, allowance: 0, bagWeight: 5 };
const a = calculate.grout(base);
near(a.litresPerSquareMetre, 0.2);
near(a.volume, 2);
near(a.mass, 3.2);
near(a.massWithAllowance, 3.2);
near(a.rawBags, 0.64);
assert.equal(a.bags, 1);

// Non-square tile: 100×600, depth 9, joint 5 → 700/60000 × 45 = 0.525 L/m².
near(calculate.grout({ ...base, tileLength: 100, tileWidth: 600, depth: 9, joint: 5 }).litresPerSquareMetre, 0.525);

// Doubling the area doubles every un-rounded amount.
const b = calculate.grout({ ...base, area: 20 });
near(b.volume, 2 * a.volume);
near(b.mass, 2 * a.mass);
near(b.rawBags, 2 * a.rawBags);

// Allowance: 10% on 3.2 kg → 3.52 kg; 3.52 / 5 = 0.704 bag → 1.
const c = calculate.grout({ ...base, allowance: 10 });
near(c.massWithAllowance, 3.52);
near(c.rawBags, 0.704);

// Bag ceiling: 100 m² → 32 kg; 32 / 5 = 6.4 → 7; exactly 10 bags stays 10.
assert.equal(calculate.grout({ ...base, area: 100 }).bags, 7);
assert.equal(calculate.grout({ ...base, area: 100, bagWeight: 3.2 }).bags, 10); // exactly 10.0, must not become 11
assert.equal(calculate.grout({ ...base, area: 100, bagWeight: 3.2, allowance: 1 }).bags, 11);

// MAPEI selection chart consumption table (kg/m², one decimal) reproduced with K as density.
for (const [A, B, C, D, K, table] of [
  [300, 300, 10, 3, 1.6, 0.3], [300, 300, 20, 3, 1.6, 0.6], [100, 600, 9, 5, 1.6, 0.8],
  [100, 100, 9, 2, 1.5, 0.5], [600, 600, 10, 5, 1.4, 0.2], [600, 600, 10, 5, 1.6, 0.3],
]) {
  const perSquareMetre = calculate.grout({ ...base, area: 1, tileLength: A, tileWidth: B, depth: C, joint: D, density: K }).mass;
  assert.equal(Math.round(perSquareMetre * 10) / 10, table, `${A}x${B}x${C} joint ${D} K ${K}`);
}

console.log('All grout checks passed.');
