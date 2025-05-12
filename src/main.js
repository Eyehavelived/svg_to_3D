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
const meshGroup = new THREE.Group();
const lineGroup = new THREE.Group();
const allGroup = new THREE.Group();

allGroup.add(lineGroup, meshGroup)

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



scene.add(meshGroup)


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

// event listener for when resizing window
window.addEventListener('resize', () =>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight);
})

// add event listener for opening svg folder
document.getElementById('folderInput').addEventListener('change', importSVG);

// render the scene
const renderloop = () => {
  controls.update();  renderer.render(scene, camera);
  window.requestAnimationFrame(renderloop);
};

const buttons = {
  clearScene: () => clearAll(scene),
  centerGroup: () => centerObject(allGroup),
  exportGLTF: () => exportGLTF(meshGroup),
  exportSTL: () => exportSTL(meshGroup),
  importSVG: () => document.getElementById('folderInput').click()
};

const params = {
  groupReScale: 0.01,
  layerDepth: 0.1,
}

const gui = new GUI();
let settings = gui.addFolder('Settings')
settings.add(params, 'groupReScale').name('Scale Imports to:')
settings.add(params, 'layerDepth').name('Resize Layer depth to:')

let importFiles = gui.addFolder('Import')
importFiles.add(buttons, 'importSVG').name('Import SVG Folder')
importFiles.add(buttons, 'centerGroup').name('Center Group')

let exportFile = gui.addFolder('Export');
exportFile.add(buttons, 'exportGLTF').name('Export GLTF')
exportFile.add(buttons, 'exportSTL').name('Export STL')
exportFile.open();

let cleanUp = gui.addFolder('Clean Up')
cleanUp.add(buttons, 'clearScene').name('Clear Scene')


renderloop();


function clearAll(parent) {
  // Currently doesn't seem to work correctly - removes everything from the scene but 
  // importing SVGs shows nothing rendered even though they are showing up in the Group's children array

  // Does not cover all the cases, and will need to be updated to cover scenarios I haven't 
  // considered due to a lack of knowledge

  // If parent is a mesh, removes all textures and material from the mesh
  if (parent.geometry) {
    parent.geometry.dispose();
  };

  if (parent.material) {
    if (Array.isArray(parent.material)) {
      parent.material.forEach(m => {
        // checks through each material property to see if it's a texture
        for (let key in m) {
          if (m[key]?.isTexture) {
            m[key].dispose();
          }
        }
        m.dispose();
      });
    } else {
      for (let key in parent.material) {
        if (parent.material[key]?.isTexture) parent.material[key].dispose();
      }
      parent.material.dispose();
    }
  }
  
  // if parent contains children, then recursively removes children from the parent as well
  if (parent.children) {
    parent.children.forEach(c => clearAll(c))
  }
  parent.clear();

  if (typeof parent.dispose === 'function'){
    parent.dispose();
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}


function importSVG(event) {
  const files = [...event.target.files]
    .filter(file => file.name.endsWith('.svg'))
    .sort((a, b) => {
      return parseInt(a.name) - parseInt(b.name);
    });
  const loader = new SVGLoader();

  files.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const svgText = e.target.result;
      const data = loader.parse(svgText);
      const paths = data.paths;

      paths.forEach((path) => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const material = new THREE.MeshBasicMaterial({
            color: path.color,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);

          const edges = new THREE.EdgesGeometry(geometry);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
          mesh.add(line);

          mesh.position.set(0, 0, index * params.layerDepth);
          mesh.scale.set(params.groupReScale, params.groupReScale, params.groupReScale);
          mesh.rotateZ(Math.PI);
          meshGroup.add(mesh);
          meshGroup.updateMatrixWorld(true);
        });
      });
    };

    reader.readAsText(file);
  });
}

function centerObject(object) {
  // centre the group
  const box = new THREE.Box3().setFromObject(meshGroup);
  const center = new THREE.Vector3();
  box.getCenter(center);
  meshGroup.position.sub(center);
  meshGroup.updateMatrixWorld(true);
  console.log(meshGroup.children.length)
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
    meshGroup,
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