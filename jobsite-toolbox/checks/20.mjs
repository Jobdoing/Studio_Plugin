// Run: node check.mjs — asserts the trim-profile calc against the Schluter JOLLY estimator case.
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calc = globalThis.toolboxCalculate;
const example = globalThis.toolboxExamples.trimProfile;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// Schluter case: 12 ft = 3.6576 m over 2.5 m sticks -> 1.46304 raw, 2 sticks; 1 outside corner echoed.
const r = calc.trimProfile(example.values);
close(r.rawSticks, example.expect.rawSticks);
assert.equal(r.sticks, example.expect.sticks);
assert.equal(r.outsideCorners, 1);
assert.ok(!('insideCorners' in r), 'blank inside corners must not appear');

// Boundaries from the original spec: 2.4 m -> 1 stick, 2.501 m -> 2, exact 5.0 m -> 2 (no float extra stick).
assert.equal(calc.trimProfile({ length: 2.4, stickLength: 2.5 }).sticks, 1);
assert.equal(calc.trimProfile({ length: 2.501, stickLength: 2.5 }).sticks, 2);
assert.equal(calc.trimProfile({ length: 0.3 * 25, stickLength: 2.5 }).sticks, 3);
// Proportionality: double length -> double raw sticks; corners are echoed, never derived from length.
close(calc.trimProfile({ length: 7.3152, stickLength: 2.5 }).rawSticks, 2 * r.rawSticks);
assert.equal(calc.trimProfile({ length: 100, stickLength: 2.5, insideCorners: 3 }).insideCorners, 3);
assert.ok(!('outsideCorners' in calc.trimProfile({ length: 100, stickLength: 2.5 })));

console.log('trimProfile check passed');
