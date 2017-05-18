import * as THREE from 'three';
import ColladaLoader from 'three-collada-loader';

const dev = false;

const SKYBOX_URL = require('../../img/starscape.png'); // eslint-disable-line global-require

// Textures
const TEXTURES = {
  moon: require('../../img/moonmap.jpg'),  // eslint-disable-line global-require
  earth: require('../../img/earthmap.jpg'), // eslint-disable-line global-require
  earthspec: require('../../img/earthspec.jpg'), // eslint-disable-line global-require
  earthbump: require('../../img/earthbump.jpg'), // eslint-disable-line global-require
  jupiter: require('../../img/jupitermap.jpg'), // eslint-disable-line global-require
  saturn: require('../../img/saturnmap.jpg'), // eslint-disable-line global-require
  mercury: require('../../img/mercurymap.jpg'), // eslint-disable-line global-require
  venus: require('../../img/venusmap.jpg'), // eslint-disable-line global-require
  mars: require('../../img/marsmap.jpg'), // eslint-disable-line global-require
  pluto: require('../../img/plutomap.jpg'), // eslint-disable-line global-require
  neptune: require('../../img/neptunemap.jpg'), // eslint-disable-line global-require
  uranus: require('../../img/uranusmap.jpg'), // eslint-disable-line global-require
  lensflare: require('../../img/lensflare.png'), // eslint-disable-line global-require
  apollo: require('../../models/apollo/OldGlory.jpg'), // eslint-disable-line global-require
  navball: require('../../img/navball.png'), // eslint-disable-line global-require
  skybox: require('../../img/starscape.png'), // eslint-disable-line global-require
};

const MODELS = { apollo: require('../../models/apollo.dae') };

const FONTS = { helvetiker: new THREE.Font(require('../../fonts/helvetiker_regular.typeface.json')) };

class CanvasTextureLoader {

  load(key, callback) {

    const colour = (key === 'img/navball.png' ? 'lightgray' : 'lightblue');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    callback(texture);
  }

}

class MockModelLoader {

  constructor() {
    this.threeBody = new THREE.Mesh(
      new THREE.ConeGeometry(50, 200, 32, 32),
      new THREE.MeshPhongMaterial({ color: 'lightgray' }));
  }

  load(key, callback) {
    callback({ scene: this.threeBody });
  }

}

function ResourceLoader() {
  let textureLoader = new THREE.TextureLoader();
  let modelLoader = new ColladaLoader();
  if (dev) {
    textureLoader = new CanvasTextureLoader();
    modelLoader = new MockModelLoader();
  } else {
    textureLoader = new THREE.TextureLoader();
    modelLoader = new ColladaLoader();
    modelLoader.options.convertUpAxis = true;
    modelLoader.options.upAxis = 'Z';
  }

  this.textureLoader = textureLoader;
  this.modelLoader = modelLoader;
  this.skyboxLoader = new THREE.CubeTextureLoader();

  this.textureCache = new Map();
  this.modelCache = new Map();
}

ResourceLoader.prototype.loadSkybox = function () {
  return this.skyboxLoader.load(new Array(6).fill(SKYBOX_URL));
};

ResourceLoader.prototype.loadFonts = function () {
  return Promise.resolve(FONTS);
};

ResourceLoader.prototype.loadTextures = function () {
  const allKeys = Object.keys(TEXTURES);

  return Promise.all(allKeys
      .map(key => this._loadTexture(TEXTURES[key])),
    )
      .then(values => Promise.resolve(
      new Map(values.map(([url, texture], idx) => [allKeys[idx], texture]))));
};

ResourceLoader.prototype.loadModels = function () {
  const allKeys = Object.keys(MODELS);

  return Promise.all(allKeys
      .map(key => this._loadModel(MODELS[key])),
    )
      .then(values => Promise.resolve(
      new Map(values.map(([url, model], idx) => [allKeys[idx], model]))));
};

ResourceLoader.prototype._loadTexture = function (key) {
  return new Promise((resolve, reject) => {
    const cache = this.textureCache;

    if (cache.has(key)) {
      resolve([key, cache.get(key)]);
    } else {
      this.textureLoader.load(key,
                              (texture) => {
                                cache.set(key, texture);
                                resolve([key, texture]);
                              },
                              () => {},
                              (error) => {
                                console.error(error);
                                reject(`Failed to load texture '${key}'`);
                              });
    }
  });
};

ResourceLoader.prototype._loadModel = function (key) {
  return new Promise((resolve, reject) => {
    const cache = this.modelCache;
    if (cache.has(key)) {
      resolve([key, cache.get(key)]);
    } else {
      this.modelLoader.load(key,
                            (model) => {
                              cache.set(key, model);
                              resolve([key, model]);
                            },
                            () => {},
                            (error) => {
                              console.error(error);
                              reject(`Failed to load model '${key}'`);
                            });
    }
  });
};


export default ResourceLoader;
