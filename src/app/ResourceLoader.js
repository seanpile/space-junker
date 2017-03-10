import * as THREE from 'three';
import ColladaLoader from 'three-collada-loader';

function ResourceLoader() {

  const textureLoader = new THREE.TextureLoader();
  const modelLoader = new ColladaLoader();
  modelLoader.options.convertUpAxis = true;
  modelLoader.options.upAxis = 'Z';

  this.textureLoader = textureLoader;
  this.modelLoader = modelLoader;

  this.textureCache = new Map();
  this.modelCache = new Map();
};

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
          console.log(error);
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
          console.log(error);
          reject(`Failed to load model '${key}'`);
        });
    }
  });
};

export default ResourceLoader;
