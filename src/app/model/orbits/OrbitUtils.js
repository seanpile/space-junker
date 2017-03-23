import moment from 'moment';
import { Quaternion, Vector3 } from 'three';

const J2000Date = moment('2000-01-01T12:00:00Z');
const J2000Epoch = 2451545.0;

export function JulianDate(t) {
  const date = moment(t);
  const Teph = J2000Epoch + date.diff(J2000Date, 'days', true);
  const T = (Teph - J2000Epoch) / 36525;
  return T;
}

export function EccentricityAt(keplerElements, t) {
  const T = JulianDate(t);
  const e = keplerElements.e[0] + (keplerElements.e[1] * T);
  return e;
}

export const Eccentricity = (function () {

  const r = new Vector3();
  const v = new Vector3();
  const h = new Vector3();
  const ecc = new Vector3();

  return function _Eccentricity(body, position, velocity) {

    const primary = body.primary;
    const u = primary.constants.u;

    r.subVectors(position, primary.derived.position);
    v.copy(velocity);
    h.crossVectors(r, v);
    ecc.crossVectors(v, h)
      .multiplyScalar(1 / u)
      .sub(r.clone()
        .multiplyScalar(1 / r.length()));

    return ecc.length();
  };
}());

export const TransformToEcliptic = (function () {

  const axisZ = new Vector3(0, 0, 1);
  const axisX = new Vector3(1, 0, 0);

  return function _TransformToEcliptic(offset, position, w, omega, I) {

    if (!position) {
      return position;
    }

    const Q1 = new Quaternion()
      .setFromAxisAngle(axisZ, w);
    const Q2 = new Quaternion()
      .setFromAxisAngle(axisX, I);
    const Q3 = new Quaternion()
      .setFromAxisAngle(axisZ, omega);

    const rotation = new Vector3()
      .copy(position)
      .applyQuaternion(Q1)
      .applyQuaternion(Q2)
      .applyQuaternion(Q3);

    if (offset) {
      rotation.add(offset);
    }

    return rotation;
  };
}());
