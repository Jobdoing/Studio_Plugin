import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const { outrigger, adhesive, conduitFill } = globalThis.toolboxCalculate;

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// #50 spec case 1 (Liebherr): 113 t-force on a 9 m² mat -> about 123.13 kPa.
const liebherr = outrigger({ force: 113 * 9.80665, area: 9, source: 'Liebherr LTM 1230-5.1 case' });
near(liebherr.pressure, 123.1279, 1e-3);
assert.equal(liebherr.source, 'Liebherr LTM 1230-5.1 case');
// #50 case 2: doubling area halves pressure; doubling force doubles it.
near(outrigger({ force: 500, area: 4, source: 's' }).pressure, outrigger({ force: 500, area: 2, source: 's' }).pressure / 2);
near(outrigger({ force: 1000, area: 2, source: 's' }).pressure, 2 * outrigger({ force: 500, area: 2, source: 's' }).pressure);

// #15 spec case 1 (ARDEX UK X 77): 2 mm bed at 1.05 kg/m²/mm -> r 2.1; 10 m², 20 kg bag -> 21 kg, 1.05, 2 bags.
const x77 = adhesive({ area: 10, product: 'ARDEX X 77 (UK)', source: 'TDS 1.05 kg/m²/mm × 2 mm', rate: 2.1, bagWeight: 20, allowance: 0 });
near(x77.mass, 21);
near(x77.massWithAllowance, 21);
near(x77.rawBags, 1.05);
assert.equal(x77.bags, 2);
// #15 case 2: 1.6 kg/m², 10 m², 25 kg bags -> 16 kg, 0.64, 1 bag.
const other = adhesive({ area: 10, product: 'p', source: 's', rate: 1.6, bagWeight: 25, allowance: 0 });
near(other.mass, 16);
assert.equal(other.bags, 1);
// #15 case 3: doubling area doubles un-rounded values; an exact multiple stays 1 bag; allowance multiplies.
near(adhesive({ area: 20, product: 'p', source: 's', rate: 1.6, bagWeight: 25, allowance: 0 }).rawBags, 2 * other.rawBags);
assert.equal(adhesive({ area: 10, product: 'p', source: 's', rate: 2.5, bagWeight: 25, allowance: 0 }).bags, 1);
near(adhesive({ area: 10, product: 'p', source: 's', rate: 1.6, bagWeight: 25, allowance: 10 }).massWithAllowance, 17.6);

// #31 spec case 1 (Southwire): 2 in EMT bore 52.5018 mm, three 15.8496 mm THHN 4/0 -> 27.34069 %.
const emt = conduitFill({ diameter: 2.067 * 25.4, cableDiameter: [0.624 * 25.4], cableCount: [3], source: 'Southwire Re³' });
near(emt.fill, 27.34069);
assert.equal(emt.overfull, undefined);
// #31 case 2: count 1 -> 2 doubles fill; mixed diameters add areas, never an averaged diameter.
const one = conduitFill({ diameter: 50, cableDiameter: [10], cableCount: [1], source: 's' }).fill;
near(conduitFill({ diameter: 50, cableDiameter: [10], cableCount: [2], source: 's' }).fill, 2 * one);
const mixed = conduitFill({ diameter: 50, cableDiameter: [10, 20], cableCount: [1, 1], source: 's' });
near(mixed.fill, 100 * (10 ** 2 + 20 ** 2) / 50 ** 2);
assert.notEqual(mixed.fill.toFixed(6), (100 * 2 * 15 ** 2 / 50 ** 2).toFixed(6));
// #31 case 3: a cable as wide as the bore is an error; over 100 % is shown but flagged.
assert.throws(() => conduitFill({ diameter: 20, cableDiameter: [20], cableCount: [1], source: 's' }), RangeError);
assert.equal(conduitFill({ diameter: 20, cableDiameter: [15], cableCount: [3], source: 's' }).overfull, true);

console.log('All outrigger, adhesive and conduit checks passed.');
