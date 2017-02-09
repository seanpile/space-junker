import * as THREE from 'three';

// Textures
import moonmap from '../img/moonmap4k.jpg';
import earthmap from '../img/earthmap8k.jpg';

const TEXTURES = {
  'earth': earthmap,
  'moon': moonmap,
};

export default function BaseRenderer() {}

BaseRenderer.prototype._loadTextures = function () {
  const loader = new THREE.TextureLoader();
  return Promise.all(Object.entries(TEXTURES)
      .map(([key, value]) => {
        return new Promise((resolve, reject) => {
          loader.load(value,
            (texture) => {
              resolve([key, texture]);
            });
        });
      }))
    .then(values => {
      return Promise.resolve(new Map(values));
    });
};

BaseRenderer.prototype._createSkyBox = function (textures) {

  //This will add a starfield to the background of a scene
  let vertices = [];

  for (let i = 0; i < 10000; i++) {

    let x = THREE.Math.randFloatSpread(2000);
    let y = THREE.Math.randFloatSpread(2000);
    let z = THREE.Math.randFloatSpread(2000);

    x += Math.sign(x) * 100;
    y += Math.sign(y) * 100;
    z += Math.sign(z) * 100;

    vertices.push(x, y, z);
  }

  let starsGeometry = new THREE.BufferGeometry();
  starsGeometry.addAttribute('position',
    new THREE.BufferAttribute(Float32Array.from(vertices), 3));

  let starsMaterial = new THREE.PointsMaterial({
    color: 0x888888
  })

  let starField = new THREE.Points(starsGeometry, starsMaterial);
  return starField;
};
