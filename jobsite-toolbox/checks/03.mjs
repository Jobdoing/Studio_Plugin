// Run: node check.mjs — asserts the mortar calc against the QUIKRETE Mason Mix Type S bag-label table.
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calc = globalThis.toolboxCalculate;
const example = globalThis.toolboxExamples.mortar;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

// Worked example (hand values: 100 / 36.585 = 2.73336 bags, 3 bags).
const r = calc.mortar(example.values);
close(r.rawBags, example.expect.rawBags);
assert.equal(r.bags, example.expect.bags);
assert.equal(r.source, example.values.source);

// Bag label, 3/8 in joint, 80 lb columns: every row is reproduced by one rate taken from the largest row.
const bricks80 = { 30: 1, 50: 2, 75: 3, 100: 3, 180: 5, 250: 7, 400: 11, 800: 22, 1500: 41 };
const blocks80 = { 10: 1, 15: 2, 25: 3, 30: 3, 50: 5, 100: 9, 125: 11, 500: 42, 1000: 84 };
for (const [units, bags] of Object.entries(bricks80)) assert.equal(calc.mortar({ units: +units, unitsPerBag: 1500 / 41 }).bags, bags, `bricks ${units}`);
for (const [units, bags] of Object.entries(blocks80)) assert.equal(calc.mortar({ units: +units, unitsPerBag: 1000 / 84 }).bags, bags, `blocks ${units}`);

// Proportionality: double the units -> double the raw bags; exact multiples do not round up an extra bag.
close(calc.mortar({ units: 200, unitsPerBag: 36.585 }).rawBags, 2 * r.rawBags);
assert.equal(calc.mortar({ units: 250, unitsPerBag: 1500 / 54 }).bags, 9); // 250 * 54 / 1500 = 9 exactly
assert.equal(calc.mortar({ units: 101, unitsPerBag: 25 }).bags, 5);

console.log('mortar check passed');
