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
  'apollo': require('../models/apollo/OldGlory.jpg'),
  'navball': require('../img/navball.png'),
};

const MODELS = {
  'rock1': require('../models/rock1.dae'),
  'apollo': require('../models/apollo.dae'),
}

export default function BaseRenderer(resourceLoader, state) {
  this.resourceLoader = resourceLoader;
  this.state = state;
};

// Allow renderers to act on changes to the user interface
Object.assign(BaseRenderer.prototype, THREE.EventDispatcher.prototype);

/**
 *
 */
BaseRenderer.prototype._onWindowResize = function (cameras, originalHeight, originalFov) {
  const tanFOV = Math.tan(((Math.PI / 180) * originalFov / 2));
  return (event) => {

    cameras.forEach((camera) => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / originalHeight));

      camera.updateProjectionMatrix();
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
};

BaseRenderer.prototype._loadTextures = function () {
  const all_keys = Object.keys(TEXTURES);

  return Promise.all(all_keys
      .map((key) => this.resourceLoader.loadTexture(TEXTURES[key]))
    )
    .then(values => {
      return Promise.resolve(new Map(values.map(([url, texture], idx) => [all_keys[idx], texture])));
    });
};

BaseRenderer.prototype._loadModels = function () {
  const all_keys = Object.keys(MODELS);

  return Promise.all(all_keys
      .map((key) => this.resourceLoader.loadModel(MODELS[key]))
    )
    .then(values => {
      return Promise.resolve(new Map(values.map(([url, model], idx) => [all_keys[idx], model])));
    });
};

BaseRenderer.prototype._setupLightSources = function () {
  const ambientLight = new THREE.AmbientLight(0x202020);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.up = new THREE.Vector3(0, 0, 1);

  this.scene.add(ambientLight);
  this.scene.add(directionalLight);

  return directionalLight;
};

BaseRenderer.prototype._createSkyBox = function () {

  //This will add a starfield to the background of a scene
  const stars = [{
      color: 'blue',
      number: 500,
    },
    {
      color: 'red',
      number: 500,
    },
    {
      color: 0x888888,
      number: 10000,
    },
    {
      color: 0xdddddd,
      number: 10000
    }
  ]

  const skyBox = new THREE.Group();

  stars.forEach(({
    color,
    number
  }) => {

    const vertices = [];
    for (let i = 0; i < number; i++) {

      let r;

      // Generate stars that are a minimum distance away
      do {
        r = new THREE.Vector3(
          THREE.Math.randFloatSpread(3000),
          THREE.Math.randFloatSpread(3000),
          THREE.Math.randFloatSpread(3000))
      } while (r.lengthSq() < 500)

      vertices.push(r.x, r.y, r.z);
    }

    let starsGeometry = new THREE.BufferGeometry();
    starsGeometry.addAttribute('position',
      new THREE.BufferAttribute(Float32Array.from(vertices), 3));

    let starsMaterial = new THREE.PointsMaterial({
      color: color,
      size: Math.random() * 0.8 + 0.2
    });

    let field = new THREE.Points(starsGeometry, starsMaterial);
    field.matrixAutoUpdate = false;
    skyBox.add(field);
  });

  skyBox.matrixAutoUpdate = false;
  return skyBox;
};
