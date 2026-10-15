import assert from 'node:assert/strict';
import test from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { annotationForMesh, bindBlenderObjectNames } from './annotation-names.mjs';

test('matches original Blender node names, including a multi-primitive parent group', () => {
  const root = { userData: {}, parent: null, children: [], traverse(fn) { fn(this); this.children.forEach(child => { fn(child); child.children.forEach(fn); }); } };
  const group = { userData: {}, parent: root, children: [] };
  const mesh = { name: 'Cube001', userData: {}, parent: group, children: [] };
  root.children.push(group);
  group.children.push(mesh);
  const associations = new Map([[group, { nodes: 0 }]]);
  bindBlenderObjectNames({ scene: root, parser: { json: { nodes: [{ name: 'Cube.001' }] }, associations } });
  assert.deepEqual(annotationForMesh(mesh, root, { 'Cube.001': { title: 'Beam', description: 'Main beam' } }), {
    name: 'Cube.001', title: 'Beam', description: 'Main beam',
  });
  assert.equal(annotationForMesh(mesh, root, { Other: { title: 'Other' } }), null);
});

test('uses GLTFLoader node associations when Blender punctuation is sanitized', async () => {
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(makeGlb(), '', resolve, reject));
  bindBlenderObjectNames(gltf);
  let mesh;
  gltf.scene.traverse(object => { if (!mesh && object.isMesh) mesh = object; });
  assert.ok(mesh);
  assert.notEqual(mesh.name, 'Cube.001');
  assert.equal(annotationForMesh(mesh, gltf.scene, { 'Cube.001': { title: 'Original node' } })?.title, 'Original node');
});

function makeGlb() {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' }, buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }, { attributes: { POSITION: 0 } }] }],
    nodes: [{ name: 'Cube.001', mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  }));
  const length = Math.ceil(json.length / 4) * 4;
  const data = Buffer.alloc(28 + length + 36);
  data.writeUInt32LE(0x46546c67, 0); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(length, 12); data.writeUInt32LE(0x4e4f534a, 16);
  json.copy(data, 20); data.fill(0x20, 20 + json.length, 20 + length);
  data.writeUInt32LE(36, 20 + length); data.writeUInt32LE(0x004e4942, 24 + length);
  new Float32Array(data.buffer, data.byteOffset + 28 + length, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
