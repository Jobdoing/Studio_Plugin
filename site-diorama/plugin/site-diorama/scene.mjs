import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createSite(host, labels, onSelect) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-11, 11, 8, -8, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = .65;
  controls.maxPolarAngle = 1.18;
  controls.target.set(0, 2, 0);
  scene.add(new THREE.HemisphereLight(0xdceaff, 0x6e665b, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d9, 3);
  sun.position.set(-9, 18, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
  sun.shadow.bias = -.0005;
  scene.add(sun);
  // NOTE(ceiling): the procedural model is an illustrative site, not a photoreal scanned asset or BIM. A commissioned GLB with authored materials is the path to matching an architectural render exactly.
  const materials = Object.fromEntries(Object.entries({ concrete: 0xbfc0bc, dark: 0x34424c, white: 0xe9e7df, steel: 0x727a7d, yellow: 0xe9ad31, blue: 0x3973a1, red: 0xf16a47, teal: 0x44a69b, ground: 0xaaa99b, road: 0x68767e, leaf: 0x567a56, leafLight: 0x789262, wood: 0xa47f50, rust: 0x8f7155, glass: 0x507887 }).map(([key, color]) => [key, new THREE.MeshStandardMaterial({ color, roughness: .82 })]));
  materials.steel.metalness = .65; materials.steel.roughness = .46;
  materials.glass.metalness = .25; materials.glass.roughness = .25;
  const textures = [];
  for (const key of ['concrete', 'ground', 'road', 'wood']) {
    const surface = document.createElement('canvas'); surface.width = surface.height = 128;
    const context = surface.getContext('2d'), pixels = context.createImageData(128, 128);
    let seed = 271;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const tone = 210 + (seed >>> 24) % 45;
      pixels.data.set([tone, tone, tone, 255], i);
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(surface); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture); materials[key].map = texture; materials[key].bumpMap = texture; materials[key].bumpScale = .035;
  }
  const geometries = [];
  function mesh(geometry, material, x, y, z, parent = scene) {
    geometries.push(geometry);
    const object = new THREE.Mesh(geometry, materials[material]);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(w, h, d, material, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent); }
  function cylinder(rt, rb, h, material, x, y, z, parent) { return mesh(new THREE.CylinderGeometry(rt, rb, h, 12), material, x, y, z, parent); }
  function beam(a, b, size, material, parent = scene) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const object = box(size, from.distanceTo(to), size, material, 0, 0, 0, parent);
    object.position.copy(from.clone().add(to).multiplyScalar(.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  }
  box(18, .3, 14, 'ground', 0, -.23, 0);
  box(18, .035, 2.8, 'road', 0, -.055, 5);
  for (let x = -7; x < 8; x += 2) box(.9, .04, .05, 'white', x, -.02, 5);
  for (let level = 0; level < 5; level++) {
    const y = .15 + level * 1.42;
    box(6.8, .18, 4.7, 'concrete', -.3, y, -1.4);
    for (const x of [-3.25, -.3, 2.65]) for (const z of [-3.45, -1.4, .65]) {
      box(.3, 1.25, .3, 'concrete', x, y + .73, z);
      if (level < 4) box(.23, .23, 4.3, 'concrete', x, y - .16, -1.4);
    }
    if (level < 3) {
      for (const x of [-1.8, 1.2]) {
        box(2.5, .46, .16, 'concrete', x, y + .32, .65);
        box(2.5, .22, .16, 'concrete', x, y + 1.25, .65);
        box(.13, .78, .17, 'concrete', x, y + .83, .65);
      }
      box(.16, 1.2, 1.1, 'concrete', 2.65, y + .76, -2.5);
      box(.16, 1.2, 1.1, 'concrete', 2.65, y + .76, -.3);
      box(2.1, 1.23, .16, 'concrete', -.3, y + .75, -3.45);
    }
    for (const z of [-3.8, 1]) for (const railY of [.38, .72]) beam([-3.7, y + railY, z], [3.1, y + railY, z], .045, 'yellow');
    for (const x of [-3.7, -2, -.3, 1.4, 3.1]) for (const z of [-3.8, 1]) box(.045, .8, .045, 'yellow', x, y + .42, z);
    for (const x of [-3.7, 3.1]) for (const railY of [.38, .72]) beam([x, y + railY, -3.8], [x, y + railY, 1], .045, 'yellow');
  }
  for (const x of [-3.25, -.3, 2.65]) for (const z of [-3.45, -1.4, .65]) {
    for (const dx of [-.12, .12]) for (const dz of [-.12, .12]) cylinder(.013, .013, 1, 'rust', x + dx, 6.7, z + dz);
    for (const y of [6.35, 6.65, 6.95]) { beam([x - .14, y, z - .14], [x + .14, y, z - .14], .012, 'steel'); beam([x - .14, y, z + .14], [x + .14, y, z + .14], .012, 'steel'); }
  }
  for (const x of [3.35, 4]) for (let z = -3.7; z <= 1.05; z += .95) box(.04, 6.5, .04, 'steel', x, 3.25, z);
  for (let y = .6; y < 6.5; y += .95) {
    box(.85, .07, 4.8, 'wood', 3.65, y, -1.3);
    for (let z = -3.7; z < .8; z += .95) { beam([4, y, z], [4, y + .95, z + .95], .035, 'steel'); beam([4, y + .95, z], [4, y, z + .95], .035, 'steel'); }
  }
  materials.net = new THREE.MeshStandardMaterial({ color: 0x4386b2, transparent: true, opacity: .23, roughness: .9, side: THREE.DoubleSide, depthWrite: false });
  mesh(new THREE.PlaneGeometry(4.9, 6.4), 'net', 4.05, 3.3, -1.3).rotation.y = Math.PI / 2;
  for (let z = -3.7; z <= 1; z += .24) box(.012, 6.4, .012, 'blue', 4.06, 3.3, z);
  for (let y = .15; y < 6.5; y += .24) box(.012, .012, 4.9, 'blue', 4.06, y, -1.3);
  for (let y = .25; y < 6; y += .22) beam([-2.2, y, -2.6], [-2.2, y, -1.65], .03, 'wood');
  box(3.5, 1.6, 2.1, 'white', -5.9, .8, 1.7);
  box(3.7, .12, 2.3, 'blue', -5.9, 1.67, 1.7);
  for (const x of [-7, -5.8]) { box(.8, .75, .045, 'steel', x, .98, 2.77); box(.68, .63, .05, 'glass', x, .98, 2.8); box(.025, .65, .04, 'white', x, .98, 2.84); }
  box(.6, 1.2, .06, 'dark', -4.8, .6, 2.78);
  for (let x = -7.6; x < -4.2; x += .14) box(.015, 1.5, .02, 'steel', x, .8, 2.765);
  for (let x = -7.6; x < -4.2; x += .2) box(.025, .025, 2.1, 'white', x, 1.74, 1.7);
  box(1.3, .28, .65, 'white', -6, 1.9, 1.5);
  box(1.1, .18, .5, 'steel', -6, 2.02, 1.5);
  for (let x = -8; x <= 8; x += 2) {
    box(1.95, .85, .12, x % 4 === 0 ? 'blue' : 'white', x, .45, -6.5);
    box(.07, 1.1, .07, 'steel', x, .55, -6.5);
  }
  for (let z = -5; z <= 1; z += 2) box(.12, .85, 1.95, 'white', 8.5, .45, z);
  for (const x of [-7.8, -6.3, -4.8, 4.3, 5.8, 7.3]) {
    box(1.48, 1.05, .08, 'white', x, .54, 6.4);
    box(.045, 1.2, .045, 'steel', x - .75, .59, 6.4);
    box(1.48, .08, .09, 'blue', x, 1.09, 6.4);
  }
  for (const x of [-3.6, 3.45]) { box(.23, 1.65, .23, 'concrete', x, .8, 6.4); box(.28, .07, .28, 'blue', x, 1.67, 6.4); }
  for (let x = -3; x < 3; x += 1.2) {
    cylinder(.025, .025, .06, 'yellow', x, -.015, 5.85);
    box(.3, .045, .3, 'yellow', x, .06, 6.6);
    cylinder(.035, .14, .38, 'red', x, .26, 6.6);
    cylinder(.055, .08, .07, 'white', x, .3, 6.6);
  }
  for (let i = 0; i < 4; i++) {
    const x = 4.9 + i % 2 * 1.7, z = 1 + Math.floor(i / 2) * 1.65;
    for (const dz of [-.45, 0, .45]) box(1.4, .12, .17, 'wood', x, .1, z + dz);
    for (let j = 0; j < 4; j++) for (const dz of [-.38, 0, .38]) box(1.25, .17, .32, 'concrete', x, .28 + j * .2, z + dz);
    for (const dx of [-.4, .4]) box(.035, 1, 1.35, 'steel', x + dx, .5, z);
  }
  for (let j = 0; j < 7; j++) for (let k = 0; k < 2; k++) { const pipe = cylinder(.045, .045, 2.9, 'steel', 5.6, .12 + k * .1, -5.4 + j * .11); pipe.rotation.z = Math.PI / 2; }
  for (let i = 0; i < 6; i++) box(1.6, .09, .27, 'wood', -4.8, .12 + i * .1, -4.6);
  for (const x of [-5.2, -4.6]) { cylinder(.22, .22, .65, 'blue', x, .32, -.5); cylinder(.23, .23, .025, 'steel', x, .65, -.5); }
  for (const [x, z] of [[-8, -4], [-8, 4], [8, -5]]) {
    cylinder(.12, .17, 1.5, 'dark', x, .7, z);
    for (let i = 0; i < 9; i++) { const angle = i * 2.4; mesh(new THREE.SphereGeometry(.4 + i % 3 * .1, 12, 10), i % 2 ? 'leaf' : 'leafLight', x + Math.cos(angle) * .42, 1.6 + i % 3 * .4, z + Math.sin(angle) * .42); }
  }
  function worker(x, y, z) {
    cylinder(.13, .15, .33, 'yellow', x, y + .43, z);
    mesh(new THREE.SphereGeometry(.1, 12, 8), 'wood', x, y + .7, z);
    cylinder(.14, .14, .08, 'yellow', x, y + .79, z);
    for (const dx of [-.065, .065]) { box(.07, .22, .09, 'dark', x + dx, y + .16, z); box(.08, .05, .15, 'dark', x + dx, y + .035, z + .025); }
    for (const dx of [-.19, .19]) box(.065, .3, .08, 'blue', x + dx, y + .42, z);
    box(.26, .025, .015, 'white', x, y + .46, z + .14);
  }
  worker(-1.2, 5.93, -.4); worker(1.3, 4.52, .4); worker(-2, 0, 2.5); worker(4.4, 0, 4); worker(-6.9, 0, 3.2); worker(.5, 1.72, -.3);
  const truck = new THREE.Group(); scene.add(truck); truck.position.set(-2, .2, 5);
  box(2.2, .32, .95, 'dark', 0, .2, 0, truck);
  box(.8, .9, .95, 'blue', 1, .72, 0, truck);
  box(.04, .38, .75, 'glass', 1.42, .84, 0, truck);
  for (const z of [-.49, .49]) { box(.55, .38, .04, 'glass', .95, .88, z, truck); box(.12, .05, .12, 'steel', 1.2, .58, z, truck); box(.16, .1, .14, 'white', 1.42, .5, z * .65, truck); }
  box(.18, .12, .08, 'dark', 1.46, .29, 0, truck);
  box(.12, .055, .36, 'steel', .9, .25, -.65, truck);
  const drum = cylinder(.5, .45, 1.5, 'white', -.35, .95, 0, truck); drum.rotation.z = Math.PI / 2;
  for (const x of [-.8, -.1]) { const stripe = cylinder(.505, .505, .1, 'blue', x, .95, 0, truck); stripe.rotation.z = Math.PI / 2; }
  beam([-1.4, .8, 0], [-1.65, .45, 0], .13, 'steel', truck);
  for (const x of [-.85, .85]) for (const z of [-.52, .52]) { const wheel = cylinder(.25, .25, .16, 'dark', x, .12, z, truck); wheel.rotation.x = Math.PI / 2; }
  const towerX = 4.2, towerZ = -4.2;
  box(1.3, .3, 1.3, 'concrete', towerX, .1, towerZ);
  for (const dx of [-.28, .28]) for (const dz of [-.28, .28]) box(.07, 8.2, .07, 'yellow', towerX + dx, 4.1, towerZ + dz);
  for (let y = .3; y < 8; y += .65) {
    beam([towerX - .28, y, towerZ + .28], [towerX + .28, y + .65, towerZ + .28], .05, 'yellow');
    beam([towerX + .28, y, towerZ - .28], [towerX + .28, y + .65, towerZ + .28], .05, 'yellow');
    beam([towerX - .28, y, towerZ - .28], [towerX + .28, y + .65, towerZ - .28], .045, 'yellow');
    beam([towerX - .28, y, towerZ - .28], [towerX - .28, y + .65, towerZ + .28], .045, 'yellow');
    box(.65, .05, .65, 'yellow', towerX, y, towerZ);
  }
  box(9, .22, .5, 'yellow', 1.5, 8.3, towerZ);
  for (let x = -3; x < 6; x += .55) beam([x, 8.4, towerZ], [x + .5, 8.95, towerZ], .055, 'yellow');
  beam([-3, 8.95, towerZ], [6, 8.95, towerZ], .065, 'yellow');
  for (const z of [towerZ - .27, towerZ + .27]) {
    beam([-3, 8.4, z], [6, 8.4, z], .055, 'yellow');
    for (let x = -3; x < 6; x += .55) beam([x, 8.4, z], [x + .55, 8.95, towerZ], .04, 'yellow');
  }
  beam([towerX, 8.9, towerZ], [towerX, 9.9, towerZ], .08, 'yellow');
  beam([towerX, 9.9, towerZ], [-3, 8.95, towerZ], .018, 'dark');
  beam([towerX, 9.9, towerZ], [6, 8.95, towerZ], .018, 'dark');
  box(.9, .7, .65, 'blue', 4, 7.9, towerZ + .6);
  box(1, .45, .7, 'dark', 5.7, 8.6, towerZ);
  const hook = new THREE.Group(); hook.position.set(-2.8, 8.2, towerZ); scene.add(hook);
  box(.04, 2.1, .04, 'dark', 0, -1.05, 0, hook);
  box(.28, .3, .28, 'yellow', 0, -2.15, 0, hook);
  mesh(new THREE.TorusGeometry(.12, .028, 8, 12, Math.PI * 1.3), 'steel', 0, -2.4, 0, hook);
  for (let i = 0; i < 5; i++) box(1, .04, .04, 'steel', 0, -2.6 - i * .07, 0, hook);
  const markers = {}, anchors = {};
  for (const [module, x, z, material] of [['corrective', .8, 3.4, 'red'], ['diary', -5.9, 1.7, 'blue'], ['inspection', 6, 2.7, 'teal']]) {
    const group = new THREE.Group(); group.position.set(x, module === 'diary' ? 1.8 : 0, z); scene.add(group);
    const ring = mesh(new THREE.TorusGeometry(.5, .025, 8, 32), material, 0, .08, 0, group); ring.rotation.x = Math.PI / 2;
    if (module === 'corrective') {
      box(.65, .08, .65, 'red', 0, .15, 0, group);
      cylinder(.06, .24, .65, 'red', 0, .48, 0, group);
      cylinder(.12, .16, .15, 'white', 0, .51, 0, group);
    } else {
      box(.65, .85, .12, material, 0, .6, 0, group);
      const page = box(.5, .65, .045, 'white', 0, .6, .09, group);
      for (let y = .4; y <= .75; y += .12) box(.32, .025, .01, material, 0, y, .12, group);
      markers[module] = { group, ring, page };
    }
    markers[module] ??= { group, ring };
    anchors[module] = new THREE.Vector3(x, group.position.y + 1.4, z);
  }
  const values = { corrective: 0, diary: 0, inspection: 0 };
  let enabled = false, active = true, raf = 0, last = 0, elapsed = 0, disposed = false;
  function placeLabels() {
    const placed = [], rect = host.getBoundingClientRect();
    for (const module of Object.keys(labels)) {
      const point = anchors[module].clone().project(camera);
      const label = labels[module];
      label.style.setProperty('--marker-x', `${Math.max(12, Math.min(88, (point.x + 1) * 50))}%`);
      label.style.setProperty('--marker-y', `${Math.max(10, Math.min(82, (1 - point.y) * 50))}%`);
      if (!matchMedia('(max-width: 40rem)').matches) {
        for (let pass = 0; pass < placed.length; pass++) {
          const bounds = label.getBoundingClientRect();
          const collision = placed.find(other => bounds.left < other.right + 8 && bounds.right + 8 > other.left && bounds.top < other.bottom + 8 && bounds.bottom + 8 > other.top);
          if (!collision) break;
          label.style.setProperty('--marker-y', `${Math.max(bounds.height + 8, collision.top - rect.top - 8)}px`);
        }
      }
      placed.push(label.getBoundingClientRect());
    }
  }
  function render() {
    renderer.render(scene, camera);
  }
  function tick(now) {
    raf = 0;
    if (disposed || !enabled || !active) return;
    if (now - last >= 1000 / 30) {
      elapsed += Math.min((now - last) / 1000, .05); last = now;
      hook.rotation.z = Math.sin(elapsed * .7) * .06;
      for (const [module, marker] of Object.entries(markers)) {
        marker.ring.scale.setScalar(values[module] > 0 ? 1 + Math.sin(elapsed * 2) * .12 : 1);
        if (marker.page) marker.page.rotation.y = values[module] > 0 ? Math.sin(elapsed) * .14 : 0;
      }
      render();
    }
    raf = requestAnimationFrame(tick);
  }
  function motion() {
    cancelAnimationFrame(raf); raf = 0; last = performance.now();
    if (enabled && active && !disposed) raf = requestAnimationFrame(tick);
    else if (!disposed) render();
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1), extent = Math.max(8.5, 12 / aspect);
    camera.left = -extent * aspect; camera.right = extent * aspect; camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix(); placeLabels(); render();
  }
  function reset() { camera.position.set(16, 14, 19); camera.zoom = 1; controls.update(); render(); }
  const ray = new THREE.Raycaster();
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = ray.intersectObjects(Object.values(markers).map(m => m.group), true)[0];
    if (hit) for (const [module, marker] of Object.entries(markers)) if (marker.group === hit.object.parent) onSelect(module);
  });
  controls.addEventListener('change', () => { placeLabels(); render(); });
  const observer = new ResizeObserver(resize); observer.observe(host);
  reset(); resize();
  return {
    reset,
    rotate(angle) { camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target); controls.update(); render(); },
    setValues(next) { for (const module of Object.keys(values)) values[module] = next[module]?.value ?? 0; placeLabels(); render(); },
    setMotion(value) { enabled = value; motion(); },
    setActive(value) { active = value; motion(); },
    select(module) { for (const [key, marker] of Object.entries(markers)) marker.ring.material = materials[key === module ? 'yellow' : key === 'corrective' ? 'red' : key === 'diary' ? 'blue' : 'teal']; render(); },
    dispose() { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); controls.dispose(); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); Object.values(materials).forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); }
  };
}
