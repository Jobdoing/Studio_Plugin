import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { formworkPressure: p } = globalThis.toolboxCalculate;
const psf = 0.04788026, ft = 0.3048, pcf = 16.01846337, degC = F => (F - 32) / 1.8;
const within = (actual, expected, rel) => assert.ok(Math.abs(actual - expected) <= expected * rel, `${actual} vs ${expected}`);
const aci = { mode: 'aci', consolidation: 'standard', chemistry: '1.0' };

// ACI 347R-14, published inch-pound examples converted to SI (cross-check, not SI examples; coefficients
// differ by rounding, so 0.5%). A: StrataWay wall 10 ft, 150 pcf, 4 ft/h, 75°F -> 630 psf by formula (b).
const a = p({ ...aci, member: 'wall', height: 10 * ft, density: 2400, rate: 4 * ft, temperature: degC(75) });
within(a.pressure, 630 * psf, 0.005);
assert.equal(a.governs, '公式 4.2.2.1b(b)');
// B: Hurd 2002 column 18 ft, 12 ft/h, 50°F, 145 pcf, 30% fly ash (Cc 1.2): 2772 psf > wh 2610 -> liquid head.
const column = { ...aci, member: 'column', height: 18 * ft, density: 145 * pcf, rate: 12 * ft, chemistry: '1.2b' };
const b = p({ ...column, temperature: degC(50) });
within(b.pressure, 2610 * psf, 0.005);
assert.equal(b.governs, '液壓上限 ρgh');
// C: same column at 70°F -> 2032 psf by formula (b).
const c = p({ ...column, temperature: degC(70) });
within(c.pressure, 2032 * psf, 0.005);
assert.equal(c.governs, '公式 4.2.2.1b(b)');
assert.equal(c.cc, 1.2);
// Formula (c) arithmetic (Hurd example 1 base value 1060 psf at 60°F, 4 ft/h): tall wall below 2.1 m/h uses (c).
const tall = p({ ...aci, member: 'wall', height: 5, density: 2400, rate: 4 * ft, temperature: degC(60) });
assert.equal(tall.governs, '公式 4.2.2.1b(c)');
within(tall.pressure, 1060 * psf, 0.005);

// Selection table: walls 2.1–4.5 m/h use (c) at any height; above 4.5 m/h liquid head; columns ignore rate.
assert.equal(p({ ...aci, member: 'wall', height: 3, density: 2400, rate: 3, temperature: 20 }).governs, '公式 4.2.2.1b(c)');
assert.equal(p({ ...aci, member: 'wall', height: 3, density: 2400, rate: 5, temperature: 20 }).governs, '液壓 ρgh（此條件不適用公式）');
assert.equal(p({ ...aci, member: 'column', height: 8, density: 2400, rate: 5, temperature: 20 }).governs, '公式 4.2.2.1b(b)');
assert.equal(p({ ...aci, consolidation: 'liquid', member: 'column', height: 3, density: 2400, rate: 1, temperature: 20 }).pressure, 2400 * 9.81 * 3 / 1000);
// A slow warm pour falls to the 30Cw minimum; a shallow pour is still capped by liquid head.
const slow = p({ ...aci, member: 'column', height: 3, density: 2400, rate: 0.5, temperature: 30 });
assert.equal(slow.governs, '下限 30Cw');
assert.equal(slow.pressure, 30);
assert.equal(p({ ...aci, member: 'column', height: 1, density: 2400, rate: 0.5, temperature: 30 }).governs, '液壓上限 ρgh');
// Cw table: < 2240 -> 0.5(1 + ρ/2320) not below 0.80; 2240–2400 -> 1; > 2400 -> ρ/2320. Cc rows.
const cw = density => p({ ...aci, member: 'column', height: 10, density, rate: 1, temperature: 20 }).cw;
assert.equal(cw(1000), 0.8);
within(cw(2000), 0.5 * (1 + 2000 / 2320), 1e-12);
assert.equal(cw(2240), 1);
assert.equal(cw(2400), 1);
within(cw(2500), 2500 / 2320, 1e-12);
for (const [value, cc] of [['1.0', 1], ['1.2a', 1.2], ['1.2b', 1.2], ['1.4a', 1.4], ['1.4b', 1.4], ['1.5', 1.5]]) {
  assert.equal(p({ ...aci, chemistry: value, member: 'column', height: 10, density: 2400, rate: 1, temperature: 20 }).cc, cc);
}

// JSCE 2017 column (JCI 2019 paper): Wc 23, R 0.45, T 20 -> 16.3 kN/m²; cap 150 and (inferred) liquid head.
const jsce = p({ mode: 'jsce', unitWeight: 23, rate: 0.45, temperature: 20, height: 3 });
within(jsce.pressure, 16.3, 0.005);
assert.equal(jsce.governs, 'JSCE 柱公式');
assert.equal(p({ mode: 'jsce', unitWeight: 24, rate: 30, temperature: 5, height: 10 }).pressure, 150);
assert.equal(p({ mode: 'jsce', unitWeight: 24, rate: 5, temperature: 20, height: 1 }).pressure, 24);
// JASS 5 2022: full liquid head.
assert.equal(p({ mode: 'jass5', unitWeight: 24, height: 3 }).pressure, 72);
const example = globalThis.toolboxExamples.formworkPressure;
within(p(example.values).pressure, 630 * psf, 0.005);

console.log('#10 formworkPressure checks passed.');
