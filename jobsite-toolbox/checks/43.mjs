import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const { roof } = globalThis.toolboxCalculate;

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const ft = 0.3048;
const inch = 0.0254;

// Spec case 1 (Construction Master Pro): 7/12 pitch, span 14 ft 4 in -> rafter 8 ft 3-9/16 in.
const pitch7 = roof({ span: 14 * ft + 4 * inch, grade: 700 / 12, ridgeLength: 1 });
near(pitch7.halfSpan, 2.1844);
near(pitch7.rise, 1.27423);
near(pitch7.rafter, 2.52889);
assert.ok(Math.abs(pitch7.rafter / inch - (8 * 12 + 3 + 9 / 16)) < 1 / 16, 'rafter within the manual 1/16 in display');
assert.equal(pitch7.boardEquivalent, undefined, 'no board sizes, no board output');

// Spec case 2: 10/12 pitch, 14 x 11 ft plan, 4 x 8 ft boards -> 200.4631 ft², 6.26447 boards (not rounded).
const pitch10 = roof({ span: 14 * ft, grade: 1000 / 12, ridgeLength: 11 * ft, boardLength: 8 * ft, boardWidth: 4 * ft });
near(pitch10.area, 18.62363);
near(pitch10.area / ft / ft, 200.4631, 1e-3);
near(pitch10.boardEquivalent, 6.26447);

// Spec case 3: steeper never shrinks; doubling the ridge doubles area and boards but not the rafter.
const base = { span: 8, grade: 30, ridgeLength: 10, boardLength: 2.4, boardWidth: 1.2 };
const steeper = roof({ ...base, grade: 45 });
const doubled = roof({ ...base, ridgeLength: 20 });
const flat = roof(base);
assert.ok(steeper.rafter > flat.rafter && steeper.area > flat.area);
near(doubled.area, 2 * flat.area);
near(doubled.boardEquivalent, 2 * flat.boardEquivalent);
near(doubled.rafter, flat.rafter);

// Spec case 4: only one board dimension is an input error, not a silent partial result.
assert.throws(() => roof({ ...base, boardWidth: undefined }), RangeError);
assert.throws(() => roof({ span: 8, grade: 30, ridgeLength: 10, boardLength: 2.4 }), RangeError);

console.log('All roof checks passed.');
