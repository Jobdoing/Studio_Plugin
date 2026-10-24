const fixture = await (await fetch('/preview-fixture.json')).json();
const project = { project_handle: 'preview-project', project_key: 'preview-project', name: fixture.preview.project };
window.__studioMock.setProject(project);
window.__studioMock.showConflictOverlay(true);
window.__studioMock.ai = request => {
  const input = JSON.parse(request.input);
  if (input.targets) return { json: { segments: input.targets.map(({ id, text }) => ({ id, text })) } };
  const summary = structuredClone(fixture.summary);
  summary.issues[0].evidence = [{ id: input[0].id, quote: input[0].text }];
  return { json: summary };
};
window.__studioMock.backend = (path, init) => {
  if (path === 'jobs') return Response.json({ id: 'preview-job' });
  if (init?.method === 'DELETE') return Response.json({ removed: true });
  if (path.includes('/chunk')) return Response.json({});
  if (path.endsWith('/start')) return Response.json({ status: 'transcribing' });
  return Response.json({ status: 'complete', result: fixture.raw });
};
await window.studio.records.create('meetings', { scope: 'project', project_handle: project.project_handle,
  schema: 'v1', body: { title: fixture.preview.title, source: { name: fixture.preview.source, size: 48044 },
    raw: fixture.raw, readable: fixture.raw.segments.map(({ id, text }) => ({ id, text })), summary: fixture.summary } });
const banner = document.createElement('p');
banner.className = 'kit-callout';
banner.dataset.status = 'warning';
banner.textContent = fixture.preview.banner;
document.querySelector('main').prepend(banner);
await import('/app.mjs');
document.querySelector('#saved-list button')?.click();
