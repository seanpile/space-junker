import moment from 'moment';
import {
  AU,
  ALL_BODIES,
} from './Bodies';

import {
  Vector3,
  Quaternion,
  Matrix3,
  Euler,
} from 'three';

const J2000_date = moment('2000-01-01T12:00:00Z');
const J2000_epoch = 2451545.0;

function SolarSystem() {
  this.bodies = Array.from(ALL_BODIES);
  this.initialized = false;
};

SolarSystem.prototype.find = function (bodyId) {
  return this.bodies.find((body) => body.name == bodyId);
};

SolarSystem.prototype.update = function (t, dt) {

  let currentDate = moment(t + dt);
  let T = this._calculateJulianDate(currentDate);

  if (!this.initialized) {
    /**
     * Generate a starting position/velocity from the initial kepler
     * elements
     */
    this.bodies.forEach((body) => {
      let kepler_elements = this._calculateInitialKeplerElements(body, T);
      body.derived = kepler_elements;
    });

    this.initialized = true;
  }

  this.bodies.forEach((body) => {

    let kepler_elements = this._calculateKeplerElementsAtTime(body, t + dt);
    let coords = this._toCartesianCoordinates(body.primary, kepler_elements);
    let position = coords.position;
    let velocity = coords.velocity;

    let body_constants = body.constants;
    let primary = body.primary;
    let derived = body.derived;
    let u = body.primary ? primary.constants.u : 0;
    let offset = body.primary ? primary.derived.position : new Vector3(0, 0, 0);
    let {
      a,
      e,
      I,
      argumentPerihelion,
      omega,
      M,
    } = kepler_elements;

    // Semi-minor axis
    let b = a * Math.sqrt(1 - Math.pow(e, 2));

    // Trajectory Elements
    let periapsis = new Vector3(a * (1 - e), 0, 0);
    let apoapsis = new Vector3(-a * (1 + e), 0, 0);
    let center = new Vector3(periapsis.x - a, 0, 0);

    // Orbital Period and Rotational Period
    let orbital_period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) /
      (u + (body_constants.u || 0)));

    let rotation = (derived.rotation || 0) +
      2 * Math.PI * dt /
      ((body_constants.rotation_period || 1) * 86400e3);

    body.derived = {
      T: T,
      a: a,
      e: e,
      I: I,
      omega: omega,
      argumentPerihelion: argumentPerihelion,
      M: M,
      position: position,
      position_in_plane: coords.position_in_plane,
      velocity: velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      orbital_period: orbital_period,
      rotation: rotation,
      center_in_plane: center,
      center: this._transformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: this._transformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: this._transformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    }

  });

  this.lastTime = t + dt;
};

SolarSystem.prototype._calculateInitialKeplerElements = function (body, T) {

  // Planets are fixed on rails; we simply a
  let kepler_elements = body.kepler_elements;
  let a = kepler_elements.a[0] + kepler_elements.a[1] * T;
  let e = kepler_elements.e[0] + kepler_elements.e[1] * T;
  let I = kepler_elements.I[0] + kepler_elements.I[1] * T;
  let L = kepler_elements.L[0] + kepler_elements.L[1] * T;
  let w = kepler_elements.w[0] + kepler_elements.w[1] * T;
  let omega = kepler_elements.omega[0] + kepler_elements.omega[1] * T;
  let perturbations = kepler_elements.perturbations;
  let M = this._calculateMeanAnomaly(L, w, perturbations, T);
  let argumentPerihelion = w - omega;

  return {
    a: a,
    e: e,
    I: I * Math.PI / 180,
    omega: omega * Math.PI / 180,
    argumentPerihelion: argumentPerihelion * Math.PI / 180,
    M: M * Math.PI / 180,
  };
};

SolarSystem.prototype._calculateKeplerElementsAtTime = function (body, t) {

  let {
    a,
    e,
    I,
    omega,
    argumentPerihelion,
    M
  } = body.derived;

  /**
   * For elliptical orbits, M - M0 = n(t - t0)
   */

  let lastTime = this.lastTime || t;
  let delta = (t - lastTime) / 1000;
  let u = body.primary ? body.primary.constants.u : 0;
  let n = Math.sqrt(u / Math.pow(a, 3));
  M = n * delta + M;

  return {
    a,
    e,
    I,
    omega,
    argumentPerihelion,
    M
  };
};

SolarSystem.prototype._calculateKeplerElementsFromCartesian = function (body) {

  let primary = body.primary;
  let position = body.derived.position;
  let velocity = body.derived.velocity;

  let r = new Vector3()
    .subVectors(position, primary.derived.position);
  let v = new Vector3()
    .subVectors(velocity, primary.derived.velocity);
  let u = primary.constants.u;

  const h = new Vector3()
    .crossVectors(r, v);

  if (h.length() <= 0) {
    console.error("angular momentum is zero!");
  }

  // Semi-Major Axis
  const specificEnergy = v.lengthSq() / 2 - u / r.length();
  const a = -u / (2 * specificEnergy);

  // Eccentricity
  const e_sub = h.lengthSq() / (u * a);
  const e = e_sub > 1 ? 0 : Math.sqrt(1 - e_sub);

  // Inclination, Longitude of the ascending node
  const I = Math.acos(h.z / h.length());
  const omega = Math.atan2(h.x, -h.y);
  if (Math.abs(omega) >= Math.PI) {
    throw new Error('omega jumped');
  }

  let E, w;
  if (e === 0 && I === 0) {
    // Circular Orbits with zero inclincation

    let trueLongitude = Math.acos(r.x / r.length());
    if (v.x > 0) {
      trueLongitude = 2 * Math.PI - trueLongitude;
    }

  } else if (e === 0) {
    // Circular orbits with a +/- inclincation
    // True anomaly is undefined for a circular orbit because circular orbits
    // do not have a uniquely-determined periapsis; Instead, the argument of
    // latitude is used:
    const argumentLatitude = Math.atan2(r.z / Math.sin(I), r.x * Math.cos(omega) + r.y * Math.sin(omega));
    E = 2 * Math.atan(Math.tan(argumentLatitude / 2));
    w = 0;
  } else {
    let v_eccentricity = new Vector3()
      .crossVectors(v, h)
      .multiplyScalar(1 / u)
      .sub(r.clone()
        .multiplyScalar(1 / r.length()))

    let trueAnomaly = Math.acos(v_eccentricity.dot(r) / (v_eccentricity.length() * r.length()));
    if (r.dot(v) < 0)
      trueAnomaly = 2 * Math.PI - trueAnomaly;

    let argumentLatitude = Math.atan2(r.z / Math.sin(I), r.x * Math.cos(omega) + r.y * Math.sin(omega));
    E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2));
    w = argumentLatitude - trueAnomaly;
  }

  const M = E - e * Math.sin(E);
  const L = M + w;

  const calculated_kepler_elements = {
    a: a,
    e: e,
    I: I * 180 / Math.PI,
    w: w * 180 / Math.PI,
    omega: omega * 180 / Math.PI,
    M: M * 180 / Math.PI,
    E: E * 180 / Math.PI,
  };

  return calculated_kepler_elements;
};

SolarSystem.prototype._toCartesianCoordinates = function (primary, kepler_elements) {

  let {
    a,
    e,
    I,
    argumentPerihelion,
    omega,
    M,
  } = kepler_elements;

  let u = primary ? primary.constants.u : 0;
  let offset = primary ? primary.derived.position : new Vector3(0, 0, 0);
  let E = this._calculateEccentricAnomaly(e, M * 180 / Math.PI) * Math.PI / 180;

  let trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2));

  // Calculate heliocentric coordinates in the planets orbital plane
  let helioCentricPosition = new Vector3(
    a * (Math.cos(E) - e),
    a * Math.sqrt(1 - Math.pow(e, 2)) * Math.sin(E),
    0);

  // Convert to the ecliptic plane
  let eclipticPosition = this._transformToEcliptic(
    offset,
    helioCentricPosition,
    argumentPerihelion,
    omega,
    I);

  // Calculate the velocity in the planets orbital planet
  let helioCentricVelocity = new Vector3(-Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0)
    .multiplyScalar((Math.sqrt(u / Math.pow(a, 3)) * a) / Math.sqrt(1 - Math.pow(e, 2)));

  // Convert to the ecliptic plane
  let eclipticVelocity = this._transformToEcliptic(
    new Vector3(0, 0, 0),
    helioCentricVelocity,
    argumentPerihelion,
    omega,
    I);

  return {
    meanAnomaly: M,
    eccentricAnomaly: E,
    trueAnomaly: trueAnomaly,
    position: eclipticPosition,
    position_in_plane: helioCentricPosition,
    velocity: eclipticVelocity,
    velocity_in_plane: helioCentricVelocity,
  };
};

SolarSystem.prototype._calculateJulianDate = function (date) {
  let Teph = J2000_epoch + date.diff(J2000_date, 'days', true);
  let T = (Teph - J2000_epoch) / 36525;
  return T;
};

SolarSystem.prototype._calculateMeanAnomaly = function (L, w, perturbations, T) {

  let M = L - w;
  if (perturbations) {
    M += perturbations.b * Math.pow(T, 2) +
      perturbations.c * Math.cos(perturbations.f * T) +
      perturbations.s * Math.sin(perturbations.f * T);
  }

  M = M % 360;
  if (M > 180) {
    M = M - 360;
  } else if (M < -180) {
    M = 360 + M;
  }

  return M;
};

SolarSystem.prototype._calculateEccentricAnomaly = function (e, M) {
  // Calculate eccentric anomaly, E
  // e_star = degrees
  // e = radians
  let tol = 10e-6;
  let e_star = 57.29578 * e;
  let E = M + e_star * Math.sin((Math.PI / 180) * M);
  let deltaE, deltaM;
  let numTimes = 0;
  do {
    deltaM = M - (E - e_star * Math.sin((Math.PI / 180) * E));
    deltaE = deltaM / (1 - e * Math.cos((Math.PI / 180) * E));
    E = E + deltaE;
    numTimes++;
  } while (Math.abs(deltaE) > tol && numTimes <= 10);

  if (numTimes === 10) {
    console.log("Didn't iterate on a solution!");
  }

  return E;
};

SolarSystem.prototype._transformToEcliptic = function (offset, position, w, omega, I) {

  let Q1 = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), w);
  let Q2 = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), I);
  let Q3 = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), omega);

  const rotation = new Vector3()
    .copy(position)
    .applyQuaternion(Q1)
    .applyQuaternion(Q2)
    .applyQuaternion(Q3);

  return rotation.add(offset);
};

export default SolarSystem;
