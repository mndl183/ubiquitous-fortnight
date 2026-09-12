import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { getAllModels, putModel, deleteModel, type StlModel } from './stlStore.ts';

const SAMPLE_MODELS: StlModel[] = [
  {
    id: 'sample-cube',
    name: 'Cube',
    url: '/models/cube.stl',
    description: 'A simple printable cube, perfect for calibration prints.',
    tags: ['cube', 'calibration', 'basic'],
    source: 'sample',
  },
  {
    id: 'sample-gear',
    name: 'Gear',
    url: '/models/gear.stl',
    description: 'A spur gear with 16 teeth — a classic 3D printing test part.',
    tags: ['gear', 'mechanical', 'spur'],
    source: 'sample',
  },
  {
    id: 'sample-torus',
    name: 'Torus',
    url: '/models/torus.stl',
    description: 'A smooth donut-shaped torus ring.',
    tags: ['torus', 'ring', 'smooth'],
    source: 'sample',
  },
];

const memory = new Map<string, StlModel>();
let useIdb = typeof indexedDB !== 'undefined';

async function storageGetAll(): Promise<StlModel[]> {
  try {
    if (useIdb) return await getAllModels();
  } catch {
    useIdb = false;
  }
  return Array.from(memory.values());
}
async function storagePut(model: StlModel) {
  memory.set(model.id, model);
  try {
    if (useIdb) await putModel(model);
  } catch {
    useIdb = false;
  }
}
async function storageDelete(id: string) {
  memory.delete(id);
  try {
    if (useIdb) await deleteModel(id);
  } catch {
    useIdb = false;
  }
}

const cache = new Map<string, StlModel>();
const bufferCache = new Map<string, ArrayBuffer>();

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setStatus(message: string) {
  const el = $('tool-status');
  if (el) el.textContent = message;
}

async function ensureSamples() {
  if (memory.size === 0 && (await storageGetAll()).length === 0) {
    for (const s of SAMPLE_MODELS) await storagePut(s);
  }
}

async function loadAll() {
  await ensureSamples();
  cache.clear();
  for (const m of await storageGetAll()) cache.set(m.id, m);
  renderGallery();
}

async function getModelBuffer(rec: StlModel): Promise<ArrayBuffer> {
  if (rec.source === 'sample' && rec.url) {
    if (!bufferCache.has(rec.id)) {
      const res = await fetch(rec.url);
      if (!res.ok) throw new Error(`Failed to fetch ${rec.url}`);
      bufferCache.set(rec.id, await res.arrayBuffer());
    }
    return bufferCache.get(rec.id)!;
  }
  if (rec.data) return await rec.data.arrayBuffer();
  throw new Error('Model has no data.');
}

// ---------------------------------------------------------------------------
// Thumbnail previews (single shared WebGL context, drawn into each card canvas)
// ---------------------------------------------------------------------------

let thumbCanvas: HTMLCanvasElement | null = null;
let thumbRenderer: THREE.WebGLRenderer | null = null;

function fitCameraFor(camera: THREE.PerspectiveCamera, mesh: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.position.set(maxDim * 1.6, maxDim * 1.3, maxDim * 1.9);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function renderThumbnail(target: HTMLCanvasElement, buffer: ArrayBuffer) {
  if (!thumbRenderer) {
    thumbCanvas = document.createElement('canvas');
    thumbRenderer = new THREE.WebGLRenderer({ canvas: thumbCanvas, antialias: true, alpha: false });
  }
  if (!thumbRenderer) return;
  thumbCanvas!.width = 360;
  thumbCanvas!.height = 240;

  const geometry = new STLLoader().parse(buffer);
  geometry.center();
  const material = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.12,
    roughness: 0.55,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(80, 120, 60);
  scene.add(dir);
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(50, 360 / 240, 0.01, 1000);
  fitCameraFor(camera, mesh);

  thumbRenderer.setSize(360, 240, false);
  thumbRenderer.render(scene, camera);

  const ctx = target.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(thumbCanvas!, 0, 0, target.width, target.height);
  }

  geometry.dispose();
  material.dispose();
  scene.clear();
}

// ---------------------------------------------------------------------------
// Main viewer (modal)
// ---------------------------------------------------------------------------

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let modelGroup: THREE.Group;
let viewerVisible = false;

function initViewer(container: HTMLElement) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 2000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  resizeViewer();

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(80, 120, 60);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-60, 30, -80);
  scene.add(fill);

  const grid = new THREE.GridHelper(120, 24, 0x94a3b8, 0xe2e8f0);
  grid.position.y = -0.5;
  scene.add(grid);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.0;

  window.addEventListener('resize', resizeViewer);

  function animate() {
    requestAnimationFrame(animate);
    if (!viewerVisible || !renderer) return;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function resizeViewer() {
  const container = $('model-viewer');
  if (!container || !renderer) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w && h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
}

function clearModelGroup() {
  while (modelGroup.children.length) {
    const child = modelGroup.children[0] as THREE.Mesh;
    if (child.geometry) child.geometry.dispose();
    if (child.material) (child.material as THREE.Material).dispose();
    modelGroup.remove(child);
  }
}

function showViewerModel(buffer: ArrayBuffer, label: string) {
  clearModelGroup();
  const geometry = new STLLoader().parse(buffer);
  geometry.center();
  const material = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.12,
    roughness: 0.55,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  modelGroup.add(mesh);
  fitCameraFor(camera, mesh);
  controls.target.set(0, 0, 0);
  controls.update();
  setStatus(`${label} ready — drag to rotate, scroll to zoom, right-click drag to pan.`);
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createCard(rec: StlModel): HTMLElement {
  const card = document.createElement('article');
  card.className =
    'stl-card bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer';
  card.dataset.id = rec.id;

  const sourceBadge =
    rec.source === 'sample'
      ? '<span class="absolute top-2 left-2 text-[10px] font-semibold text-white bg-slate-900/60 px-2 py-0.5 rounded-full">Sample</span>'
      : '<span class="absolute top-2 left-2 text-[10px] font-semibold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-full">Uploaded</span>';

  const tagsHtml = rec.tags.length
    ? rec.tags
        .map(
          (tag) =>
            `<span class="inline-block text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">${escapeHtml(tag)}</span>`
        )
        .join(' ')
    : '<span class="text-xs text-slate-400">No tags</span>';

  card.innerHTML = `
    <div class="relative">
      <canvas data-thumb class="w-full h-40 block bg-slate-100"></canvas>
      ${sourceBadge}
      <button data-action="download" class="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 rounded-full p-1.5 shadow transition-colors" title="Download STL">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </button>
    </div>
    <div class="p-4">
      <h3 class="font-bold text-slate-900 mb-1">${escapeHtml(rec.name)}</h3>
      <p class="text-sm text-slate-500 leading-relaxed line-clamp-3 min-h-[3.5rem] mb-2">
        ${rec.description ? escapeHtml(rec.description) : '<span class="text-slate-400">No description</span>'}
      </p>
      <div class="flex flex-wrap gap-1.5 mb-3">${tagsHtml}</div>
      <div class="flex items-center justify-between">
        <button data-action="view" class="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          Open viewer
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </button>
        <button data-action="delete" class="text-sm font-medium text-slate-400 hover:text-red-600 transition-colors">Delete</button>
      </div>
    </div>`;

  const thumb = card.querySelector<HTMLCanvasElement>('canvas[data-thumb]');
  if (thumb) {
    thumb.width = 640;
    thumb.height = 400;
  }

  card.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const actionBtn = target.closest<HTMLElement>('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      event.stopPropagation();
      if (action === 'download') downloadModel(rec);
      if (action === 'delete') deleteRecord(rec);
      if (action === 'view') openModel(rec.id);
      return;
    }
    openModel(rec.id);
  });

  // load preview lazily (requestIdleCallback keeps the page responsive)
  const loadPreview = () => {
    if (!thumb) return;
    getModelBuffer(rec)
      .then((buffer) => renderThumbnail(thumb, buffer))
      .catch(() => {
        thumb.classList.add('bg-red-50');
      });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(loadPreview, { timeout: 1500 });
  else setTimeout(loadPreview, 0);

  return card;
}

function renderGallery() {
  const gallery = $('gallery');
  const empty = $('gallery-empty');
  if (!gallery) return;

  const query = (($('search-input') as HTMLInputElement)?.value.trim() || '').toLowerCase();
  const matches = Array.from(cache.values()).filter(
    (rec) =>
      !query ||
      [rec.name, rec.description, ...rec.tags].some((value) => value.toLowerCase().includes(query))
  );

  gallery.innerHTML = '';
  if (!matches.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  for (const rec of matches) gallery.appendChild(createCard(rec));
}

// ---------------------------------------------------------------------------
// Model actions
// ---------------------------------------------------------------------------

function downloadModel(rec: StlModel) {
  const a = document.createElement('a');
  if (rec.source === 'sample' && rec.url) {
    a.href = rec.url;
  } else {
    const blob = rec.data || new Blob();
    a.href = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  a.download = `${rec.name.replace(/[\s]+/g, '-')}.stl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteRecord(rec: StlModel) {
  if (!confirm(`Delete "${rec.name}"?`)) return;
  await storageDelete(rec.id);
  cache.delete(rec.id);
  if ($('viewer-modal')?.classList.contains('hidden') === false && activeId === rec.id) closeModal();
  renderGallery();
  setStatus(`Deleted "${rec.name}".`);
}

// ---------------------------------------------------------------------------
// Modal (viewer + edit)
// ---------------------------------------------------------------------------

let activeId: string | null = null;

function fillFields(rec: StlModel) {
  ($('model-name') as HTMLInputElement).value = rec.name;
  ($('model-desc') as HTMLTextAreaElement).value = rec.description;
  ($('model-tags') as HTMLInputElement).value = rec.tags.join(', ');
}

function setModalHint(message: string) {
  const el = $('modal-hint');
  if (el) el.textContent = message;
}

function openModel(id: string) {
  const rec = cache.get(id);
  if (!rec) return;
  activeId = id;
  fillFields(rec);
  const titleEl = $('modal-title');
  if (titleEl) titleEl.textContent = rec.name;
  setModalHint(`Loading ${rec.name} preview...`);
  $('viewer-modal')!.classList.remove('hidden');
  viewerVisible = true;
  resizeViewer();
  getModelBuffer(rec)
    .then((buffer) => {
      if (activeId !== id) return;
      showViewerModel(buffer, rec.name);
      setModalHint('All changes are saved to your browser.');
    })
    .catch(() => {
      if (activeId === id) setModalHint('Could not load this model.');
    });

  const dl = $('modal-download') as HTMLAnchorElement;
  if (rec.source === 'sample' && rec.url) {
    dl.href = rec.url;
  } else {
    const blob = rec.data || new Blob();
    dl.href = URL.createObjectURL(blob);
  }
  dl.setAttribute('download', `${rec.name.replace(/[\s]+/g, '-')}.stl`);
}

function closeModal() {
  activeId = null;
  viewerVisible = false;
  $('viewer-modal')!.classList.add('hidden');
}

async function saveActive() {
  const rec = cache.get(activeId || '');
  if (!rec) return;
  const nameInput = $('model-name') as HTMLInputElement;
  const descInput = $('model-desc') as HTMLTextAreaElement;
  const tagsInput = $('model-tags') as HTMLInputElement;
  rec.name = nameInput.value.trim() || rec.name;
  rec.description = descInput.value.trim();
  rec.tags = tagsInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await storagePut(rec);
  renderGallery();
  setModalHint('Saved. All changes are stored in your browser.');
}

// ---------------------------------------------------------------------------
// Uploads: files & folders
// ---------------------------------------------------------------------------

async function handleFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList || []);
  const stls = files.filter((f) => /\.stl$/i.test(f.name));
  if (!stls.length) {
    setStatus('No .stl files found in the selection.');
    return;
  }
  setStatus(`Loading ${stls.length} STL file(s)...`);
  const stamp = Date.now();
  for (let i = 0; i < stls.length; i++) {
    const f = stls[i];
    try {
      const buffer = await f.arrayBuffer();
      await storagePut({
        id: `user-${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name.replace(/\.stl$/i, ''),
        description: '',
        tags: [],
        source: 'user',
        data: new Blob([buffer]),
        addedAt: Date.now(),
      });
    } catch {
      setStatus(`Could not read ${f.name}.`);
    }
  }
  await loadAll();
  setStatus(`Added ${stls.length} STL file(s).`);
}

function initToolbar() {
  const filesInput = $('file-input') as HTMLInputElement;
  const dirInput = $('dir-input') as HTMLInputElement;
  filesInput?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) handleFiles(input.files);
    input.value = '';
  });
  dirInput?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) handleFiles(input.files);
    input.value = '';
  });

  const search = $('search-input') as HTMLInputElement;
  search?.addEventListener('input', () => renderGallery());

  const gallery = $('gallery');
  gallery?.addEventListener('dragover', (e) => {
    e.preventDefault();
    gallery.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-50/30');
  });
  gallery?.addEventListener('dragleave', () => {
    gallery.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-50/30');
  });
  gallery?.addEventListener('drop', (e) => {
    e.preventDefault();
    gallery.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-50/30');
    if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files);
  });
}

function initModal() {
  $('close-modal')?.addEventListener('click', closeModal);
  $('viewer-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement) === $('viewer-modal')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  $('save-model')?.addEventListener('click', saveActive);
  $('delete-model')?.addEventListener('click', () => {
    const rec = cache.get(activeId || '');
    if (rec) deleteRecord(rec);
  });
}

export function initStlApp() {
  const container = $('model-viewer');
  if (!container) return;
  initViewer(container);
  initToolbar();
  initModal();
  loadAll().catch(() => setStatus('Could not load the model library.'));
}