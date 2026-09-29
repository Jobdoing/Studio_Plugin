import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { coverage } = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-9) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const ft2 = 0.09290304;

// USG DUROCK Multi-Use estimator (28 ft²): 3/8 in at 14 ft²/bag -> 2 bags; 3/4 in at 7 ft²/bag -> 4 bags.
// Both divide exactly, so the tolerant ceil must not add a bag.
assert.equal(coverage({ area: 28 * ft2, perBag: 14 * ft2 }).bags, 2);
assert.equal(coverage({ area: 28 * ft2, perBag: 7 * ft2 }).bags, 4);
// USG DUROCK Quick-Top estimator: 100 ft², 1/4 in at 22 ft²/bag -> 4.545 -> 5 bags.
near(coverage({ area: 100 * ft2, perBag: 22 * ft2 }).rawBags, 100 / 22);
assert.equal(coverage({ area: 100 * ft2, perBag: 22 * ft2 }).bags, 5);
// #26 formula case: 100 m² less 5 m² openings at 10 m²/bag -> 9.5 -> 10 bags.
const plaster = coverage({ area: 100, openings: 5, perBag: 10, source: 's' });
near(plaster.netArea, 95);
near(plaster.rawBags, 9.5);
assert.equal(plaster.bags, 10);
assert.equal(plaster.source, 's');
// #5 consistency: 0.71 ft³ per bag at a 1/2 in scratch coat ≈ 17 ft²; 34 ft² at 17 ft²/bag -> 2 bags.
near(0.71 / (0.5 / 12), 17.04, 1e-9);
assert.equal(coverage({ area: 34 * ft2, perBag: 17 * ft2 }).bags, 2);
// Float noise: 8.9304 / 2.9768 is 3.0000000000000004 and must stay 3 bags.
assert.equal(coverage({ area: 8.9304, perBag: 2.9768 }).bags, 3);
// Blank openings count as 0; openings reaching the total area are rejected.
assert.equal(coverage({ area: 10, openings: null, perBag: 3 }).netArea, 10);
assert.throws(() => coverage({ area: 10, openings: 10, perBag: 3 }), RangeError);
// The shared example matches the estimator case.
const example = globalThis.toolboxExamples.coverage;
assert.equal(coverage(example.values).bags, example.expect.bags);

console.log('#4/#5/#25/#26 coverage checks passed.');
