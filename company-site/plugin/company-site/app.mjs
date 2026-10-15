import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateGlb } from './glb-validation.mjs';
import { createProjectModelLoader } from './model-loader.mjs';
import { annotationForMesh, bindBlenderObjectNames } from './annotation-names.mjs';

const $ = id => document.getElementById(id);
const viewer = $('viewer');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const initialCameraPosition = new THREE.Vector3(7, 7, 9);
const initialTarget = new THREE.Vector3(0, 1, 0);
camera.position.copy(initialCameraPosition);
scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(-6, 10, 8);
scene.add(light);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const gltfLoader = new GLTFLoader();
let renderer = null;
let controls = null;
let resizeObserver = null;
let currentModel = null;
let loader = null;
let renderFrame = null;
let disposed = false;
let suspended = false;
let annotations = {};
let currentProject = null;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  viewer.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(initialTarget);
} catch {
  renderer?.dispose();
  renderer = null;
}

function disposeModel(model) {
  model.traverse(object => {
    object.geometry?.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}

function clearModel() {
  if (!currentModel) return;
  scene.remove(currentModel);
  disposeModel(currentModel);
  currentModel = null;
  $('annotation').hidden = true;
}

async function parseDocument(blob) {
  const buffer = await blob.arrayBuffer();
  validateGlb(buffer);
  return new Promise((resolve, reject) => {
    gltfLoader.parse(buffer, '', gltf => {
      bindBlenderObjectNames(gltf);
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 10 / Math.max(size.x, size.y, size.z, 1);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      resolve(model);
    }, reject);
  });
}

function resize() {
  if (!renderer) return;
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / (height || 1);
  camera.updateProjectionMatrix();
}

function rotateCamera(angle) {
  const offset = camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function zoomCamera(factor) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 3, 40));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function showAnnotation(event) {
  if (!currentModel || !renderer) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const object = raycaster.intersectObject(currentModel, true).find(hit => hit.object.isMesh)?.object;
  const annotation = object ? annotationForMesh(object, currentModel, annotations) : null;
  $('annotation').hidden = !annotation;
  if (!annotation) return;
  $('annotation-title').textContent = annotation.title || annotation.name;
  $('annotation-description').textContent = annotation.description || '';
}

function setProject(project) {
  currentProject = project;
  $('annotation').hidden = true;
  if (loader && !suspended && !disposed) void loader.setProject(project);
}

function startRendering() {
  if (!renderer || renderFrame !== null || suspended || disposed) return;
  function render() {
    renderFrame = null;
    if (suspended || disposed || !renderer) return;
    controls.update();
    renderer.render(scene, camera);
    renderFrame = requestAnimationFrame(render);
  }
  renderFrame = requestAnimationFrame(render);
}

function stopRendering() {
  if (renderFrame === null) return;
  cancelAnimationFrame(renderFrame);
  renderFrame = null;
}

async function start() {
  try {
    const [configResponse, annotationsResponse] = await Promise.all([fetch('./config.json'), fetch('./annotations.json')]);
    if (!configResponse.ok || !annotationsResponse.ok) throw new Error('CONFIG_UNAVAILABLE');
    const config = await configResponse.json();
    annotations = await annotationsResponse.json();
    if (!renderer) {
      $('status').textContent = 'WebGL is unavailable in this browser.';
      $('controls').hidden = true;
      return;
    }

    $('rotate-left').addEventListener('click', () => rotateCamera(-Math.PI / 8));
    $('rotate-right').addEventListener('click', () => rotateCamera(Math.PI / 8));
    $('zoom-in').addEventListener('click', () => zoomCamera(0.8));
    $('zoom-out').addEventListener('click', () => zoomCamera(1.25));
    $('reset-view').addEventListener('click', () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialTarget);
      controls.update();
    });
    renderer.domElement.addEventListener('click', showAnnotation);
    loader = createProjectModelLoader({
      projectKey: config.projectKey,
      documentRef: config.documentRef,
      fetchDocument: (...args) => studio.docs.fetch(...args),
      parseDocument,
      showModel: model => { currentModel = model; scene.add(model); },
      clearModel,
      disposeModel,
      setStatus: message => { $('status').textContent = message; },
    });
    let projectEventSeen = false;
    studio.onProjectChange(project => {
      projectEventSeen = true;
      setProject(project);
    });
    const project = await studio.project();
    if (!projectEventSeen && !disposed) setProject(project);
  } catch {
    if (!disposed) $('status').textContent = 'Viewer configuration could not be loaded.';
  }
}

if (renderer) {
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewer);
  resize();
  startRendering();
}

void start();
window.addEventListener('pagehide', event => {
  suspended = event.persisted;
  disposed = !event.persisted;
  stopRendering();
  resizeObserver?.disconnect();
  loader?.invalidate();
  if (event.persisted) return;
  controls?.dispose();
  renderer?.dispose();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted || disposed) return;
  suspended = false;
  resizeObserver?.observe(viewer);
  resize();
  startRendering();
  if (currentProject && loader) void loader.setProject(currentProject);
});
