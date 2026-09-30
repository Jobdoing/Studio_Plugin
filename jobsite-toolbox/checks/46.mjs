import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { staking } = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-6) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);

// Formula-only (no manufacturer report): difference = measured - design; positive = cut, negative = fill.
const high = staking({ design: 12.5, measured: 12.735 });
near(high.difference, 235);
near(high.cut, 235);
assert.equal(high.fill, undefined);
// Swapping the two elevations keeps the size and flips cut to fill.
const low = staking({ design: 12.735, measured: 12.5 });
near(low.difference, -235);
near(low.fill, 235);
assert.equal(low.cut, undefined);
// Negative elevations below a site datum work the same way.
near(staking({ design: -3.2, measured: -3.25 }).fill, 50);
near(staking({ design: -0.1, measured: 0.05 }).cut, 150);
// Equal elevations are on grade: no cut, no fill.
const level = staking({ design: 7.125, measured: 7.125 });
assert.equal(level.onGrade, 0);
assert.equal(level.cut, undefined);
assert.equal(level.fill, undefined);
const example = globalThis.toolboxExamples.staking;
near(staking(example.values).cut, example.expect.cut);

console.log('#46 staking checks passed.');
