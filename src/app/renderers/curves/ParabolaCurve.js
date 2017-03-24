import { Curve, Vector2 } from 'three';

function ParabolaCurve(x, y, p, start, end) {
  this.offsetX = x;
  this.offsetY = y;
  this.p = p;
  this.start = start;
  this.end = end;
}

ParabolaCurve.prototype = Object.create(Curve.prototype);
ParabolaCurve.prototype.constructor = ParabolaCurve;

ParabolaCurve.prototype.getPoint = function (t) {
  const T = this.start + ((this.end - this.start) * t);
  const x = this.offsetX - ((this.p / 2) * (T ** 2));
  const y = this.offsetY + (this.p * T);
  return new Vector2(x, y);
};

export default ParabolaCurve;
