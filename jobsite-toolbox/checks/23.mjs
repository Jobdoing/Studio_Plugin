import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const { gypsum } = globalThis.toolboxCalculate;

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// Hand calc: 1220 x 2440 mm board = 2.9768 m2; 30 m2 / 2.9768 = 10.0779... -> 11 boards.
const wall = gypsum({ area: 30, boardLength: 2440, boardWidth: 1220 });
near(wall.boardArea, 2.9768);
near(wall.rawBoards, 30 / 2.9768);
assert.equal(wall.boards, 11);
// Optional outputs absent when rates are omitted.
assert.equal(wall.tape, undefined);
assert.equal(wall.rawScrews, undefined);
assert.equal(wall.screws, undefined);

// Hand calc: 910 x 1820 mm board = 1.6562 m2; 10 m2 / 1.6562 = 6.0379... -> 7 boards.
assert.equal(gypsum({ area: 10, boardLength: 1820, boardWidth: 910 }).boards, 7);

// USG J371 table ratio (test only, not a UI default): 100 ft2 -> 37 ft tape, 200 ft2 -> 74 ft.
const sqft = 0.3048 ** 2;
const usgTapeRate = 37 * 0.3048 / (100 * sqft); // m per m2, ~1.2139
near(usgTapeRate, 1.21391, 1e-5);
const board4x8 = { boardLength: 8 * 304.8, boardWidth: 4 * 304.8 };
near(gypsum({ area: 100 * sqft, ...board4x8, tapeRate: usgTapeRate }).tape / 0.3048, 37);
near(gypsum({ area: 200 * sqft, ...board4x8, tapeRate: usgTapeRate }).tape / 0.3048, 74);
// USG coverage table: 10 panels of 4x8 = 320 ft2.
assert.equal(gypsum({ area: 320 * sqft, ...board4x8 }).boards, 10);

// Hand calc screws: 30 m2 x 12.5 pcs/m2 = 375 pcs.
const screwed = gypsum({ area: 30, boardLength: 2440, boardWidth: 1220, screwRate: 12.5 });
near(screwed.rawScrews, 375);
assert.equal(screwed.screws, 375);
assert.equal(screwed.tape, undefined);
assert.equal(gypsum({ area: 7, boardLength: 2440, boardWidth: 1220, screwRate: 13 }).screws, 91);
assert.equal(gypsum({ area: 7.1, boardLength: 2440, boardWidth: 1220, screwRate: 13 }).screws, 93); // 92.3 -> 93

console.log('All gypsum checks passed.');
