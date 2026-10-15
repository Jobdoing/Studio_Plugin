const UNSUPPORTED_EXTENSIONS = new Set([
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_meshopt_compression',
  'KHR_texture_basisu',
]);

function hasUri(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasUri);
  return typeof value.uri === 'string' || Object.values(value).some(hasUri);
}

export function glbDocumentIssue(document, binaryLength) {
  if (hasUri(document)) return 'EXTERNAL_GLB_RESOURCE';

  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    const extensions = document?.[key];
    if (extensions !== undefined && !Array.isArray(extensions)) return 'INVALID_GLB_EXTENSIONS';
    if (extensions?.some(extension => UNSUPPORTED_EXTENSIONS.has(extension))) return 'UNSUPPORTED_GLB_EXTENSION';
  }

  const buffers = document?.buffers;
  const byteLength = buffers?.[0]?.byteLength;
  if (!Array.isArray(buffers) || buffers.length !== 1 || !Number.isInteger(byteLength)
    || byteLength < 0 || byteLength > binaryLength) return 'INVALID_GLB_BUFFER';
  return null;
}
