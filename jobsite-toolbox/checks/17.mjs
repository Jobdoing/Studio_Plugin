// Run: node check.mjs — asserts the membrane roll calc against the Schluter shower estimator case.
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calc = globalThis.toolboxCalculate;
const example = globalThis.toolboxExamples.membrane;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

// Schluter case by hand in ft²: 64 ft² wall × 1.05 overlap / 75 ft² roll = 0.896 -> 1 roll.
const r = calc.membrane(example.values);
close(r.rawRolls, 64 * 1.05 / 75);
close(r.rawRolls, example.expect.rawRolls);
close(r.areaWithAllowance, example.expect.areaWithAllowance);
assert.equal(r.rolls, example.expect.rolls);
assert.equal(r.product, example.values.product);
assert.equal(r.source, example.values.source);

// 0% allowance is allowed and adds nothing.
close(calc.membrane({ ...example.values, allowance: 0 }).areaWithAllowance, example.values.area);
// Proportionality: double the area -> double raw rolls; 2 × 0.896 = 1.792 -> 2 rolls.
const d = calc.membrane({ ...example.values, area: 2 * example.values.area });
close(d.rawRolls, 2 * r.rawRolls);
assert.equal(d.rolls, 2);
// Exact multiple must not add a roll (float noise), one step above must.
assert.equal(calc.membrane({ area: 0.3 * 3, coverage: 0.3, allowance: 0 }).rolls, 3);
assert.equal(calc.membrane({ area: 31, coverage: 30, allowance: 0 }).rolls, 2);
assert.equal(calc.membrane({ area: 30, coverage: 30, allowance: 0 }).rolls, 1);

console.log('membrane check passed');
