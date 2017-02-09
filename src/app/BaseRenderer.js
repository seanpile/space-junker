import * as THREE from 'three';

// Textures
import moonmap from '../img/moonmap4k.jpg';
import earthmap from '../img/earthmap8k.jpg';
import sunmap from '../img/sunmap.jpg';

import starfield_top from '../img/starfield-top.png';
import starfield_bottom from '../img/starfield-bottom.png';
import starfield_left from '../img/starfield-left.png';
import starfield_right from '../img/starfield-right.png';
import starfield_front from '../img/starfield-front.png';
import starfield_back from '../img/starfield-back.png';

const TEXTURES = {
  'earth': earthmap,
  'moon': moonmap,
  'sun': sunmap,
  'sf_right': starfield_right,
  'sf_left': starfield_left,
  'sf_top': starfield_top,
  'sf_bottom': starfield_bottom,
  'sf_front': starfield_front,
  'sf_back': starfield_back,
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

  const skyGeometry = new THREE.CubeGeometry(100, 100, 100);
  const materials = [
    textures.get("sf_right"),
    textures.get("sf_left"),
    textures.get("sf_back"),
    textures.get("sf_front"),
    textures.get("sf_top"),
    textures.get("sf_bottom"),
  ];

  const meshMaterials = materials.map((m) => new THREE.MeshBasicMaterial({
    map: m,
    side: THREE.BackSide
  }));

  const skyMaterial = new THREE.MultiMaterial(meshMaterials);
  const skyBox = new THREE.Mesh(skyGeometry, skyMaterial);
  return skyBox;
};
