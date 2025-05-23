import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


// initialize the scene
const scene = new THREE.Scene();
const meshGroup = new THREE.Group();

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 1).normalize();
scene.add(light);

const extrudeSettings = {
	steps: 1,
	depth: 10,
	bevelEnabled: false,
	bevelThickness: 1,
	bevelSize: 1,
	bevelOffset: 0,
	bevelSegments: 1
};

const layerDepths = {}
const initialLayerDepths = {}

const buttons = {
  transformGroup: () => rescaleObject(meshGroup),
  centerGroup: () => centerObject(meshGroup),
  exportGLTF: () => exportGLTF(meshGroup),
  exportSTL: () => exportSTL(meshGroup),
  importSVG: () => document.getElementById('folderInput').click()
};

const params = {
  useGlobalDepth: false,
  groupReScale: 1.0,
  layerDepth: extrudeSettings.depth,
  extrudeDepth: extrudeSettings.depth
}

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
  alpha: true,
});
renderer.setClearColor(0x000000, 0);
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

const gui = new GUI();
let settings = gui.addFolder('Settings')
settings.add(params, 'groupReScale', 0.010, 0.1).name('Scale Imports to:').step(0.001).onChange(() => rescaleObject(meshGroup))
const initialExtrudeSetting = settings.add(extrudeSettings, 'depth', 1, 100).step(1).name('Initial Extrude Depth:')

let importFiles = gui.addFolder('Import')
const useGlobalLayerDepthCheckbox = importFiles.add(params, 'useGlobalDepth').name('Use extrude depth for all layers')
const importFilesButton = importFiles.add(buttons, 'importSVG').name('Import SVG Folder')
importFiles.add(buttons, 'centerGroup').name('Center Group')

let exportFile = gui.addFolder('Export');
exportFile.add(buttons, 'exportGLTF').name('Export GLTF')
exportFile.add(buttons, 'exportSTL').name('Export STL')
exportFile.open();

let layerDepthControls = settings.addFolder('Layer Depth');

renderloop();


function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}


function importSVG(event) {
  // Finalise initial extrude value
  useGlobalLayerDepthCheckbox.destroy();
  initialExtrudeSetting.destroy();

  // Remove import button
  importFilesButton.destroy();

  // Set controller to a different reference
  params.extrudeDepth = extrudeSettings.depth;


  const files = [...event.target.files]
    .filter(file => file.name.endsWith('.svg'))
    .sort((a, b) => {
      return parseInt(a.name) - parseInt(b.name);
    });
  const loader = new SVGLoader();

  if (params.useGlobalDepth) {
    layerDepthControls.destroy()
    settings.add(params, 'extrudeDepth', 1, 100).name('Global Extrude Depth').step(1).onChange((value) => {
      previewNewExtrusion(meshGroup)
    })
  } else {
    for (let i = 0; i < files.length; i++) {
      initialLayerDepths[i] = params.extrudeDepth;
      layerDepths[i] = params.extrudeDepth;
    }
  }

  files.forEach((file, index) => {
    const reader = new FileReader();
    const layer = new THREE.Group;
    layer.name = `${index}`

    if (!params.useGlobalDepth) {
      layerDepthControls.add(layerDepths, index, 0, 100).step(1).name(`${index}`).onChange((value) => {
        layerDepths[index] = value
        moveLayers(meshGroup)
        previewNewExtrusion(meshGroup)
      })
    }

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
          line.name = "line"
          
          mesh.add(line); // Turns out this has no visible impact on the GLTF export
          // Store mesh shape for replacing geometry later
          mesh.userData.shape = shape

          // mesh.position.z = index * (extrudeSettings.depth);
          // mesh.scale.set(params.groupReScale, params.groupReScale, params.groupReScale);
          mesh.rotateZ(Math.PI);
          // meshGroup.add(mesh);
          layer.add(mesh)
          // meshGroup.updateMatrixWorld(true);
        });
      }); 
      meshGroup.add(layer)
      if (index === files.length - 1) {
        moveLayers(meshGroup)
        centerObject(meshGroup)
      }
    };
    reader.readAsText(file);
  });
}

function rescaleObject(object) {
  object.scale.set(params.groupReScale, params.groupReScale, params.groupReScale);
  object.updateMatrixWorld(true)
}


function moveLayers(group) {
  group.children
  .sort((a, b) => {
    return parseInt(a.name) - parseInt(b.name);
  })
    .forEach((layer, index) => {
      // Add the depth of all preceding layers together from layerDepths
      layer.position.z = Array.from({length: index}, (_, i) => i)
                          .reduce((total, key) => total + (layerDepths[key] || 0), 0);
  })
}

function centerObject(group) {
  // save & temporarily neutralise the scale
  const savedScale = group.scale.clone();
  group.scale.set(1, 1, 1);
  group.updateMatrixWorld(true);
  
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  
  group.children.forEach((child) => {
    child.position.sub(center);
  });
  group.scale.copy(savedScale);
  group.updateMatrixWorld(true);
}

async function finaliseExtrudeGeometries(group) {
  // Fixes an issue where one mesh's geometry has incorrect depth
  await updateExtrudeDepth()

  group.children.forEach((layer) => {
    layer.children.forEach((mesh) => {
      mesh.geometry.dispose()
      mesh.geometry = new THREE.ExtrudeGeometry(mesh.userData.shape, extrudeSettings)

      mesh.children.forEach((child) => {
        if (child.name === "line") {
          child.dispose()
        }
      })

      const edges = new THREE.EdgesGeometry(mesh.geometry);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
      line.name = "line"
      
      mesh.add(line);
    })
  })
  moveLayers(group)
}

async function updateExtrudeDepth() {
  params.extrudeDepth = params.extrudeDepth;
}

function previewNewExtrusion(group) {
  if (params.useGlobalDepth) {
    const scale = params.extrudeDepth / extrudeSettings.depth // newDepth / initialDepth
    group.children
    .forEach((layer) => {
      layer.scale.z = scale;
    })
  } else {
    group.children
    .forEach((layer) => {
      let i = parseInt(layer.name)
      const scale = layerDepths[i] / initialLayerDepths[i]
      layer.scale.z = scale;
    })
  }
  group.updateMatrixWorld(true);
}

function exportSTL(group) {
  if (params.extrudeDepth !== extrudeSettings.depth) {
    finaliseExtrudeGeometries(group)
  }
  const exporter = new STLExporter();
  const result = exporter.parse(group, { binary: true });

  const blob = new Blob([result], { type: 'application/octet-stream' });
  
  download(blob, "model.stl")
}

function exportGLTF(group) {
  if (params.extrudeDepth !== extrudeSettings.depth) {
    finaliseExtrudeGeometries(group)
  }

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