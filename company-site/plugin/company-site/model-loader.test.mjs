import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectModelLoader } from './model-loader.mjs';

const project = { project_key: 'project-a', project_handle: 'handle-a' };
const documentRef = 'doc:11111111-1111-4111-8111-111111111111@3';

function makeLoader(overrides = {}) {
  const calls = { fetch: [], rendered: 0, cleared: 0, disposed: 0, status: '' };
  const loader = createProjectModelLoader({
    projectKey: 'project-a', documentRef,
    fetchDocument: async (...args) => { calls.fetch.push(args); return new Blob(['glb']); },
    parseDocument: async () => ({ model: true }),
    showModel: () => { calls.rendered++; },
    clearModel: () => { calls.cleared++; },
    disposeModel: () => { calls.disposed++; },
    setStatus: status => { calls.status = status; },
    ...overrides,
  });
  return { loader, calls };
}

test('empty config never reads Docs', async () => {
  const { loader, calls } = makeLoader({ projectKey: '', documentRef: '' });
  await loader.setProject(project);
  assert.equal(calls.fetch.length, 0);
  assert.match(calls.status, /config\.json/);
});

test('only the configured project reads the pinned document using project scope', async () => {
  const { loader, calls } = makeLoader();
  await loader.setProject({ ...project, project_key: 'project-b' });
  assert.equal(calls.fetch.length, 0);
  await loader.setProject(project);
  assert.deepEqual(calls.fetch, [[documentRef, {}, { project_handle: 'handle-a' }]]);
  assert.equal(calls.rendered, 1);
});

test('switching projects invalidates a pending read and clears the model', async () => {
  let finishFetch;
  const { loader, calls } = makeLoader({
    fetchDocument: () => new Promise(resolve => { finishFetch = resolve; }),
  });
  const pending = loader.setProject(project);
  await loader.setProject({ ...project, project_key: 'project-b' });
  finishFetch(new Blob(['glb']));
  await pending;
  assert.equal(calls.rendered, 0);
  assert.equal(calls.cleared, 2);
});

test('invalidate on pagehide prevents an in-flight model from returning after bfcache restore', async () => {
  let finishFetch;
  const { loader, calls } = makeLoader({
    fetchDocument: () => new Promise(resolve => { finishFetch = resolve; }),
  });
  const pending = loader.setProject(project);
  loader.invalidate();
  finishFetch(new Blob(['glb']));
  await pending;
  assert.equal(calls.rendered, 0);
  assert.equal(calls.disposed, 0);
  assert.equal(calls.cleared, 2);
});

test('document references must pin a positive version', async () => {
  for (const invalidRef of ['', 'doc:11111111-1111-4111-8111-111111111111', 'doc:11111111-1111-4111-8111-111111111111@0', 'doc:11111111-1111-4111-8111-111111111111@999999999999999999999']) {
    const { loader, calls } = makeLoader({ documentRef: invalidRef });
    await loader.setProject(project);
    assert.equal(calls.fetch.length, 0);
  }
});
