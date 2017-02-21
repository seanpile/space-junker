import * as THREE from 'three';

// Textures
const TEXTURES = {
  'moon': require('../img/moonmap.jpg'),
  'earth': require('../img/earthmap.jpg'),
  'earthspec': require('../img/earthspec.jpg'),
  'earthbump': require('../img/earthbump.jpg'),
  'jupiter': require('../img/jupitermap.jpg'),
  'saturn': require('../img/saturnmap.jpg'),
  'mercury': require('../img/mercurymap.jpg'),
  'venus': require('../img/venusmap.jpg'),
  'mars': require('../img/marsmap.jpg'),
  'pluto': require('../img/plutomap.jpg'),
  'neptune': require('../img/neptunemap.jpg'),
  'uranus': require('../img/uranusmap.jpg'),
  'lensflare': require('../img/lensflare.png'),
  'rock1': require('../models/rock1/ArmGra05.jpg'),
};

const MODELS = {
  'rock1': require('../models/rock1.dae'),
}

export default function BaseRenderer(textureLoader, modelLoader, state) {
  this.textureLoader = textureLoader;
  this.modelLoader = modelLoader;
  this.state = state;
};

// Allow renderers to act on changes to the user interface
Object.assign(BaseRenderer.prototype, THREE.EventDispatcher.prototype);

/**
 *
 */
BaseRenderer.prototype._onWindowResize = function (originalHeight, originalFov) {
  const tanFOV = Math.tan(((Math.PI / 180) * originalFov / 2));
  return (event) => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / originalHeight));

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

};

BaseRenderer.prototype._loadTextures = function () {
  return Promise.all(Object.entries(TEXTURES)
      .map(([key, value]) => {
        return new Promise((resolve, reject) => {
          this.textureLoader.load(value,
            (texture) => {
              resolve([key, texture]);
            });
        });
      }))
    .then(values => {
      return Promise.resolve(new Map(values));
    });
};

BaseRenderer.prototype._loadModels = function () {
  return Promise.all(Object.entries(MODELS)
      .map(([key, value]) => {
        return new Promise((resolve, reject) => {
          this.modelLoader.load(value,
            (model) => {
              resolve([key, model]);
            });
        });
      }))
    .then(values => {
      return Promise.resolve(new Map(values));
    });
};

BaseRenderer.prototype._setupLightSources = function (textures) {
  const ambientLight = new THREE.AmbientLight(0x202020);
  const lensFlare = new THREE.LensFlare(textures.get('lensflare'), 100, 0.0, THREE.AdditiveBlending, new THREE.Color(0xffff00));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.up = new THREE.Vector3(0, 0, 1);

  this.scene.add(ambientLight);
  this.scene.add(directionalLight);
  this.scene.add(lensFlare);

  //return [pointLight];
  return [directionalLight, lensFlare];
};

BaseRenderer.prototype._createSkyBox = function () {

  //This will add a starfield to the background of a scene
  let vertices = [];

  for (let i = 0; i < 20000; i++) {

    let r;

    // Generate stars that are a minimum distance away
    do {
      r = new THREE.Vector3(
        THREE.Math.randFloatSpread(2000),
        THREE.Math.randFloatSpread(2000),
        THREE.Math.randFloatSpread(2000))
    } while (r.lengthSq() < 100)

    vertices.push(r.x, r.y, r.z);
  }

  let starsGeometry = new THREE.BufferGeometry();
  starsGeometry.addAttribute('position',
    new THREE.BufferAttribute(Float32Array.from(vertices), 3));

  let starsMaterial = new THREE.PointsMaterial({
    color: 0x888888
  })

  let starField = new THREE.Points(starsGeometry, starsMaterial);
  starField.matrixAutoUpdate = false;

  return starField;
};
