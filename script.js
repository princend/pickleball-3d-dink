import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// --- 1. 基本場景設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a1a');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
// 初始視角：正對 Z 軸 (0, 0, 3.5)
const defaultCameraPos = new THREE.Vector3(0, 0, 3.5);
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

// 座標軸 (紅X, 綠Y, 藍Z) 長度設為 1.5
const axesHelper = new THREE.AxesHelper(1.5);
scene.add(axesHelper);

// --- 3. 製作 40孔匹克球 ---
// 用 Canvas 動態繪製 40 個孔洞的紋理，包覆到球體上
function createPickleballTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 底色黃色
    ctx.fillStyle = '#F4E022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 利用費氏數列(Fibonacci sphere)在球面上均勻分佈 40 個黑洞
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
        // 為了防止球極點變形，緯度越高橢圓要稍微壓扁，這裡採用簡單圓形近似
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
// 擊球紅點
const pointGeo = new THREE.SphereGeometry(0.08, 32, 32);
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const hitPoint = new THREE.Mesh(pointGeo, pointMat);
scene.add(hitPoint);

// 自訂粗體箭頭 (取代預設太細的 ArrowHelper)
const arrowGroup = new THREE.Group();
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xFF5500 }); // 霓虹橘
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 16), arrowMat);
shaft.position.y = 0.6; // 圓柱中心上移一半
const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), arrowMat);
head.position.y = 1.2 + 0.15; // 放在圓柱頂端
arrowGroup.add(shaft);
arrowGroup.add(head);
scene.add(arrowGroup);

// --- 5. 狀態更新與控制邏輯 ---
const states = {
    backhand: {
        origin: new THREE.Vector3(-0.62, -0.62, 0.48), // 左後下方
        dir: new THREE.Vector3(1, 0.5, -1).normalize() // 往右前上方推
    },
    forehand: {
        origin: new THREE.Vector3(0.62, -0.62, 0.48),  // 右後下方
        dir: new THREE.Vector3(-1, 0.5, -1).normalize()// 往左前上方推
    }
};

function updateState(type) {
    const state = states[type];
    
    // 更新紅點位置
    hitPoint.position.copy(state.origin);
    
    // 更新箭頭位置與方向
    arrowGroup.position.copy(state.origin);
    // 將箭頭原本朝上的 Y 軸，對齊到目標方向
    const axis = new THREE.Vector3(0, 1, 0); 
    arrowGroup.quaternion.setFromUnitVectors(axis, state.dir);
}

// 綁定 UI 按鈕
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
    // 平滑回到初始正對視角
    camera.position.copy(defaultCameraPos);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
});

// 初始化畫面為反手
updateState('backhand');

// --- 6. 渲染迴圈與視窗 RWD ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // 處理慣性滑動
    renderer.render(scene, camera);
}
animate();