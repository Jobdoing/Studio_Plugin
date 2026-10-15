export function bindBlenderObjectNames(gltf) {
  const nodes = gltf.parser.json.nodes || [];
  gltf.scene.traverse(object => {
    const index = gltf.parser.associations.get(object)?.nodes;
    const name = nodes[index]?.name;
    if (typeof name === 'string') object.userData.blenderObjectName = name;
  });
}

export function annotationForMesh(mesh, root, annotations) {
  for (let object = mesh; object; object = object === root ? null : object.parent) {
    const name = object.userData.blenderObjectName;
    if (name && Object.hasOwn(annotations, name)) {
      const entry = annotations[name];
      return { name, title: entry?.title, description: entry?.description };
    }
  }
  return null;
}
