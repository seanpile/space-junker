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

export function SphereOfInfluence(body) {
    // Can only calculate Hill Sphere between two bodies
  if (!body.primary) {
    return undefined;
  }

  const m = body.mass;
  const M = body.primary.mass;
  const semiMajorAxis = body.orbit.a;
  const e = body.orbit.e;
  const soi = semiMajorAxis * (1 - e) * Math.pow(m / (3 * M), 1 / 3);

  return soi;
}

export function CalculateMeanAnomaly(L, w, perturbations, T) {
  let M = L - w;
  if (perturbations) {
    M += (perturbations.b * (T ** 2)) +
        (perturbations.c * Math.cos(perturbations.f * T)) +
        (perturbations.s * Math.sin(perturbations.f * T));
  }

  M %= 360;
  if (M > 180) {
    M -= 360;
  } else if (M < -180) {
    M = 360 + M;
  }

  return M;
}

function nearParabolic(E, e) {
  const { abs } = Math;
  const anom2 = (e > 1 ? (E ** 2) : -(E ** 2));
  let term = (e * anom2 * E) / 6;
  let rval = ((1 - e) * E) - term;
  let n = 4;

  while (abs(term) > 1e-15) {
    term *= anom2 / (n * (n + 1));
    rval -= term;
    n += 2;
  }

  return rval;
}

/**
 * Solve Kepler's Equation for a given eccentricity (e) and Initial
 * Mean Anomaly (M0)
 *
 * Adapted from https://www.projectpluto.com/kepler.htm
 */
export function CalculateEccentricAnomaly(e, M0) {
  if (M0 === 0) {
    return 0;
  }

  const { PI, asinh, atan2, abs, exp, log, sin, sinh, cos, cosh } = Math;

  const TOL = 1e-12;
  const MIN_TOL = 1e-15;
  const MAX_TIMES = 10;

  let numTimes = 0;
  let thresh = 0;
  let isNegative = false;
  let offset = 0;
  let curr = 0;
  let deltaCurr = 1;
  let err = 0;
  let M = M0;

  if (e < 1) {
    if (M < -PI || M > PI) {
      let mod = M % (2 * PI);
      if (mod > PI) {
        mod -= 2 * PI;
      } else if (mod < -PI) {
        mod += 2 * PI;
      }

      offset = M - mod;
      M = mod;
    }

    if (e < 0.99999) {
      curr = atan2(sin(M), cos(M) - e);
      do {
        err = (curr - (e * sin(curr)) - M) / (1.0 - (e * cos(curr)));
        curr -= err;
      } while (abs(err) > TOL);
      return curr + offset;
    }
  }

  if (M < 0) {
    M = -M;
    isNegative = true;
  }

  curr = M;
  thresh = TOL * abs(1.0 - e);
  if (thresh < MIN_TOL) {
    thresh = MIN_TOL;
  }
  if (thresh > TOL) {
    thresh = TOL;
  }

  if (M < (PI / 3) || e > 1) {
    let trial = M / abs(1 - e);
    if ((trial ** 2) > (6 * abs(1 - e))) {
      if (M < PI) {
        trial = exp(log(6 * M) / 3);
      } else {
        trial = asinh(M / e);
      }
    }
    curr = trial;
  }

  if (e < 1) {
    while (abs(deltaCurr) > thresh) {
      if (numTimes > MAX_TIMES) {
        err = nearParabolic(curr, e) - M;
      } else {
        err = curr - (e * sin(curr)) - M;
      }

      deltaCurr = -err / (1 - (e * cos(curr)));
      curr += deltaCurr;
      numTimes += 1;
    }
  } else {
    while (abs(deltaCurr) > thresh) {
      if (numTimes > MAX_TIMES) {
        err = -nearParabolic(curr, e) - M;
      } else {
        err = (e * sinh(curr)) - curr - M;
      }

      deltaCurr = -err / ((e * cosh(curr)) - 1);
      curr += deltaCurr;
      numTimes += 1;
    }
  }

  return isNegative ? offset - curr : offset + curr;
}

export const Eccentricity = (function () {

  const r = new Vector3();
  const v = new Vector3();
  const h = new Vector3();
  const ecc = new Vector3();

  return function _Eccentricity(body, position, velocity) {

    const primary = body.primary;
    const u = primary.constants.u;

    r.subVectors(position, primary.position);
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
