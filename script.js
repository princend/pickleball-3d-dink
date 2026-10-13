import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. 基本場景設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a1a');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

// 新增動態計算相機距離的函式 (RWD)
function getCameraZ() {
    // 如果是手機版尺寸 (寬度小於 768)，就把相機拉遠到 5.5；電腦版維持 3.5
    return window.innerWidth < 768 ? 5.5 : 3.5;
}

// 初始視角：正對 Z 軸，距離依據螢幕寬度決定
const defaultCameraPos = new THREE.Vector3(0, 0, getCameraZ());
camera.position.copy(defaultCameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- 2. 燈光與座標軸 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const axesHelper = new THREE.AxesHelper(1.5);
scene.add(axesHelper);

// --- 3. 製作 40孔匹克球 ---
function createPickleballTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#F4E022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#222222';
    const samples = 40;
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    for (let i = 0; i < samples; i++) {
        const y = 1 - (i / (samples - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = phi * i;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        const latitude = Math.asin(y);
        const longitude = Math.atan2(z, x);

        const u = (longitude + Math.PI) / (2 * Math.PI);
        const v = (latitude + Math.PI / 2) / Math.PI;

        const cx = u * canvas.width;
        const cy = (1 - v) * canvas.height;

        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

const ballGeo = new THREE.SphereGeometry(1, 64, 64);
const ballMat = new THREE.MeshStandardMaterial({ 
    map: createPickleballTexture(),
    roughness: 0.4,
    metalness: 0.1
});
const pickleball = new THREE.Mesh(ballGeo, ballMat);
scene.add(pickleball);

// --- 4. 擊球點與粗體箭頭 ---
const pointGeo = new THREE.SphereGeometry(0.08, 32, 32);
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const hitPoint = new THREE.Mesh(pointGeo, pointMat);
scene.add(hitPoint);

const arrowGroup = new THREE.Group();
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xFF5500 });
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 16), arrowMat);
shaft.position.y = 0.6;
const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), arrowMat);
head.position.y = 1.2 + 0.15;
arrowGroup.add(shaft);
arrowGroup.add(head);
scene.add(arrowGroup);

// --- 5. 狀態更新與控制邏輯 ---
const states = {
    backhand: {
        origin: new THREE.Vector3(-0.62, -0.62, 0.48),
        dir: new THREE.Vector3(1, 0.5, -1).normalize()
    },
    forehand: {
        origin: new THREE.Vector3(0.62, -0.62, 0.48),
        dir: new THREE.Vector3(-1, 0.5, -1).normalize()
    }
};

function updateState(type) {
    const state = states[type];
    hitPoint.position.copy(state.origin);
    arrowGroup.position.copy(state.origin);
    const axis = new THREE.Vector3(0, 1, 0); 
    arrowGroup.quaternion.setFromUnitVectors(axis, state.dir);
}

const btnBackhand = document.getElementById('btn-backhand');
const btnForehand = document.getElementById('btn-forehand');
const btnReset = document.getElementById('btn-reset');

btnBackhand.addEventListener('click', () => {
    updateState('backhand');
    btnBackhand.classList.add('active');
    btnForehand.classList.remove('active');
});

btnForehand.addEventListener('click', () => {
    updateState('forehand');
    btnForehand.classList.add('active');
    btnBackhand.classList.remove('active');
});

btnReset.addEventListener('click', () => {
    camera.position.copy(defaultCameraPos);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
});

updateState('backhand');

// --- 6. 渲染迴圈與視窗 RWD ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // RWD 動態調整相機距離
    const newZ = getCameraZ();
    camera.position.z = newZ;
    defaultCameraPos.z = newZ; // 更新預設值，確保「重設視角」按鈕運作正常
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();