import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ==========================================
// 0. Toast 狀態通知與 OCCT STEP WASM 引擎懶載入
// ==========================================
let toastTimer = null;
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.getElementById('status-toast');
  const icon = document.getElementById('status-toast-icon');
  const text = document.getElementById('status-toast-text');
  if (!toast || !icon || !text) return;

  if (toastTimer) clearTimeout(toastTimer);
  text.textContent = message;

  if (type === 'error') {
    icon.textContent = '⚠️';
    toast.className = 'absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] sm:max-w-md px-3.5 py-2 rounded-lg bg-red-950/95 border border-red-500/70 text-xs text-red-100 shadow-2xl flex items-center gap-2';
  } else if (type === 'success') {
    icon.textContent = '✅';
    toast.className = 'absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] sm:max-w-md px-3.5 py-2 rounded-lg bg-emerald-950/95 border border-emerald-500/60 text-xs text-emerald-100 shadow-2xl flex items-center gap-2';
  } else {
    icon.textContent = '⏳';
    toast.className = 'absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] sm:max-w-md px-3.5 py-2 rounded-lg bg-slate-900/95 border border-sky-500/60 text-xs text-slate-100 shadow-2xl flex items-center gap-2';
  }

  toast.classList.remove('hidden');
  if (duration > 0) {
    toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  }
}

let occtInstancePromise = null;
function getOcctEngine() {
  if (occtInstancePromise) return occtInstancePromise;
  occtInstancePromise = new Promise((resolve, reject) => {
    const cdnBase = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/';
    if (typeof window.occtimportjs === 'function') {
      window.occtimportjs({ locateFile: (path) => cdnBase + path }).then(resolve).catch(reject);
      return;
    }
    const script = document.createElement('script');
    script.src = cdnBase + 'occt-import-js.js';
    script.onload = () => {
      if (typeof window.occtimportjs !== 'function') {
        reject(new Error('OCCT STEP 解析引擎載入失敗'));
        return;
      }
      window.occtimportjs({ locateFile: (path) => cdnBase + path }).then(resolve).catch(reject);
    };
    script.onerror = () => {
      occtInstancePromise = null;
      reject(new Error('無法下載 STEP 解析引擎（首次解析需連線載入 WASM 模組）'));
    };
    document.head.appendChild(script);
  });
  return occtInstancePromise;
}

// ==========================================
// 1. PWA Service Worker 註冊與自動更新機制
// ==========================================
let deferredPrompt = null;
let swRegistration = null;
const swStatusText = document.getElementById('sw-status-text');
const btnTriggerInstall = document.getElementById('btn-trigger-install');
const btnForceUpdate = document.getElementById('btn-force-update');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {
        updateViaCache: 'none'
      });
      swRegistration = reg;

      if (swStatusText) swStatusText.textContent = '已啟用 (支援 STEP 離線快取)';
      reg.update();

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        if (swStatusText) swStatusText.textContent = '發現新版本，正在同步...';
      });
    } catch (err) {
      if (swStatusText) swStatusText.textContent = '需透過 HTTPS 執行';
      console.warn('ServiceWorker registration failed:', err);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

btnForceUpdate?.addEventListener('click', async () => {
  if (!swRegistration) return;
  if (swStatusText) swStatusText.textContent = '正在向伺服器檢查更新...';
  await swRegistration.update();
  setTimeout(() => {
    if (swStatusText && !swRegistration.installing) {
      swStatusText.textContent = '目前已是最新版本';
    }
  }, 1500);
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnTriggerInstall) btnTriggerInstall.classList.remove('hidden');
});

btnTriggerInstall?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnTriggerInstall.classList.add('hidden');
});

function updateNetworkStatus() {
  const dot = document.getElementById('network-dot');
  const text = document.getElementById('network-text');
  const badge = document.getElementById('network-badge');
  if (!dot || !text || !badge) return;
  if (navigator.onLine) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    text.textContent = '線上就緒';
    badge.className = 'hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] whitespace-nowrap';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400';
    text.textContent = '離線模式';
    badge.className = 'hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] whitespace-nowrap';
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

// ==========================================
// 2. 手機版底部抽屜 (Drawer) 控制邏輯
// ==========================================
const leftSidebar = document.getElementById('left-sidebar');
const rightSidebar = document.getElementById('right-sidebar');
const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');

function openDrawer(side) {
  closeAllDrawers();
  if (side === 'left') {
    leftSidebar.classList.remove('translate-y-full');
  } else if (side === 'right') {
    rightSidebar.classList.remove('translate-y-full');
  }
  drawerBackdrop.classList.remove('hidden');
}

function closeAllDrawers() {
  leftSidebar.classList.add('translate-y-full');
  rightSidebar.classList.add('translate-y-full');
  drawerBackdrop.classList.add('hidden');
}

drawerBackdrop.addEventListener('click', closeAllDrawers);
document.getElementById('btn-close-left-drawer')?.addEventListener('click', closeAllDrawers);
document.getElementById('btn-close-right-drawer')?.addEventListener('click', closeAllDrawers);

document.getElementById('mobile-nav-bom')?.addEventListener('click', () => openDrawer('left'));
document.getElementById('mobile-nav-props')?.addEventListener('click', () => openDrawer('right'));
document.getElementById('mobile-nav-analysis')?.addEventListener('click', () => {
  closeAllDrawers();
  document.getElementById('analysis-panel').classList.toggle('hidden');
});
document.getElementById('mobile-nav-import')?.addEventListener('click', () => {
  closeAllDrawers();
  openImportModal();
});

// ==========================================
// 3. Three.js 3D 場景初始化與觸控優化
// ==========================================
const container = document.getElementById('canvas-holder');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.001, 10000);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight1.position.set(8, 12, 10);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.7);
dirLight2.position.set(-10, -5, -8);
scene.add(dirLight2);

const gridHelper = new THREE.GridHelper(16, 32, 0x334155, 0x1e293b);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(1.2);
axesHelper.position.set(-7.5, 0.01, -7.5);
scene.add(axesHelper);

const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.5);
let clippingEnabled = false;
let clipAxis = 'x';

const rootAssembly = new THREE.Group();
rootAssembly.name = 'Planetary_Gearbox_Assembly';
scene.add(rootAssembly);

let partEntries = [];
let selectedPartId = null;
let renderMode = 'shaded';
let showPMI = true;
let edgeLinesGroup = new THREE.Group();
scene.add(edgeLinesGroup);

// ==========================================
// 4. 內建工業行星減速機組合件 (範例)
// ==========================================
function buildDemoGearbox(customTitle = 'Planetary_Gearbox_Assembly.jt', shouldClear = true) {
  if (shouldClear) {
    clearAssembly();
  }
  document.getElementById('active-file-label').textContent = customTitle;

  const matHousing = new THREE.MeshStandardMaterial({
    color: 0x475569, metalness: 0.65, roughness: 0.35, side: THREE.DoubleSide
  });
  const matSunGear = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide
  });
  const matPlanet = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, metalness: 0.7, roughness: 0.28, side: THREE.DoubleSide
  });
  const matCarrier = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, metalness: 0.8, roughness: 0.22, side: THREE.DoubleSide
  });
  const matFlange = new THREE.MeshStandardMaterial({
    color: 0x334155, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide
  });

  const ringGeo = new THREE.CylinderGeometry(2.1, 2.1, 1.3, 48, 1, true);
  const ringMesh = new THREE.Mesh(ringGeo, matHousing);
  ringMesh.position.set(0, 1.4, 0);
  registerPart(ringMesh, 'Outer_Ring_Housing_01', 'FCD450 球墨鑄鐵', new THREE.Vector3(0, 0, 0), [
    { label: 'Ø180.00 ±0.02 H7', offset: new THREE.Vector3(2.1, 0.5, 0) },
    { label: '◎ Ø0.015 A', offset: new THREE.Vector3(-2.1, 0.3, 0) }
  ]);

  const sunGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.6, 24);
  const sunMesh = new THREE.Mesh(sunGeo, matSunGear);
  sunMesh.position.set(0, 1.4, 0);
  registerPart(sunMesh, 'Sun_Gear_Shaft_02', 'SCM415 滲碳合金鋼', new THREE.Vector3(0, 1.6, 0), [
    { label: 'M2.5 / Z=18 漸開線齒', offset: new THREE.Vector3(0, 0.9, 0) },
    { label: 'HRC 58~62 表面硬化', offset: new THREE.Vector3(0.65, 0.2, 0) }
  ]);

  const planetAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  planetAngles.forEach((ang, idx) => {
    const r = 1.32;
    const px = Math.cos(ang) * r;
    const pz = Math.sin(ang) * r;
    const pGeo = new THREE.CylinderGeometry(0.58, 0.58, 1.15, 20);
    const pMesh = new THREE.Mesh(pGeo, matPlanet.clone());
    pMesh.position.set(px, 1.4, pz);
    registerPart(
      pMesh,
      `Planet_Gear_0${idx + 3}`,
      'SNCM420 鎳鉻鉬鋼',
      new THREE.Vector3(Math.cos(ang) * 1.4, 0.7, Math.sin(ang) * 1.4),
      idx === 0 ? [{ label: 'Ø48.00 g6 軸承配合', offset: new THREE.Vector3(0.5, 0.6, 0) }] : []
    );
  });

  const topCapGeo = new THREE.CylinderGeometry(2.15, 2.15, 0.25, 48);
  const topCapMesh = new THREE.Mesh(topCapGeo, matCarrier);
  topCapMesh.position.set(0, 2.25, 0);
  registerPart(topCapMesh, 'Carrier_Top_Flange_06', 'AL7075-T6 航太鋁合金', new THREE.Vector3(0, 2.4, 0), [
    { label: '⊥ 0.010 B 端面跳動', offset: new THREE.Vector3(1.5, 0.2, 0) }
  ]);

  const baseGeo = new THREE.CylinderGeometry(2.3, 2.4, 0.35, 48);
  const baseMesh = new THREE.Mesh(baseGeo, matFlange);
  baseMesh.position.set(0, 0.55, 0);
  registerPart(baseMesh, 'Base_Mount_Flange_07', 'S45C 中碳鋼', new THREE.Vector3(0, -1.2, 0), [
    { label: 'DATUM [A] 基準面', offset: new THREE.Vector3(-1.8, -0.1, 0.5) }
  ]);

  if (shouldClear) {
    finalizeSceneUpdate();
  }
}

function clearAssembly() {
  while (rootAssembly.children.length > 0) {
    rootAssembly.remove(rootAssembly.children[0]);
  }
  while (edgeLinesGroup.children.length > 0) {
    edgeLinesGroup.remove(edgeLinesGroup.children[0]);
  }
  partEntries = [];
  selectedPartId = null;
}

function registerPart(mesh, name, materialName = 'Standard CAD Material', explodeDir = new THREE.Vector3(0, 1, 0), pmi = []) {
  const id = 'part_' + (partEntries.length + 1) + '_' + Math.random().toString(36).slice(2, 6);
  mesh.name = name;
  mesh.userData.partId = id;
  if (mesh.material) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      m.side = THREE.DoubleSide;
      m.clippingPlanes = clippingEnabled ? [clipPlane] : [];
    });
  }
  rootAssembly.add(mesh);
  partEntries.push({
    id,
    name,
    mesh,
    basePos: mesh.position.clone(),
    explodeDir,
    materialName,
    pmi
  });
}

function finalizeSceneUpdate() {
  rebuildEdgeLines();
  applyRenderMode(renderMode);
  renderBOMTree();
  if (partEntries.length > 0) {
    selectPart(partEntries[0].id, false);
  }
  fitCameraToObject(rootAssembly);
}

// ==========================================
// 5. 外部檔案匯入 (.STEP, .STP, .GLB, .GLTF, .STL, .OBJ, .JT)
// ==========================================
async function handleImportFiles(fileList, options) {
  if (!fileList || fileList.length === 0) return;
  const { mode, unitScale, autoCenter } = options;

  showToast(`正在解析 ${fileList[0].name}...`, 'info', 0);

  if (mode === 'replace') {
    clearAssembly();
  }

  const labelNames = [];
  let loadedCount = 0;

  try {
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      labelNames.push(file.name);

      if (ext === 'jt') {
        buildDemoGearbox(`${file.name} (JT 結構預覽模式，真實幾何請匯入 .STEP / .GLB)`, false);
        loadedCount += 7;
        continue;
      }

      if (!['step', 'stp', 'stl', 'obj', 'glb', 'gltf'].includes(ext)) {
        showToast(`不支援的檔案格式：.${ext}（支援 .step, .stp, .glb, .stl, .obj）`, 'error', 4500);
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();

      // A. STEP / STP (ISO 10303-21 B-Rep CAD 實體解析)
      if (ext === 'step' || ext === 'stp') {
        showToast(`正在啟動 STEP B-Rep 解析引擎處理 ${file.name}...`, 'info', 0);
        const occt = await getOcctEngine();
        const fileBuffer = new Uint8Array(arrayBuffer);
        const result = occt.ReadStepFile(fileBuffer, null);

        if (!result || !result.success || !result.meshes || result.meshes.length === 0) {
          throw new Error('STEP 檔案解析失敗或未包含實體幾何（請確認匯出為 AP203 / AP214 實體）');
        }

        const stepGroup = new THREE.Group();
        const tempParts = [];

        result.meshes.forEach((meshData, idx) => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
          if (meshData.attributes.normal) {
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
          } else {
            geo.computeVertexNormals();
          }
          if (meshData.index) {
            geo.setIndex(new THREE.BufferAttribute(new Uint32Array(meshData.index.array), 1));
          }

          let colorHex = 0x94a3b8;
          if (meshData.color && meshData.color.length >= 3) {
            const c = new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2]);
            colorHex = c.getHex();
          }

          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            metalness: 0.55,
            roughness: 0.35,
            side: THREE.DoubleSide
          });

          const mesh = new THREE.Mesh(geo, mat);
          mesh.scale.setScalar(unitScale);
          stepGroup.add(mesh);
          tempParts.push({
            mesh,
            name: (meshData.name && meshData.name.trim()) ? meshData.name.trim() : `${file.name}_Part_${idx + 1}`
          });
        });

        stepGroup.updateMatrixWorld(true);
        const groupBox = new THREE.Box3().setFromObject(stepGroup);
        const groupCenter = groupBox.getCenter(new THREE.Vector3());

        tempParts.forEach((item, idx) => {
          const m = item.mesh;
          stepGroup.remove(m);
          if (autoCenter && !groupBox.isEmpty()) {
            m.position.x -= groupCenter.x;
            m.position.z -= groupCenter.z;
            m.position.y -= groupBox.min.y;
          }
          const partBox = new THREE.Box3().setFromObject(m);
          const partCenter = partBox.getCenter(new THREE.Vector3());
          const explodeVec = partCenter.clone().sub(new THREE.Vector3(0, partCenter.y * 0.5, 0)).normalize();
          if (explodeVec.lengthSq() < 0.01) explodeVec.set(0, 1, 0);

          registerPart(
            m,
            item.name,
            'STEP AP214 CAD 實體',
            explodeVec.multiplyScalar(1.2),
            idx === 0 ? [{ label: `STEP 組合件 (${file.name})`, offset: new THREE.Vector3(0, 0.5, 0) }] : []
          );
          loadedCount++;
        });
      }
      // B. STL
      else if (ext === 'stl') {
        const loader = new STLLoader();
        const geo = loader.parse(arrayBuffer);
        if (!geo || !geo.attributes || !geo.attributes.position || geo.attributes.position.count === 0) {
          throw new Error('STL 檔案不包含有效的三角網格資料');
        }
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8, metalness: 0.65, roughness: 0.3, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(unitScale);
        if (autoCenter) centerAndGroundMesh(mesh);
        registerPart(mesh, file.name, 'STL 網格模型', new THREE.Vector3(0, 1.2, 0), [
          { label: `STL (${file.name})`, offset: new THREE.Vector3(0, 0.5, 0) }
        ]);
        loadedCount++;
      }
      // C. OBJ
      else if (ext === 'obj') {
        const text = new TextDecoder().decode(arrayBuffer);
        const loader = new OBJLoader();
        const objGroup = loader.parse(text);
        objGroup.scale.setScalar(unitScale);
        objGroup.updateMatrixWorld(true);
        if (autoCenter) centerAndGroundMesh(objGroup);
        objGroup.updateMatrixWorld(true);

        let idx = 0;
        objGroup.traverse((child) => {
          if (child.isMesh && child.geometry) {
            idx++;
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

            const mat = new THREE.MeshStandardMaterial({
              color: 0x94a3b8, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide
            });
            const clonedMesh = new THREE.Mesh(child.geometry, mat);
            clonedMesh.position.copy(worldPos);
            clonedMesh.quaternion.copy(worldQuat);
            clonedMesh.scale.copy(worldScale);

            registerPart(clonedMesh, child.name || `${file.name}_Part_${idx}`, 'OBJ 幾何網格', new THREE.Vector3(0, idx * 0.6, 0), []);
            loadedCount++;
          }
        });
      }
      // D. GLB / GLTF
      else if (ext === 'glb' || ext === 'gltf') {
        const loader = new GLTFLoader();
        await new Promise((resolve, reject) => {
          loader.parse(
            arrayBuffer,
            '',
            (gltf) => {
              const model = gltf.scene;
              model.scale.setScalar(unitScale);
              model.updateMatrixWorld(true);
              if (autoCenter) centerAndGroundMesh(model);
              model.updateMatrixWorld(true);

              let idx = 0;
              model.traverse((child) => {
                if (child.isMesh && child.geometry) {
                  idx++;
                  const worldPos = new THREE.Vector3();
                  const worldQuat = new THREE.Quaternion();
                  const worldScale = new THREE.Vector3();
                  child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

                  const mat = child.material
                    ? (Array.isArray(child.material) ? child.material.map((m) => m.clone()) : child.material.clone())
                    : new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 });

                  const clonedMesh = new THREE.Mesh(child.geometry, mat);
                  clonedMesh.position.copy(worldPos);
                  clonedMesh.quaternion.copy(worldQuat);
                  clonedMesh.scale.copy(worldScale);

                  registerPart(
                    clonedMesh,
                    child.name || `${file.name}_Node_${idx}`,
                    (Array.isArray(mat) ? mat[0]?.name : mat?.name) || 'GLTF PBR 材質',
                    new THREE.Vector3((idx % 2 === 0 ? 1 : -1) * 0.8, idx * 0.5, 0),
                    idx === 1 ? [{ label: `GLTF (${file.name})`, offset: new THREE.Vector3(0, 0.5, 0) }] : []
                  );
                  loadedCount++;
                }
              });
              resolve();
            },
            (err) => reject(err || new Error('GLB/GLTF 解析失敗'))
          );
        });
      }
    }

    if (loadedCount === 0) {
      showToast('檔案中未找到可顯示的 3D 幾何網格，已恢復範例模型', 'error', 4500);
      buildDemoGearbox();
      return;
    }

    document.getElementById('active-file-label').textContent = labelNames.join(', ');
    finalizeSceneUpdate();
    showToast(`成功匯入 ${labelNames.join(', ')}（共 ${loadedCount} 個零件節點）`, 'success', 3500);
  } catch (err) {
    console.error('Import error:', err);
    showToast(`匯入失敗：${err.message || '檔案格式錯誤或已損毀'}`, 'error', 5000);
    if (partEntries.length === 0) {
      buildDemoGearbox();
    }
  }
}

function centerAndGroundMesh(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y;
}

// ==========================================
// 6. 渲染模式、邊線與相機控制
// ==========================================
function rebuildEdgeLines() {
  while (edgeLinesGroup.children.length > 0) {
    edgeLinesGroup.remove(edgeLinesGroup.children[0]);
  }
  partEntries.forEach((entry) => {
    try {
      const edges = new THREE.EdgesGeometry(entry.mesh.geometry, 28);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.75 });
      const lineSeg = new THREE.LineSegments(edges, lineMat);
      lineSeg.position.copy(entry.mesh.position);
      lineSeg.quaternion.copy(entry.mesh.quaternion);
      lineSeg.scale.copy(entry.mesh.scale);
      lineSeg.visible = entry.mesh.visible && (renderMode === 'edges');
      entry.edgeLine = lineSeg;
      edgeLinesGroup.add(lineSeg);
    } catch (e) {
      console.warn('Edge generation skipped for part:', entry.name);
    }
  });
}

function applyRenderMode(mode) {
  renderMode = mode;
  document.querySelectorAll('.render-btn').forEach((btn) => {
    const isMobileBar = Boolean(btn.parentElement && btn.parentElement.classList.contains('xl:hidden'));
    if (btn.dataset.render === mode) {
      btn.className = isMobileBar
        ? 'render-btn px-2.5 py-1 text-[11px] rounded bg-sky-600 text-white font-medium whitespace-nowrap shrink-0'
        : 'render-btn px-2.5 py-1 text-xs rounded bg-sky-600 text-white font-medium transition whitespace-nowrap';
    } else {
      btn.className = isMobileBar
        ? 'render-btn px-2.5 py-1 text-[11px] rounded bg-slate-900 border border-slate-800 text-slate-300 whitespace-nowrap shrink-0'
        : 'render-btn px-2.5 py-1 text-xs rounded hover:bg-slate-800 text-slate-300 transition whitespace-nowrap';
    }
  });

  partEntries.forEach((entry) => {
    const mats = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
    mats.forEach((mat) => {
      if (!mat) return;
      mat.wireframe = (mode === 'wireframe');
      mat.transparent = (mode === 'xray');
      mat.opacity = (mode === 'xray') ? 0.32 : 1.0;
      mat.depthWrite = (mode !== 'xray');
      mat.needsUpdate = true;
    });
    if (entry.edgeLine) {
      entry.edgeLine.visible = entry.mesh.visible && (mode === 'edges');
    }
  });
}

function fitCameraToObject(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const isPortrait = container.clientHeight > container.clientWidth;
  const dist = maxDim * (isPortrait ? 2.4 : 1.85);

  camera.near = Math.max(maxDim / 10000, 0.0001);
  camera.far = Math.max(maxDim * 200, 2000);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  camera.position.set(center.x + dist * 0.85, center.y + dist * 0.65, center.z + dist * 0.95);
  camera.lookAt(center);
  controls.update();
}

function setStandardView(view) {
  rootAssembly.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rootAssembly);
  const center = box.isEmpty() ? new THREE.Vector3(0, 1, 0) : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty() ? new THREE.Vector3(4, 4, 4) : box.getSize(new THREE.Vector3());
  const isPortrait = container.clientHeight > container.clientWidth;
  const dist = Math.max(size.x, size.y, size.z, 0.05) * (isPortrait ? 2.5 : 2.1);

  controls.target.copy(center);
  if (view === 'front') camera.position.set(center.x, center.y, center.z + dist);
  else if (view === 'top') camera.position.set(center.x, center.y + dist, center.z + 0.001);
  else if (view === 'right') camera.position.set(center.x + dist, center.y, center.z);
  else if (view === 'iso') camera.position.set(center.x + dist * 0.8, center.y + dist * 0.7, center.z + dist * 0.8);
  else if (view === 'fit') fitCameraToObject(rootAssembly);
  controls.update();
}

// ==========================================
// 7. BOM 結構樹與屬性檢查器連動
// ==========================================
function renderBOMTree(filterText = '') {
  const treeBox = document.getElementById('bom-tree-container');
  treeBox.innerHTML = '';

  const kw = filterText.trim().toLowerCase();
  partEntries.forEach((entry) => {
    if (kw && !entry.name.toLowerCase().includes(kw)) return;

    const row = document.createElement('div');
    const isSel = entry.id === selectedPartId;
    row.className = `flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition ${
      isSel ? 'bg-sky-600/30 border border-sky-500/50 text-white' : 'hover:bg-slate-800/80 text-slate-300'
    }`;

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2 truncate';
    left.innerHTML = `<span class="text-sky-400">▪</span><span class="truncate">${entry.name}</span>`;
    left.onclick = () => {
      selectPart(entry.id, true);
      if (window.innerWidth < 1024) closeAllDrawers();
    };

    const eyeBtn = document.createElement('button');
    eyeBtn.className = `text-xs px-1.5 py-0.5 rounded ${entry.mesh.visible ? 'text-slate-300 hover:text-white' : 'text-slate-600'}`;
    eyeBtn.textContent = entry.mesh.visible ? '👁' : '🚫';
    eyeBtn.title = '顯示 / 隱藏零件';
    eyeBtn.onclick = (e) => {
      e.stopPropagation();
      entry.mesh.visible = !entry.mesh.visible;
      if (entry.edgeLine) entry.edgeLine.visible = entry.mesh.visible && (renderMode === 'edges');
      renderBOMTree(document.getElementById('tree-search').value);
    };

    row.appendChild(left);
    row.appendChild(eyeBtn);
    treeBox.appendChild(row);
  });
}

function selectPart(partId, openMobileProps = false) {
  selectedPartId = partId;
  partEntries.forEach((entry) => {
    const mats = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
    mats.forEach((mat) => {
      if (!mat || !mat.emissive) return;
      if (entry.id === partId) {
        mat.emissive.setHex(0x0284c7);
        mat.emissiveIntensity = 0.35;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  });

  renderBOMTree(document.getElementById('tree-search').value);
  updateInspector(partEntries.find((p) => p.id === partId));
  if (openMobileProps && window.innerWidth < 1024) {
    openDrawer('right');
  }
}

function updateInspector(entry) {
  if (!entry) return;
  document.getElementById('prop-name').textContent = entry.name;
  document.getElementById('prop-type').textContent = '類型：3D 實體零件 (Part Node)';
  document.getElementById('prop-mat').textContent = entry.materialName;

  const box = new THREE.Box3().setFromObject(entry.mesh);
  const size = box.getSize(new THREE.Vector3());
  document.getElementById('prop-dx').textContent = (size.x * 100).toFixed(2);
  document.getElementById('prop-dy').textContent = (size.y * 100).toFixed(2);
  document.getElementById('prop-dz').textContent = (size.z * 100).toFixed(2);

  const geo = entry.mesh.geometry;
  const tris = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  document.getElementById('prop-tris').textContent = Math.round(tris).toLocaleString();

  const pmiList = document.getElementById('pmi-list');
  pmiList.innerHTML = '';
  if (entry.pmi && entry.pmi.length > 0) {
    entry.pmi.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'bg-slate-950 border border-sky-500/30 rounded px-2.5 py-1.5 text-sky-300 font-mono';
      div.textContent = item.label;
      pmiList.appendChild(div);
    });
  } else {
    pmiList.innerHTML = '<div class="text-slate-500">此零件無額外 PMI 公差標註</div>';
  }
}

// ==========================================
// 8. 3D PMI 螢幕座標投影更新
// ==========================================
const pmiOverlayLayer = document.getElementById('pmi-overlay-layer');

function updatePMIOverlay() {
  pmiOverlayLayer.innerHTML = '';
  if (!showPMI) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  partEntries.forEach((entry) => {
    if (!entry.mesh.visible || !entry.pmi || entry.pmi.length === 0) return;
    entry.pmi.forEach((item) => {
      const worldPos = entry.mesh.position.clone().add(item.offset);
      const projected = worldPos.project(camera);
      if (projected.z > 1) return;

      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-(projected.y * 0.5) + 0.5) * height;
      if (x < 12 || x > width - 12 || y < 24 || y > height - 12) return;

      const tag = document.createElement('div');
      tag.className = 'pmi-tag';
      tag.style.left = `${x}px`;
      tag.style.top = `${y}px`;
      tag.textContent = item.label;
      pmiOverlayLayer.appendChild(tag);
    });
  });
}

// ==========================================
// 9. UI 事件綁定
// ==========================================
document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => setStandardView(btn.dataset.view));
});

document.querySelectorAll('.render-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyRenderMode(btn.dataset.render));
});

document.getElementById('btn-toggle-pmi').addEventListener('click', (e) => {
  showPMI = !showPMI;
  e.currentTarget.classList.toggle('opacity-50', !showPMI);
});

const analysisPanel = document.getElementById('analysis-panel');
document.getElementById('btn-toggle-analysis')?.addEventListener('click', () => {
  analysisPanel.classList.toggle('hidden');
});
document.getElementById('btn-close-analysis')?.addEventListener('click', () => {
  analysisPanel.classList.add('hidden');
});

document.getElementById('explode-slider').addEventListener('input', (e) => {
  const ratio = Number(e.target.value) / 100;
  document.getElementById('explode-val').textContent = `${e.target.value}%`;
  partEntries.forEach((entry) => {
    entry.mesh.position.copy(entry.basePos).addScaledVector(entry.explodeDir, ratio);
    if (entry.edgeLine) entry.edgeLine.position.copy(entry.mesh.position);
  });
});

document.getElementById('section-enable').addEventListener('change', (e) => {
  clippingEnabled = e.target.checked;
  partEntries.forEach((entry) => {
    const mats = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
    mats.forEach((mat) => {
      if (mat) {
        mat.clippingPlanes = clippingEnabled ? [clipPlane] : [];
        mat.needsUpdate = true;
      }
    });
  });
});

document.querySelectorAll('.axis-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    clipAxis = btn.dataset.axis;
    document.querySelectorAll('.axis-btn').forEach((b) => {
      b.className = b === btn
        ? 'axis-btn flex-1 py-1.5 rounded bg-sky-600 text-white text-xs font-medium'
        : 'axis-btn flex-1 py-1.5 rounded bg-slate-800 text-slate-300 text-xs';
    });
    updateClipPlane();
  });
});

document.getElementById('section-slider').addEventListener('input', updateClipPlane);

function updateClipPlane() {
  const val = Number(document.getElementById('section-slider').value) / 35;
  if (clipAxis === 'x') clipPlane.normal.set(-1, 0, 0);
  else if (clipAxis === 'y') clipPlane.normal.set(0, -1, 0);
  else clipPlane.normal.set(0, 0, -1);
  clipPlane.constant = val;
}

document.getElementById('tree-search').addEventListener('input', (e) => {
  renderBOMTree(e.target.value);
});

document.getElementById('btn-show-all').addEventListener('click', () => {
  partEntries.forEach((entry) => {
    entry.mesh.visible = true;
    if (entry.edgeLine) entry.edgeLine.visible = (renderMode === 'edges');
  });
  renderBOMTree(document.getElementById('tree-search').value);
});

document.getElementById('btn-reset-demo').addEventListener('click', () => {
  buildDemoGearbox();
  if (window.innerWidth < 1024) closeAllDrawers();
});

const importModal = document.getElementById('import-modal');
const fileInput = document.getElementById('file-input');
let stagedFiles = [];

function openImportModal() {
  importModal.classList.remove('hidden');
}
function closeImportModal() {
  importModal.classList.add('hidden');
}

document.getElementById('btn-open-import')?.addEventListener('click', openImportModal);
document.getElementById('btn-tree-import')?.addEventListener('click', () => {
  closeAllDrawers();
  openImportModal();
});
document.getElementById('btn-card-import')?.addEventListener('click', openImportModal);
document.getElementById('btn-close-import')?.addEventListener('click', closeImportModal);
document.getElementById('btn-cancel-import')?.addEventListener('click', closeImportModal);

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  stagedFiles = files;

  const box = document.getElementById('selected-files-box');
  const list = document.getElementById('selected-files-list');
  const confirmBtn = document.getElementById('btn-confirm-import');

  box.classList.remove('hidden');
  list.textContent = stagedFiles.map((f) => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join('、');
  if (confirmBtn) confirmBtn.textContent = `載入已選檔案 (${stagedFiles.length})`;
});

document.getElementById('btn-confirm-import').addEventListener('click', async () => {
  if (stagedFiles.length === 0) {
    fileInput.click();
    return;
  }
  const filesToProcess = [...stagedFiles];
  const mode = document.getElementById('import-mode').value;
  const unitScale = parseFloat(document.getElementById('import-unit').value);
  const autoCenter = document.getElementById('import-center').checked;

  stagedFiles = [];
  fileInput.value = '';
  document.getElementById('selected-files-box').classList.add('hidden');
  document.getElementById('btn-confirm-import').textContent = '選擇 / 載入模型';
  closeImportModal();

  await handleImportFiles(filesToProcess, { mode, unitScale, autoCenter });
});

const dropOverlay = document.getElementById('drop-overlay');
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.remove('hidden');
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.add('hidden');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    await handleImportFiles(files, { mode: 'replace', unitScale: 1, autoCenter: true });
  }
});

const pwaModal = document.getElementById('pwa-modal');
document.getElementById('btn-open-pwa')?.addEventListener('click', () => pwaModal.classList.remove('hidden'));
document.getElementById('btn-close-pwa')?.addEventListener('click', () => pwaModal.classList.add('hidden'));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const moveDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (moveDist > 6) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(rootAssembly.children, false);
  if (intersects.length > 0 && intersects[0].object.userData.partId) {
    selectPart(intersects[0].object.userData.partId, true);
  }
});

const resizeObserver = new ResizeObserver(() => {
  if (!container.clientWidth || !container.clientHeight) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
resizeObserver.observe(container);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  updatePMIOverlay();
}

buildDemoGearbox();
animate();
