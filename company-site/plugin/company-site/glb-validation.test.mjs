import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGlb } from './glb-validation.mjs';

function makeGlb(document) {
  const source = JSON.stringify(document);
  const json = Buffer.from(source.padEnd(Math.ceil(source.length / 4) * 4, ' '));
  const binary = Buffer.alloc(4);
  const buffer = Buffer.alloc(28 + json.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(json.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  buffer.writeUInt32LE(binary.length, 20 + json.length);
  buffer.writeUInt32LE(0x004e4942, 24 + json.length);
  binary.copy(buffer, 28 + json.length);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test('accepts an embedded GLB 2.0 and rejects external or decoder-dependent resources', () => {
  assert.doesNotThrow(() => validateGlb(makeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] })));
  assert.throws(() => validateGlb(makeGlb({ asset: { version: '2.0' }, buffers: [{ uri: 'model.bin' }] })), /EXTERNAL_GLB_RESOURCE/);
  assert.throws(() => validateGlb(makeGlb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] })), /UNSUPPORTED_GLB_EXTENSION/);
  assert.throws(() => validateGlb(makeGlb({ asset: { version: '2.0' }, extensionsUsed: ['KHR_draco_mesh_compression'] })), /UNSUPPORTED_GLB_EXTENSION/);
  assert.throws(() => validateGlb(makeGlb({ asset: { version: '2.0' }, extensionsUsed: ['KHR_meshopt_compression'] })), /UNSUPPORTED_GLB_EXTENSION/);
  assert.throws(() => validateGlb(makeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], extras: { uri: 'https://example.invalid/model.bin' } })), /EXTERNAL_GLB_RESOURCE/);
});

test('rejects a GLB without the required contained binary chunk', () => {
  const buffer = makeGlb({ asset: { version: '2.0' } }).slice(0, -12);
  new DataView(buffer).setUint32(8, buffer.byteLength, true);
  assert.throws(() => validateGlb(buffer), /INVALID_GLB/);
});
