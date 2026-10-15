const DOC_REF = /^doc:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@[1-9][0-9]*$/iu;

export function createProjectModelLoader({ projectKey, documentRef, fetchDocument, parseDocument, showModel, clearModel, disposeModel, setStatus }) {
  let generation = 0;

  async function setProject(project) {
    const request = ++generation;
    clearModel();
    if (!projectKey || !DOC_REF.test(documentRef) || !Number.isSafeInteger(Number(documentRef.split('@')[1]))) {
      setStatus('Set projectKey and a version-pinned documentRef in config.json.');
      return;
    }
    if (!project?.project_handle) {
      setStatus('Select a project to view its model.');
      return;
    }
    if (project.project_key !== projectKey) {
      setStatus('Select the configured project to view this model.');
      return;
    }

    setStatus('Loading model…');
    try {
      const blob = await fetchDocument(documentRef, {}, { project_handle: project.project_handle });
      if (request !== generation) return;
      const model = await parseDocument(blob);
      if (request !== generation) {
        disposeModel(model);
        return;
      }
      showModel(model);
      setStatus('Model ready. Select a mesh to see its annotation.');
    } catch {
      if (request === generation) setStatus('Model could not be loaded. Check the document and try again.');
    }
  }

  function invalidate() {
    generation++;
    clearModel();
  }

  return { setProject, invalidate };
}
