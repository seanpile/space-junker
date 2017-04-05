import * as THREE from 'three';

import { AU } from '../../Constants';
import Body from './Body';
import Trajectory from './Trajectory';

const childrenOf = (threeObj) => {
  if (!threeObj.children || threeObj.children.length === 0) {
    return [];
  }

  const descendants = [];
  threeObj.children.forEach((obj) => {
    descendants.push(obj);
    descendants.push(...childrenOf(obj));
  });

  return descendants;
};

export default class Ship extends Body {

  constructor(body, threeObject, trajectory) {
    super(body, threeObject, trajectory);
    this.ship = threeObject;
  }


  applyOrientation() {
    this.ship.setRotationFromQuaternion(this.body.motion.rotation);
  }

  static createShip(body, { models, fonts }, mapView = false) {

    if (mapView) {
      const trajectory = Trajectory.createTrajectory(body, fonts);
      const mapMarker = new THREE.Mesh(
        new THREE.SphereBufferGeometry(body.constants.radius, 32, 32),
        new THREE.MeshBasicMaterial({ color: 'gray' }));

      return new Ship(body, mapMarker, trajectory);
    }

    const modelObj = models.get(body.model);
    const scale = 1 / AU;
    const threeObj = modelObj.scene.clone(true);

    threeObj.scale.set(scale, scale, scale);
    threeObj.receiveShadow = true;
    threeObj.castShadow = true;
    childrenOf(threeObj)
        .forEach((obj) => {
          obj.receiveShadow = true;
          obj.castShadow = true;
        });

    return new Ship(body, threeObj);
  }

}
