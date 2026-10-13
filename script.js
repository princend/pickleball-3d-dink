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

// --- 3. 製作 40孔匹克球 (真實透明孔洞 + 雙面渲染) ---
const ballGeo = new THREE.SphereGeometry(1, 128, 128); // 增加面數讓球體更圓滑

// 建立 40 個孔洞的三維法向量 (使用費氏球面分佈)
const holeVectors = [];
const samples = 40;
const phi = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2; 
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    
    holeVectors.push(new THREE.Vector3(x, y, z));
}

// 將 40 個點轉換為 shader 可以吃進去的 uniform 陣列
const holesFlat = [];
holeVectors.forEach(v => {
    holesFlat.push(v.x, v.y, v.z);
});

// 改良版材質：透明孔洞 + 雙面渲染
const ballMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, // 讓球體內側也能渲染，這樣看穿孔洞時才會有立體感
    uniforms: {
        ...THREE.UniformsLib.lights,
        holes: { value: holesFlat }, 
        holeRadius: { value: 0.12 }, // 縮小孔洞半徑以符合真實比例
        ballColor: { value: new THREE.Color('#E1FF00') } // 淺螢光綠配色
    },
    lights: true,
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        #include <common>
        #include <lights_pars_begin>
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position; 
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 holes[40];
        uniform float holeRadius;
        uniform vec3 ballColor;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        #include <common>
        #include <lights_pars_begin>
        
        void main() {
            // 檢查是否在孔洞內
            for(int i = 0; i < 40; i++) {
                float dist = distance(normalize(vPosition), holes[i]);
                if(dist < holeRadius) {
                    discard; // 直接捨棄這個像素，挖出真正的全透明孔洞
                }
            }
            
            // 判斷是球的外表面還是內表面 (因為設定了 DoubleSide)
            vec3 normal = gl_FrontFacing ? vNormal : -vNormal;
            // 內側稍微調暗一點，增加從孔洞看進去的立體感
            vec3 color = gl_FrontFacing ? ballColor : ballColor * 0.7;
            
            float lightIntensity = max(dot(normal, normalize(vec3(5.0, 10.0, 7.0))), 0.0);
            vec3 diffuse = color * (lightIntensity * 0.8 + 0.6); 
            
            gl_FragColor = vec4(diffuse, 1.0);
        }
    `
});

const pickleball = new THREE.Mesh(ballGeo, ballMat);
scene.add(pickleball);

// --- 4. 擊球點與粗體箭頭 ---
const pointGeo = new THREE.SphereGeometry(0.08, 32, 32);
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const hitPoint =