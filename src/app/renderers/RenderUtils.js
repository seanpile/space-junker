
import { Vector2 } from 'three';

export function adjustCoordinates(target, focus, position) {
  if (!position) {
    return position;
  }

  if (!focus) {
    return target.copy(position);
  }

  return target.subVectors(position, focus.position);
}

export function toNormalizedDeviceCoordinates(location) {
  return new Vector2(
    ((location.x / window.innerWidth) * 2) - 1,
    -((location.y / window.innerHeight) * 2) + 1);
}

export function hitTest(raycaster, camera, target, objectsToTest, callback) {

  raycaster.setFromCamera(toNormalizedDeviceCoordinates(target), camera);
  const intersection = raycaster.intersectObjects(objectsToTest);
  callback(intersection);

}
