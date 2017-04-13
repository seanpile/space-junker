
import * as THREE from 'three';

const { sin, cos } = Math;

const maneuverTexture = (() => {

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const canvasSize = 1024;
  const sphereRadius = 128;
  const spokeLength = 100;
  const numSpokes = 10;
  const lineWidth = 32;

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.closePath();

  // ctx.setLineDash([15, 10]);

  ctx.strokeStyle = 'rgb(255, 155, 56)';
  ctx.beginPath();
  ctx.moveTo((canvasSize / 2) + sphereRadius, canvasSize / 2);
  ctx.lineWidth = lineWidth;
  ctx.arc(canvasSize / 2, canvasSize / 2, sphereRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.closePath();

  let angle = 0;
  do {
    ctx.beginPath();

    const sphereLocation = new THREE.Vector2(
      (canvasSize / 2) + (sphereRadius * cos(angle)),
      (canvasSize / 2) + (sphereRadius * sin(angle)));

    ctx.moveTo(sphereLocation.x, sphereLocation.y);

    // if (angle % (Math.PI / 2) === 0) {
    //   ctx.lineTo(
    //     sphereLocation.x + (2 * spokeLength * cos(angle)),
    //     sphereLocation.y + (2 * spokeLength * sin(angle)));
    // } else {
    //   ctx.lineTo(
    //     sphereLocation.x + (spokeLength * cos(angle)),
    //     sphereLocation.y + (spokeLength * sin(angle)));
    // }

    ctx.lineTo(
      sphereLocation.x + (spokeLength * cos(angle)),
      sphereLocation.y + (spokeLength * sin(angle)));

    ctx.stroke();
    ctx.closePath();

    angle += (2 * Math.PI) / numSpokes;

  } while (angle < 2 * Math.PI);

  return new THREE.CanvasTexture(canvas);
})();

export default class UIManeuver extends THREE.Sprite {

  constructor(maneuver, spriteMaterial) {
    super(spriteMaterial);
    this.maneuver = maneuver;
  }

  static createManeuver(maneuver) {

    const spriteMaterial = new THREE.SpriteMaterial({
      map: maneuverTexture,
      depthFunc: THREE.AlwaysDepth,
      color: 0xffffff,
    });

    return new UIManeuver(maneuver, spriteMaterial);
  }

}
