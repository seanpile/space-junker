import * as THREE from 'three';
import ColladaLoader from 'three-collada-loader';

const dev = true;

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
      new THREE.MeshPhongMaterial({
        color: 'lightgray',
      }));
  }

  load(key, callback) {
    callback({
      scene: this.threeBody,
    });
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

  this.textureCache = new Map();
  this.modelCache = new Map();
}

ResourceLoader.prototype.loadTexture = function (key) {
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

ResourceLoader.prototype.loadModel = function (key) {
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
