// Runnable check for #34 pipePressureLoss: node check.mjs
import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { pipePressureLoss } = globalThis.toolboxCalculate;
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// Uponor manual, imperial, done independently: 60°F water ρ 62.36 lb/ft³, μ 7.54e-4 lbm/(ft·s) (App. A),
// PEX roughness 1.58e-6 ft and the Manadilli friction factor (ch. 4), 1 in ID 0.862 in (Table 1-2).
const rho = 62.36, mu = 7.54e-4, rough = 1.58e-6, gFt = 32.17404856, gpmPerCfs = 448.8311688;
const manadilli = (D, V) => {
  const Re = rho * V * D / mu;
  return (-2 * Math.log10(rough / (3.7 * D) + 95 / Re ** 0.983 - 96.82 / Re)) ** -2;
};
const handPsiPer100 = (idIn, gpm) => {
  const D = idIn / 12, V = gpm / gpmPerCfs / (Math.PI * D * D / 4);
  const f = manadilli(D, V);
  return { V, f, psi: f * (100 / D) * V ** 2 / (2 * gFt) * rho / 144 };
};
const ft = 0.3048, psiToKPa = 6.894757293, lbft3 = 16.01846337;
const toolPsiPer100 = (idIn, gpm, f) => pipePressureLoss({
  diameter: idIn * 25.4, flow: gpm * 3.785411784 / 60, length: 100 * ft, frictionFactor: f, density: rho * lbft3, source: 's',
});

// Table 5-8 (60°F, 10.028 psi/100 ft limit): 1 in carries 12.73 gpm at 7.00 ft/s.
const table58 = handPsiPer100(0.862, 12.73);
assert.equal(table58.V.toFixed(2), '7.00');
assert.equal(table58.f.toFixed(5), '0.02186');
const tool58 = toolPsiPer100(0.862, 12.73, table58.f);
near(tool58.velocity / ft, table58.V);
near(tool58.pressureLoss / psiToKPa, table58.psi);
assert.ok(Math.abs(tool58.pressureLoss / psiToKPa - 10.028) < 0.005, 'within gpm display precision of 10.028');
assert.equal(tool58.source, 's');

// Appendix B, 1 in AquaPEX, 60°F column: rows are keyed by velocity; [ft/s, gpm, psi/100 ft] to the table's 2 decimals.
const area1in = Math.PI * (0.862 / 12) ** 2 / 4;
for (const [V, gpm, psi] of [[1.6, 2.91, 0.75], [2.7, 4.91, 1.87], [4.4, 8.00, 4.41], [6.9, 12.55, 9.78], [8.0, 14.55, 12.72], [10.4, 18.92, 20.30]]) {
  const exactGpm = V * area1in * gpmPerCfs;
  assert.equal(exactGpm.toFixed(2), gpm.toFixed(2));
  const hand = handPsiPer100(0.862, exactGpm);
  const got = toolPsiPer100(0.862, exactGpm, hand.f);
  assert.ok(Math.abs(got.pressureLoss / psiToKPa - psi) <= 0.005, `${gpm} gpm: ${got.pressureLoss / psiToKPa} vs ${psi}`);
}

// Example entry must match its own expectations (worked out by hand, not from calc output).
const example = globalThis.toolboxExamples.pipePressureLoss;
const fromExample = pipePressureLoss(example.values);
for (const [key, want] of Object.entries(example.expect)) near(fromExample[key], want, Math.abs(want) * 1e-6);

// Metric textbook hand check: D 100 mm, Q 20 L/s, L 100 m, f 0.02, ρ 1000 -> V 2.546479 m/s, V² 6.48456, hf 20 × 6.48456 ÷ 19.6133 = 6.6124 m, 64.85 kPa.
const text = pipePressureLoss({ diameter: 100, flow: 20, length: 100, frictionFactor: 0.02, density: 1000, source: 's' });
near(text.velocity, 0.02 / (Math.PI * 0.05 ** 2));
near(text.headLoss, 0.02 * 1000 * (0.02 / (Math.PI * 0.05 ** 2)) ** 2 / (2 * 9.80665));
assert.equal(text.pressureLoss.toFixed(2), '64.85');
assert.equal(text.headLoss.toFixed(4), '6.6124');

// Proportionality: loss doubles with length and with f; same flow in half the diameter -> 4× velocity, 32× loss.
near(pipePressureLoss({ ...example.values, length: 2 * example.values.length }).headLoss, 2 * fromExample.headLoss);
near(pipePressureLoss({ ...example.values, frictionFactor: 2 * example.values.frictionFactor }).pressureLoss, 2 * fromExample.pressureLoss, 1e-9 * fromExample.pressureLoss + 1e-9);
const half = pipePressureLoss({ ...example.values, diameter: example.values.diameter / 2 });
near(half.velocity, 4 * fromExample.velocity);
near(half.headLoss, 32 * fromExample.headLoss, 1e-6 * half.headLoss);

// Computed-f mode (spec's next-version acceptance case): 1 in AquaPEX at 60°F in SI units.
const computedCase = { mode: 'computed', diameter: 21.8948, flow: 0.8031382, length: 30.48, roughness: 0.000481584, viscosity: 1.12208, density: 998.91, source: 's' };
const computedResult = pipePressureLoss(computedCase);
assert.equal(Math.round(computedResult.reynolds / 10) * 10, 41580, `Re ${computedResult.reynolds}`); // spec: Re ≈ 41,578
assert.equal(computedResult.frictionFactor.toFixed(5), '0.02186');
// Same Manadilli f as the independent imperial calculation above (unit path only differs).
near(computedResult.frictionFactor, table58.f, 1e-4 * table58.f);
near(computedResult.relativeRoughness, 0.000481584 / 21.8948);
assert.ok(Math.abs(computedResult.pressureLoss / psiToKPa - 10.028) < 0.01, `${computedResult.pressureLoss / psiToKPa} psi/100 ft`);
assert.match(computedResult.frictionMethod, /Manadilli/);
assert.equal(fromExample.reynolds, undefined, 'manual mode shows no Reynolds number');
// Outside the allowed range the tool refuses instead of extrapolating.
assert.throws(() => pipePressureLoss({ ...computedCase, flow: 0.08 }), RangeError); // Re ~ 4,158 < 5,235
assert.throws(() => pipePressureLoss({ ...computedCase, roughness: 1.2 }), RangeError); // e/D ~ 0.055 > 0.05

console.log('#34 pipePressureLoss checks passed.');
