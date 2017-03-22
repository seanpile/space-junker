
import { Curve, Vector2 } from 'three';

function HyperbolicCurve(x, y, a, b, startAngle = -Math.PI, endAngle = Math.PI, useNegativeArm = false) {
  this.offsetX = x;
  this.offsetY = y;
  this.a = a;
  this.b = b;
  this.startAngle = startAngle;
  this.endAngle = endAngle;
  this.useNegativeArm = useNegativeArm;
}

HyperbolicCurve.prototype = Object.create(Curve.prototype);
HyperbolicCurve.prototype.constructor = HyperbolicCurve;

HyperbolicCurve.prototype.getPoint = function (t) {

  // +/- a * cosh(t), b * sinh(t)

  const deltaAngle = this.endAngle - this.startAngle;
  const sign = this.useNegativeArm ? -1 : 1;

  const angle = this.startAngle + (t * deltaAngle);
  const x = this.offsetX + (sign * this.a * Math.cosh(angle));
  const y = this.offsetY + (this.b * Math.sinh(angle));
  const point = new Vector2(x, y);

  return point;
};

export default HyperbolicCurve;
