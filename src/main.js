// import './style.css'
// import javascriptLogo from './javascript.svg'
// // import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.js'

// document.querySelector('#app').innerHTML = `
//   <div>
//     <a href="https://vite.dev" target="_blank">
//       <img src="${viteLogo}" class="logo" alt="Vite logo" />
//     </a>
//     <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
//       <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
//     </a>
//     <h1>Hello Vite!</h1>
//     <div class="card">
//       <button id="counter" type="button"></button>
//     </div>
//     <p class="read-the-docs">
//       Click on the Vite logo to learn more
//     </p>
//   </div>
// `

// setupCounter(document.querySelector('#counter'))

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';



// initialize the scene
const scene = new THREE.Scene();
const group = new THREE.Group()

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 1).normalize();
scene.add(light);

// add objects to the scene
const extrudeSettings = {
	steps: 1,
	depth: 10,
	bevelEnabled: false,
	bevelThickness: 1,
	bevelSize: 1,
	bevelOffset: 0,
	bevelSegments: 1
};

const loader = new SVGLoader();
let loadedCount = 0;
const totalSVGs = 4;

for (let i = 1; i <= totalSVGs; i++) {
  loader.load(`./${i}.svg`, (data) => {
    console.log(data)
    const paths = data.paths;
    console.log(paths)
  
    paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path);
      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshBasicMaterial({
          color: path.color,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-0.5, -0.5, i/10);  // Center it manually
        mesh.scale.set(0.01, 0.01, 0.01);  // Downscale large SVGs
        mesh.rotateX(Math.PI)
        console.log(mesh)
        group.add(mesh);
      });
    });
    
    loadedCount++;
  });
}

scene.add(group)


// initialize the camera
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

camera.position.z = 5;

// initialize the renderer
const canvas = document.querySelector("canvas.threejs");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// instantiate the controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
// controls.autoRotate = true;

window.addEventListener('resize', () =>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight);
})

// render the scene
const renderloop = () => {
  controls.update();  renderer.render(scene, camera);
  group.updateMatrixWorld(true);

  if (loadedCount === totalSVGs) {
    // exportSTL(group);
    // exportGLTF(group)
  }

  window.requestAnimationFrame(renderloop);
};

renderloop();


function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}


function exportSTL(input) {
  const exporter = new STLExporter();
  const result = exporter.parse(input, { binary: true });

  const blob = new Blob([result], { type: 'application/octet-stream' });
  
  download(blob, "model.stl")
}

function exportGLTF(input) {

  const gltfExporter = new GLTFExporter();

  const options = {
    trs: false,
    onlyVisible: true,
    binary: false,
    truncateDrawRange: true,
    embedImages: true,
  };

  gltfExporter.parse(
    group,
    (result) => {
      let output;
      let blob;
      if (result instanceof ArrayBuffer) {
        // If binary format (.glb)
        output = result;
        blob = new Blob([output], { type: 'application/octet-stream' });
      } else {
        // If JSON format (.gltf)
        output = JSON.stringify(result, null, 2);
        blob = new Blob([output], { type: 'application/json' });
      }
  
      download(blob, result instanceof ArrayBuffer ? 'model.glb' : 'model.gltf')
    },
    options
  );

}