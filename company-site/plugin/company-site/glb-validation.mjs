import { glbDocumentIssue } from './glb-rules.mjs';

export function validateGlb(buffer) {
  if (buffer.byteLength < 20) throw new Error('INVALID_GLB');
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const binaryOffset = 20 + jsonLength;
  const binaryLength = binaryOffset + 8 <= buffer.byteLength ? view.getUint32(binaryOffset, true) : 0;
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a
    || jsonLength === 0 || binaryOffset + 8 + binaryLength !== buffer.byteLength
    || view.getUint32(binaryOffset + 4, true) !== 0x004e4942) throw new Error('INVALID_GLB');
  if (jsonLength % 4 || binaryLength % 4) throw new Error('INVALID_GLB');
  const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, 20, jsonLength)).trim());
  const issue = glbDocumentIssue(json, binaryLength);
  if (issue) throw new Error(issue.startsWith('INVALID_GLB') ? 'INVALID_GLB' : issue);
  if (json.asset?.version !== '2.0') throw new Error('INVALID_GLB');
}
