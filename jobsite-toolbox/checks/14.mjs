import assert from 'node:assert/strict';
import '../plugin/jobsite-toolbox/calculations.js';
const { tileLayout } = globalThis.toolboxCalculate;

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const nearList = (actual, expected) => {
  assert.equal(actual.length, expected.length, `${actual} vs ${expected}`);
  actual.forEach((value, i) => near(value, expected[i]));
};
// Pieces + joints between pieces + edge gaps must rebuild the face exactly.
const assertSum = (pieces, gaps, joint, length) =>
  near(pieces.reduce((a, b) => a + b, 0) + (pieces.length - 1) * joint + gaps[0] + gaps[1], length);
const square = (length, tile, joint, mode) => tileLayout({ width: length, height: length, tileWidth: tile, tileHeight: tile, joint, mode });

// Spec: 600 face, 300 tile, 3 joint -> module 303.
assert.equal(square(600, 300, 3, 'edge').moduleX, 303);
const expected = {
  edge: { 3: [300, 297], 5: [300, 295] },
  'center-joint': { 3: [298.5, 298.5], 5: [297.5, 297.5] },
  'center-tile': { 3: [147, 300, 147], 5: [145, 300, 145] },
};
for (const [mode, byJoint] of Object.entries(expected)) {
  for (const joint of [3, 5]) {
    const r = square(600, 300, joint, mode);
    nearList(r.xs, byJoint[joint]);
    nearList(r.ys, byJoint[joint]);
    assertSum(r.xs, r.xGaps, joint, 600);
    if (mode !== 'edge') nearList(r.xs, [...r.xs].reverse()); // centre modes: same cut on both sides
  }
  // Changing the joint must move the grid.
  assert.notDeepEqual(square(600, 300, 3, mode).xs, square(600, 300, 5, mode).xs);
}

// Wider face so each side has several pieces: cut must sit at the outer edges on both sides.
nearList(square(1300, 300, 3, 'center-tile').xs, [194, 300, 300, 300, 194]);
nearList(square(1300, 300, 3, 'center-joint').xs, [42.5, 300, 300, 300, 300, 42.5]);

// Narrow leftover (<= joint) is an unfilled edge gap, never a zero/negative piece.
nearList(square(605, 300, 3, 'edge').xs, [300, 300]);
nearList(square(605, 300, 3, 'edge').xGaps, [0, 2]);
nearList(square(606, 300, 3, 'edge').xGaps, [0, 3]);
nearList(square(607, 300, 3, 'edge').xs, [300, 300, 1]);
nearList(square(603, 300, 3, 'edge').xs, [300, 300]);
nearList(square(304, 300, 3, 'center-tile').xs, [300]);
nearList(square(304, 300, 3, 'center-tile').xGaps, [2, 2]);
// Tile larger than the face.
nearList(square(200, 300, 3, 'edge').xs, [200]);
nearList(square(200, 300, 3, 'center-tile').xs, [200]);
nearList(square(200, 300, 3, 'center-joint').xs, [98.5, 98.5]);
assert.throws(() => square(3, 300, 3, 'center-joint'), RangeError);
// Zero joint allowed.
nearList(square(700, 300, 0, 'edge').xs, [300, 300, 100]);
// Sum invariant over a sweep, all modes, including non-integer sizes.
for (const mode of Object.keys(expected)) {
  for (let length = 50; length <= 2000; length += 7.3) {
    for (const joint of [0, 2, 3.5]) {
      const r = square(length, 297, joint, mode);
      assertSum(r.xs, r.xGaps, joint, length);
      assert.ok(r.xs.every(piece => piece > 0 && piece <= 297 + 1e-6));
      assert.ok(r.xGaps.every(gap => gap >= 0 && gap <= joint + 1e-6));
    }
  }
}

// 2D, edge: 1000 x 600 face, 300 x 300 tile, 3 joint.
// xs = [300, 300, 300, 91] (1003 = 3 x 303 + 94, cut 94 - 3); ys = [300, 297].
const edge2d = tileLayout({ width: 1000, height: 600, tileWidth: 300, tileHeight: 300, joint: 3, mode: 'edge' });
nearList(edge2d.xs, [300, 300, 300, 91]);
assert.equal(edge2d.fullTiles, 3);
assert.equal(edge2d.cutPieces, 5);
assert.equal(edge2d.totalPieces, 8);
assert.deepEqual(edge2d.cutList, [{ w: 300, h: 297, count: 3 }, { w: 91, h: 297, count: 1 }, { w: 91, h: 300, count: 1 }]);

// 2D, centre tile, non-square tile (600 along width, 300 along height), 2 joint, 1000 x 600 face.
// xs: side = (1000 - 600) / 2 = 200 -> cut 198; ys: side = 150 -> cut 148.
const centre2d = tileLayout({ width: 1000, height: 600, tileWidth: 600, tileHeight: 300, joint: 2, mode: 'center-tile' });
nearList(centre2d.xs, [198, 600, 198]);
nearList(centre2d.ys, [148, 300, 148]);
assert.equal(centre2d.fullTiles, 1);
assert.equal(centre2d.cutPieces, 8);
assert.deepEqual(centre2d.cutList, [{ w: 198, h: 148, count: 4 }, { w: 198, h: 300, count: 2 }, { w: 600, h: 148, count: 2 }]);

// Third-party measured case (TilePro, recorded in 研究/工具實測-磁磚排版小片比較.md): 650 wall, 600 tile, 3 joint.
const tilePro = mode => tileLayout({ width: 650, height: 600, tileWidth: 600, tileHeight: 600, joint: 3, mode }).xs;
nearList(tilePro('edge'), [600, 47]);
nearList(tilePro('center-tile'), [22, 600, 22]);
nearList(tilePro('center-joint'), [323.5, 323.5]);

// Above 100,000 pieces the layout is refused: 6 mm tiles on a 6 × 3 m wall would be 500,000 pieces.
assert.throws(() => tileLayout({ width: 6000, height: 3000, tileWidth: 6, tileHeight: 6, joint: 0, mode: 'edge' }), RangeError);
// A real mosaic (25 mm on 6 × 3 m, 28,800 pieces) still lays out.
assert.equal(tileLayout({ width: 6000, height: 3000, tileWidth: 25, tileHeight: 25, joint: 0, mode: 'edge' }).totalPieces, 28800);

console.log('All tileLayout checks passed.');
