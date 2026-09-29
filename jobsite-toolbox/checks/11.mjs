import assert from 'node:assert/strict';

import '../plugin/jobsite-toolbox/calculations.js';
import '../plugin/jobsite-toolbox/examples.js';
const { rebarDevelopment: r } = globalThis.toolboxCalculate;
const near = (actual, expected, tol = 1e-6) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
// Taiwan 建築物混凝土結構設計規範 (112) ch. 25, kgf units. Formula-checked; no public Taiwan example with Ktr.
const base = { barSize: 'D22', fc: 280, fy: '4200', lambda: 'normal', topBar: 'no', coating: 'none', ktr: 0, confined: 'no', hookRestraint: 'no', hookPosition: 'no', oldCover: 'no', oldTies: 'no' };
const at = (ratio, extra = {}) => r({ ...base, cover: ratio * 2.22, ...extra });

// Commentary examples (fc' 280, fy 4200, D22+): 28db at (cb+Ktr)/db = 2.5, 72db at 1.0, and the simplified
// table's 47db (coefficient 5.3 ≈ 3.5 × 1.5). The printed values are rounded, so ±0.5 db; exact values too.
near(at(2.5).tensionInDiameters, 28.685487);
assert.ok(Math.abs(at(2.5).tensionInDiameters - 28) <= 0.7); // printed 28db is truncated
assert.ok(Math.abs(at(1).tensionInDiameters - 72) <= 0.5);
near(at(1).tensionInDiameters, 71.713717);
assert.ok(Math.abs(at(1.5).tensionInDiameters - 47) <= 0.85); // table uses 5.3, general form gives 47.81
// (cb+Ktr)/db is capped at 2.5, and Ktr adds to cb.
near(at(4).tension, at(2.5).tension);
near(r({ ...base, cover: 2.22, ktr: 2.22 }).tension, at(2).tension);
// ψs 0.8 for D19 and smaller; ψt·ψe capped at 1.7 (1.3 × 1.5 = 1.95 -> 1.7).
near(r({ ...base, barSize: 'D19', cover: 1.91 }).tension, 0.8 * 4200 / (3.5 * Math.sqrt(280)) * 1.91); // ψs 0.8
near(at(1, { topBar: 'yes', coating: 'epoxyThin' }).tension, 1.7 * at(1).tension);
near(at(1, { topBar: 'yes', coating: 'epoxy' }).tension, 1.3 * 1.2 * at(1).tension);
// √fc' capped at 26.5: 800 kgf/cm² gives the same length as 702.25.
near(at(1, { fc: 800 }).tension, at(1, { fc: 26.5 ** 2 }).tension);
// Lightweight λ 0.75 lengthens by 1/0.75.
near(at(1, { lambda: 'light' }).tension, at(1).tension / 0.75);
// 30 cm minimum on ℓd; laps use the value before that minimum, then their own 30 cm minimum.
const small = r({ ...base, barSize: 'D10', cover: 5 }); // raw ℓd ≈ 21.9 cm
assert.equal(small.tension, 30);
assert.equal(small.lapA, 30);
const raw = 4200 / (3.5 * Math.sqrt(280)) * 0.8 / 2.5 * 0.953;
near(small.lapB, Math.max(1.3 * raw, 30));
// D10 at fy 5000: raw ℓd ≈ 26.0 cm, class A 1.08 × 26.0 = 28.1 -> 30 cm, not 1.08 × 30 = 32.4 cm.
assert.equal(r({ ...base, barSize: 'D10', cover: 5, fy: '5000' }).lapA, 30);
// ψg only on laps: fy 5000 -> class B = 1.3 × 1.08 × ℓd (ℓd itself has no ψg).
const g5000 = at(1, { fy: '5000' });
near(g5000.tension, at(1).tension * 5000 / 4200);
near(g5000.lapB, 1.3 * 1.08 * g5000.tension);
near(at(1, { fy: '5600', spacing: 20 }).lapA, 1.15 * at(1, { fy: '5600', spacing: 20 }).tension);
assert.throws(() => at(1, { fy: '4900' }), RangeError);

// Compression ℓdc (2019 exam D22, fy 4200, fc' 280): first term 0.075 × 2.22 × 4200 / √280 = 41.8 cm
// (the exam then applied an excess-steel ratio this tool does not use); 112 edition second term 0.0044 -> 41.03.
near(at(1).compression, 0.075 * 2.22 * 4200 / Math.sqrt(280));
near(0.0044 * 2.22 * 4200, 41.0256);
// Above fc' ≈ 291 the 0.0044 fy db term governs (fc' 350: 37.4 vs 41.03 cm).
near(at(1, { fc: 350 }).compression, 0.0044 * 4200 * 2.22);
near(at(1, { confined: 'yes' }).compression, Math.max(0.75 * 0.075 * 2.22 * 4200 / Math.sqrt(280), 0.75 * 0.0044 * 2.22 * 4200, 20));
assert.equal(r({ ...base, barSize: 'D10', cover: 5 }).compression, 20);
// Compression laps: fy ≤ 4200 0.0073 fy db; 4200 < fy ≤ 5600 (0.013 fy − 24) db; fc' < 210 adds 1/3; fy 7000 not computed.
near(at(1).compressionLap, 0.0073 * 4200 * 2.22);
near(at(1, { fy: '5600', spacing: 20 }).compressionLap, (0.013 * 5600 - 24) * 2.22);
near(at(1, { fc: 180 }).compressionLap, 0.0073 * 4200 * 2.22 * 4 / 3);
assert.equal(at(1, { fy: '7000', spacing: 20 }).compressionLap, undefined);

// 25.4.2.2 (fy ≥ 5600): blank spacing stops; spacing < 15 cm needs Ktr ≥ 0.5db; exactly 15 cm does not trigger.
// 10.7.1.3: column longitudinal bars at fy ≥ 5600 need Ktr ≥ 0.5db at any spacing. fy 4200/5000 are unaffected.
assert.throws(() => at(1, { fy: '5600' }), RangeError);
assert.throws(() => at(1, { fy: '5600', spacing: 12, ktr: 0 }), RangeError);
assert.throws(() => at(1, { fy: '7000', spacing: 14.9, ktr: 1.1 }), RangeError); // 0.5db = 1.11 cm
assert.ok(at(1, { fy: '5600', spacing: 12, ktr: 1.11 }).tension > 0);
assert.ok(at(1, { fy: '5600', spacing: 15, ktr: 0 }).tension > 0);
assert.throws(() => at(1, { fy: '5600', spacing: 20, ktr: 0, member: 'column' }), RangeError);
assert.ok(at(1, { fy: '5600', spacing: 20, ktr: 1.11, member: 'column' }).tension > 0);
assert.ok(at(1, { fy: '5000' }).tension > 0);
assert.ok(at(1, { member: 'column' }).tension > 0);

// Standard hooks 25.4.3.1 (new form): D25 (db 2.54 cm), fc' 280, fy 4200, ψe ψr ψo 1, ψc = 280/1050 + 0.6.
const d25 = { ...base, barSize: 'D25', cover: 5.08 };
const psiC280 = 280 / 1050 + 0.6;
const hookBase = 4200 * psiC280 / (23 * Math.sqrt(280)) * 2.54 ** 1.5;
near(r({ ...d25, hookRestraint: 'yes', hookPosition: 'yes' }).hook, hookBase); // ≈ 38.29 cm
near(hookBase, 38.29, 0.01);
// Same coefficient 23 in the SI bracket with MPa and mm gives the same length (unit-consistency check).
near(hookBase * 10, 420 * (28 / 105 + 0.6) / (23 * Math.sqrt(28)) * 25.4 ** 1.5, 0.5);
// ψr 1.6 and ψo 1.25 when not satisfied, and always for bars above D36; ψe 1.2 for any epoxy; ψc 1.0 at 420+.
near(r(d25).hook, hookBase * 1.6 * 1.25);
near(r({ ...d25, barSize: 'D39', hookRestraint: 'yes', hookPosition: 'yes' }).hook, 4200 * psiC280 / (23 * Math.sqrt(280)) * 3.94 ** 1.5 * 1.6 * 1.25);
near(r({ ...d25, hookRestraint: 'yes', hookPosition: 'yes', coating: 'epoxyThin' }).hook, hookBase * 1.2);
near(r({ ...d25, hookRestraint: 'yes', hookPosition: 'yes', fc: 450 }).hook, 4200 / (23 * Math.sqrt(450)) * 2.54 ** 1.5);
near(r({ ...d25, hookRestraint: 'yes', hookPosition: 'yes', lambda: 'light' }).hook, hookBase / 0.75);
// Minimums 8db and 15 cm: a D10 gives about 8.8 cm by formula -> 15 cm.
assert.equal(r({ ...base, barSize: 'D10', cover: 5, hookRestraint: 'yes', hookPosition: 'yes' }).hook, 15);

// Retained older hook form 25.4.3.5–8: 0.075 fy ψe / √fc' · db = 47.8 cm for D25 at 280.
const oldBase = 0.075 * 4200 / Math.sqrt(280) * 2.54;
near(r(d25).oldHook, oldBase);
near(r({ ...d25, lambda: 'light' }).oldHook, oldBase * 1.3); // ×1.3, not λ 0.75
near(r({ ...d25, oldCover: 'yes', oldTies: 'yes' }).oldHook, oldBase * 0.7 * 0.8);
near(r({ ...d25, coating: 'epoxy' }).oldHook, oldBase * 1.2);
// Applicability by size and fc' (25.4.3.5): D36 ≤ 350, D32 ≤ 420, D29 ≤ 490, D25 and smaller ≤ 700; D39+ never.
for (const [barSize, limit] of [['D36', 350], ['D32', 420], ['D29', 490], ['D25', 700], ['D19', 700]]) {
  assert.notEqual(r({ ...d25, barSize, fc: limit }).oldHook, undefined, `${barSize} at ${limit}`);
  assert.equal(r({ ...d25, barSize, fc: limit + 1 }).oldHook, undefined, `${barSize} above ${limit}`);
}
assert.equal(r({ ...d25, barSize: 'D39' }).oldHook, undefined);
// Old form still has the 8db / 15 cm minimum after reductions.
assert.equal(r({ ...base, barSize: 'D10', cover: 5, fc: 700, oldCover: 'yes', oldTies: 'yes' }).oldHook, 15);

// 25.5.1.1: bars larger than D36 may not be lap spliced -> no lap outputs for D39+; D36 itself still laps.
const big = r({ ...d25, barSize: 'D39' });
assert.equal(big.lapA, undefined);
assert.equal(big.lapB, undefined);
assert.equal(big.compressionLap, undefined);
assert.ok(big.tension > 0);
assert.ok(r({ ...d25, barSize: 'D36' }).lapB > 0 && r({ ...d25, barSize: 'D36' }).compressionLap > 0);
// db comes from the CNS 560 table (Tung Ho catalog, A2006): spot values and an unknown size.
for (const [size, db] of [['D10', 9.53], ['D19', 19.1], ['D29', 28.7], ['D36', 35.8], ['D39', 39.4], ['D57', 57.3]]) assert.equal(r({ ...base, barSize: size }).diameter, db);
assert.throws(() => r({ ...base, barSize: 'D20' }), RangeError);

// ACI 318-19 cross-check only (Simpson: #5, 3000 psi, ψs 0.8, ratio 2.5 -> 16.43 in = 41.7 cm); unit systems differ.
const aci = r({ ...base, barSize: 'D16', fc: 3000 * 0.0703069578, cover: 2.5 * 1.59 }); // D16 15.9 mm ≈ #5 15.875 mm
assert.ok(Math.abs(aci.tension - 16.43 * 2.54) / (16.43 * 2.54) < 0.03);
const example = globalThis.toolboxExamples.rebarDevelopment;
near(r(example.values).tension, example.expect.tension);

console.log('#11 rebarDevelopment checks passed.');
