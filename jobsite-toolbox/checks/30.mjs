// Runnable check for #30 voltageDrop: node check.mjs
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { voltageDrop } = globalThis.toolboxCalculate;
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// Source case (Southwire p.6-13) done by hand in imperial units: VN = 250 × (0.063e-3 × 0.8 + 0.037e-3 × 0.6) × 750.
const handVN = 250 * (0.063e-3 * 0.8 + 0.037e-3 * 0.6) * 750;
assert.equal(handVN.toFixed(1), '13.6'); // the manual prints 13.6 V
const ft = 0.3048;
const base = { system: 'three', voltage: 440, current: 250, length: 750 * ft, resistance: 0.063e-3 / ft * 1000, reactance: 0.037e-3 / ft * 1000, powerFactor: 0.8, source: 's' };
const sw = voltageDrop(base);
near(sw.neutralDrop, handVN);
near(sw.drop, Math.sqrt(3) * handVN);
near(sw.loadVoltage, 440 - Math.sqrt(3) * handVN);
near(sw.regulation, 100 * Math.sqrt(3) * handVN / (440 - Math.sqrt(3) * handVN));
assert.equal(sw.source, 's');
// The manual's 23.5 V / 5.64 % come from the rounded 13.6 V; the unrounded tool values sit within 0.1 V / 0.03 %.
assert.ok(Math.abs(sw.drop - 23.5) < 0.1 && Math.abs(sw.regulation - 5.64) < 0.03);

// Example entry must match its own expectations (values were worked out by hand above, not from calc output).
const example = globalThis.toolboxExamples.voltageDrop;
const fromExample = voltageDrop(example.values);
for (const [key, want] of Object.entries(example.expect)) near(fromExample[key], want, Math.abs(want) * 1e-6);

// Single phase two-wire uses 2 × per-conductor drop and has no neutral figure.
const single = voltageDrop({ ...base, system: 'single' });
near(single.drop, 2 * handVN);
assert.equal(single.neutralDrop, undefined);
// Proportionality: drop scales with current and with length; unity pf ignores X.
near(voltageDrop({ ...base, current: 500 }).neutralDrop, 2 * sw.neutralDrop);
near(voltageDrop({ ...base, length: 2 * base.length }).drop, 2 * sw.drop);
near(voltageDrop({ ...base, powerFactor: 1, reactance: 99 }).neutralDrop, 250 * base.resistance * base.length / 1000);
// Zero reactance is allowed; drop then comes from R × pf only.
near(voltageDrop({ ...base, reactance: 0 }).neutralDrop, 250 * base.resistance * 0.8 * base.length / 1000);

// Invalid combinations.
assert.throws(() => voltageDrop({ ...base, powerFactor: 1.2 }), RangeError);
assert.throws(() => voltageDrop({ ...base, voltage: 20 }), RangeError);

// Spec case 3: an independent nominal voltage adds a separately named percentage; absent -> no field.
const withNominal = voltageDrop({ ...base, nominalVoltage: 440 });
near(withNominal.dropOfNominal, 23.5775416 / 440 * 100, 1e-5);
near(withNominal.regulation, 5.6619284, 1e-6);
assert.equal(voltageDrop(base).dropOfNominal, undefined);
// The drop-of-nominal percentage uses En, never Es: a different En changes only that percentage.
near(voltageDrop({ ...base, nominalVoltage: 480 }).dropOfNominal, withNominal.drop / 480 * 100);
near(voltageDrop({ ...base, nominalVoltage: 480 }).regulation, withNominal.regulation);
// Optional user-entered limit (% of En): plain ratio to the drop-of-nominal; needs En; blank -> no field.
near(voltageDrop({ ...base, nominalVoltage: 440, dropLimit: 5 }).limitUsage, 5.35853219 / 5 * 100, 1e-5);
near(voltageDrop({ ...base, nominalVoltage: 480, dropLimit: 3 }).limitUsage, withNominal.drop / 480 * 100 / 3 * 100);
assert.throws(() => voltageDrop({ ...base, dropLimit: 5 }), RangeError);
assert.equal(withNominal.limitUsage, undefined);

console.log('#30 voltageDrop checks passed.');
