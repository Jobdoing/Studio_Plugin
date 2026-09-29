import assert from 'node:assert/strict';
import './plugin/jobsite-toolbox/calculations.js';
const calculate = globalThis.toolboxCalculate;

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

near(calculate.slab({ length: 1, width: 2, thickness: 100, yieldPerBag: .06 }).volume, .2);
assert.equal(calculate.slab({ length: 1, width: 2, thickness: 100, yieldPerBag: .06 }).bags, 4);
const feet = .3048;
const inches = .0254;
const cubicYards = .9144 ** 3;
near(calculate.slab({ length: 20 * feet, width: 30 * feet, thickness: 4 * inches * 1000, yieldPerBag: 1 }).volume / cubicYards, 200 / 27);
near(calculate.hole({ diameter: .3, depth: 1, count: 1 }).volume, Math.PI * .15 ** 2);
assert.equal(calculate.hole({ diameter: .3, depth: 1, count: 1 }).bags, undefined);
assert.equal(calculate.hole({ diameter: .3, depth: 1, count: 1, yieldPerBag: .05 }).bags, 2);
assert.equal(calculate.sealant({ length: 150, width: 10, depth: 10, capacity: 320, loss: 20 }).cartridges, 59);
near(calculate.aggregate({ length: 5, width: 1, thickness: 100 }).volume, .5);
assert.equal(calculate.aggregate({ length: 5, width: 1, thickness: 100 }).mass, undefined);
near(calculate.rebar({ unitWeight: 2, length: 2, count: 10 }).mass, 40);
near(calculate.plate({ length: 1, width: 1, thickness: 10, density: 7850, count: 2 }).mass, 157);
const tile = calculate.tile({ length: 2, width: 3, tileLength: 300, tileWidth: 300, perBox: 10 });
near(tile.rawTiles, 200 / 3);
assert.equal(tile.tiles, 67);
assert.equal(tile.boxes, 7);
near(calculate.slope({ mode: 'rise-run', rise: 4, run: 3 }).diagonal, 5);
near(calculate.slope({ mode: 'rise-grade', rise: 4, grade: 400 / 3 }).run, 3);
near(calculate.slope({ mode: 'run-grade', run: 3, grade: 400 / 3 }).rise, 4);
assert.equal(calculate.stair({ height: 3073.4, run: 4699, maxRise: 190.5 }).risers, 17);
assert.throws(() => calculate.stair({ height: 180, run: 1000, maxRise: 190 }), RangeError);
near(calculate.cylinder({ diameter: 2, height: 3 }).volume, 3 * Math.PI);
near(calculate.asphalt({ length: 10, width: 10, thickness: 50, density: 2400 }).tonnes, 12);

// Exact multiples must not buy one extra unit because of float noise (8.9304 / 2.9768 = 3.0000000000000004).
assert.equal(calculate.gypsum({ area: 8.9304, boardLength: 1220, boardWidth: 2440 }).boards, 3);
assert.equal(calculate.tile({ length: 1.22, width: 7.32, tileLength: 1220, tileWidth: 2440, perBox: 1 }).tiles, 3);

console.log('All 11 first-batch calculator checks passed.');

for (const tool of ['14', '16', '23', '43', '45', '50-15-31', '03', '17', '20', '22', '32', '33', '30', '34', '04-05-25-26', '46', '24', '10', '11', 'examples']) await import(`./checks/${tool}.mjs`);
