import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. 基本場景設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a1a');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

// RWD: 只改變相機 Z 軸距離來適應螢幕寬度，不碰 Y 軸
function getCameraZ() {
    return window.innerWidth < 768 ? 5.5 : 3.5;
}

const defaultCameraPos = new THREE.Vector3(0, 0, getCameraZ());
camera.position.copy(defaultCameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
// 確保旋轉中心永遠在原點
controls.target.set(0, 0, 0); 
controls.update();

// --- 2. 燈光與座標軸 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const axesHelper = new THREE.AxesHelper(1.5);
scene.add(axesHelper);

// --- 3. 製作 40孔匹克球 (完美圓孔著色器版) ---
const ballGeo = new THREE.SphereGeometry(1, 128, 128); // 增加面數讓球體更圓滑

// 建立 40 個孔洞的三維法向量 (使用費氏球面分佈)
const holeVectors = [];
const samples = 40;
const phi = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2; // y 從 1 到 -1
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    
    holeVectors.push(new THREE.Vector3(x, y, z));
}

// 將 40 個點轉換為 shader 可以吃進去的 uniform 陣列 (攤平成 1D 陣列)
const holesFlat = [];
holeVectors.forEach(v => {
    holesFlat.push(v.x, v.y, v.z);
});

// 建立客製化著色器材質
const ballMat = new THREE.ShaderMaterial({
    uniforms: {
        // 啟用 Three.js 內建光照參數
        ...THREE.UniformsLib.lights,
        holes: { value: holesFlat }, // 傳入 40 個孔的中心點座標
        holeRadius: { value: 0.16 }, // 調整孔洞的大小
        ballColor: { value: new THREE.Color('#F4E022') },
        holeColor: { value: new THREE.Color('#222222') }
    },
    lights: true,
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        #include <common>
        #include <lights_pars_begin>
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position; // 取得模型表面每個像素的原始 3D 座標
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 holes[40];
        uniform float holeRadius;
        uniform vec3 ballColor;
        uniform vec3 holeColor;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        #include <common>
        #include <lights_pars_begin>
        
        void main() {
            bool isHole = false;
            
            // 檢查目前這個像素點，距離 40 個孔洞中心的任何一個是否小於孔半徑
            // 在 3D 空間中直接計算距離，畫出來的孔洞絕對不會變形
            for(int i = 0; i < 40; i++) {
                float dist = distance(normalize(vPosition), holes[i]);
                if(dist < holeRadius) {
                    isHole = true;
                    break;
                }
            }
            
            // 如果在孔洞範圍內就塗黑，否則塗黃
            vec3 finalColor = isHole ? holeColor : ballColor;
            
            // 加上簡易的立體光照效果
            float lightIntensity = max(dot(vNormal, normalize(vec3(5.0, 10.0, 7.0))), 0.0);
            vec3 diffuse = finalColor * (lightIntensity * 0.8 + 0.6); 
            
            gl_FragColor = vec4(diffuse, 1.0);
        }
    `
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
    defaultCameraPos.set(0, 0, getCameraZ());
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
    
    // 視窗縮放時，只更新相機的 Z 軸距離，Y 軸永遠保持為 0
    const newZ = getCameraZ();
    camera.position.z = newZ;
    defaultCameraPos.set(0, 0, newZ); 
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();