import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const calculate = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-6) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);

// Source case: Southwire manual p. 7-27, segment 5 to 6. Expected values worked from the manual's
// imperial numbers, then converted (1 lbf = 4.4482216152605 N, 1 ft = 0.3048 m).
const lbf = 4.4482216152605, ft = 0.3048;
const manualLbPerFt = (3 * 1.25 - 2) * 5119 / (3 * 2.91); // 1,026.15; manual prints 1,026
near(manualLbPerFt, 1026.1454754, 1e-6);
const sp = calculate.sidewallPressure({ mode: 'cradled', tension: 5119 * lbf / 1000, radius: 2.91 * ft, weightFactor: 1.25, source: 'x' });
near(sp.pressure, 14.975467467, 1e-8);
near(sp.pressure * 1000 / (lbf / ft), manualLbPerFt, 1e-8);
assert.equal(sp.source, 'x');
// Other two bends in the same manual case: 187 and 457 lb/ft.
near(calculate.sidewallPressure({ mode: 'cradled', tension: 934 * lbf / 1000, radius: 2.91 * ft, weightFactor: 1.25 }).pressure * 1000 / (lbf / ft), 187.2279496, 1e-6);
near(calculate.sidewallPressure({ mode: 'cradled', tension: 2282 * lbf / 1000, radius: 2.91 * ft, weightFactor: 1.25 }).pressure * 1000 / (lbf / ft), 457.4455899, 1e-6);

// Proportional to T, inverse to R; w = 1 reduces to T / (3R).
const base = calculate.sidewallPressure({ mode: 'cradled', tension: 10, radius: 1, weightFactor: 1.2 }).pressure;
near(calculate.sidewallPressure({ mode: 'cradled', tension: 20, radius: 1, weightFactor: 1.2 }).pressure, 2 * base);
near(calculate.sidewallPressure({ mode: 'cradled', tension: 10, radius: 2, weightFactor: 1.2 }).pressure, base / 2);
near(calculate.sidewallPressure({ mode: 'cradled', tension: 9, radius: 1, weightFactor: 1 }).pressure, 3);

// w below 1 cannot come from eq. 7-18.
assert.throws(() => calculate.sidewallPressure({ mode: 'cradled', tension: 10, radius: 1, weightFactor: 0.6 }), RangeError);

// Formula-only modes (no manufacturer worked example; hand-worked from eq. 7-20, 7-22 and 7-17).
// Single cable: 1,000 lb out of a 2 ft bend -> 500 lb/ft; w is ignored.
const single = calculate.sidewallPressure({ mode: 'single', tension: 1000 * lbf / 1000, radius: 2 * ft, weightFactor: 0.2 });
near(single.pressure * 1000 / (lbf / ft), 500, 1e-9);
near(single.pressure, 7.296951469, 1e-8);
// Triangular: 2 in EMT (D 2.067 in) with an illustrative 0.9 in cable (D/d ≈ 2.30 < 2.5), eq. 7-17 w ≈ 1.570887;
// T 2,282 lb, R 2.91 ft -> w × T / (2R) ≈ 615.94 lb/ft.
const wTri = 1 / Math.sqrt(1 - (0.9 / (2.067 - 0.9)) ** 2);
near(wTri, 1.57088715, 1e-8);
const tri = calculate.sidewallPressure({ mode: 'triangular', tension: 2282 * lbf / 1000, radius: 2.91 * ft, weightFactor: wTri });
near(tri.pressure * 1000 / (lbf / ft), 615.9389133, 1e-6);
// Same w and T: triangular w/2 differs from cradled (3w - 2)/3, so the modes must not collapse.
assert.ok(Math.abs(tri.pressure - calculate.sidewallPressure({ mode: 'cradled', tension: 2282 * lbf / 1000, radius: 2.91 * ft, weightFactor: wTri }).pressure) > 0.1);
assert.throws(() => calculate.sidewallPressure({ mode: 'triangular', tension: 10, radius: 1, weightFactor: 0.9 }), RangeError);

console.log('#32 sidewallPressure checks passed.');
