import * as THREE from 'three';

// Textures
import map_sun from '../../docs/img/sunmap.jpg';
import map_moon from '../../docs/img/moonmap4k.jpg';
import map_earth from '../../docs/img/earthmap8k.jpg';
import map_jupiter from '../../docs/img/jupitermap.jpg';
import map_saturn from '../../docs/img/saturnmap.jpg';
import map_mercury from '../../docs/img/mercurymap.jpg';
import map_venus from '../../docs/img/venusmap.jpg';
import map_mars from '../../docs/img/marsmap.jpg';
import map_pluto from '../../docs/img/plutomap.jpg';
import map_neptune from '../../docs/img/neptunemap.jpg';
import map_uranus from '../../docs/img/uranusmap.jpg';
import lensflare from '../../docs/img/lensflare.png';

const TEXTURES = {
  'sun': map_sun,
  'earth': map_earth,
  'moon': map_moon,
  'jupiter': map_jupiter,
  'saturn': map_saturn,
  'mercury': map_mercury,
  'mars': map_mars,
  'venus': map_venus,
  'pluto': map_pluto,
  'neptune': map_neptune,
  'uranus': map_uranus,
  'lensflare': lensflare,
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

  for (let i = 0; i < 20000; i++) {

    let r;

    // Generate stars that are at least 5 AU away
    do {
      r = new THREE.Vector3(
        THREE.Math.randFloatSpread(2000),
        THREE.Math.randFloatSpread(2000),
        THREE.Math.randFloatSpread(2000))
    } while (r.lengthSq() < 50)

    vertices.push(r.x, r.y, r.z);
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
