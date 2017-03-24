import { Curve, Vector2 } from 'three';

function ParabolaCurve(x, y, p, startAngle = -Math.PI / 2, endAngle = Math.PI / 2) {
  this.offsetX = x;
  this.offsetY = y;
  this.p = p;
  this.startAngle = startAngle;
  this.endAngle = endAngle;
}

ParabolaCurve.prototype = Object.create(Curve.prototype);
ParabolaCurve.prototype.constructor = ParabolaCurve;

ParabolaCurve.prototype.getPoint = function (t) {

  const deltaAngle = this.endAngle - this.startAngle;
  const angle = this.startAngle + (t * deltaAngle);

  console.log(angle);

  const r = 2 * this.p * (Math.cos(angle) / Math.pow(Math.sin(angle), 2));
  const x = this.offsetX - (r * Math.cos(angle));
  const y = this.offsetY + (r * Math.sin(angle));
  const point = new Vector2(x, y);

  return point;
};

export default ParabolaCurve;
