import * as THREE from 'three';

import { AU } from '../../Constants';
import UIBody from './UIBody';
import UIOrbit from './UIOrbit';

export default class UIPlanet extends UIBody {

  applyPlanetaryRotation() {
    const orbit = this.body.orbit;

    const planet = this.sphere;
    planet.rotation.set(0, 0, 0);
    planet.rotateZ(orbit.omega);
    planet.rotateX(orbit.I);
    planet.rotateZ(orbit.argumentPerihelion);
    planet.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    planet.rotateOnAxis(
     new THREE.Vector3(0, 0, 1),
     -((this.body.constants.axial_tilt || 0) * Math.PI) / 180);
    planet.rotateY(this.body.constants.rotation);
  }

  static createPlanet(body, { textures, fonts }, mapView = false) {

    let material;
    if (body.name === 'sun') {
      material = new THREE.MeshBasicMaterial({ color: 'yellow' });
    } else {
      material = new THREE.MeshPhongMaterial();
      material.precision = 'highp';
      if (textures.has(`${body.name}bump`)) {
        material.bumpMap = textures.get(`${body.name}bump`);
        material.bumpScale = 200000 / AU;
      }

      if (textures.has(`${body.name}spec`)) {
        material.specularMap = textures.get(`${body.name}spec`);
        material.specular = new THREE.Color('grey');
      }

      if (textures.has(body.name)) {
          // Reduce harsh glare effect of the light source (default 30 -> 1);
        material.map = textures.get(body.name);
        material.shininess = 1;
      }
    }

    const numSegments = mapView ? 32 : 256;

    const threeBody = new THREE.Mesh(
        new THREE.SphereBufferGeometry(body.constants.radius, numSegments, numSegments),
        material);

    threeBody.receiveShadow = true;
    threeBody.castShadow = true;

    if (mapView) {
      const orbit = UIOrbit.createOrbit(body, fonts);
      return new UIPlanet(body, threeBody, orbit);
    }

    return new UIPlanet(body, threeBody);
  }

}
