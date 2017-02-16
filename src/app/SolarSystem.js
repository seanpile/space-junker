import moment from 'moment';
import MathExtensions from './util/MathExtensions';
import RungeKuttaIntegrator from './integrators/runge-kutta-integrator';
import BODIES, {
  AU,
  PLANET_TYPE,
  SHIP_TYPE,
  ASTEROID_TYPE
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

  // Initialize map
  const bodyMap = new Map(Object.keys(BODIES)
    .map(function (name) {
      let body = BODIES[name];
      body.name = name;
      body.derived = {};

      if (name === 'sun') {
        body.derived = {
          position: new Vector3(0, 0, 0),
          velocity: new Vector3(0, 0, 0),
          apoapsis: new Vector3(0, 0, 0),
          periapsis: new Vector3(0, 0, 0),
          center: new Vector3(0, 0, 0)
        };
      }

      return [name, body];
    }));

  // Set back-references on body graph
  Array.from(bodyMap.values())
    .forEach((body) => {

      // Set primary
      if (body.primary) {
        body.primary = bodyMap.get(body.primary);

        // Add self to primary's secondaries property
        if (!body.primary.secondaries)
          body.primary.secondaries = [];

        body.primary.secondaries.push(body);
      }
    });

  // Flatten the dependency graph to ensure that primary bodies are always
  // evaluated before their secondaries (satellites)

  function flatten(body) {
    if (!body) {
      return [];
    }

    return (body.secondaries || [])
      .reduce((bodies, b) => {
        return bodies.concat(flatten(b));
      }, [body]);
  }

  let sun = Array.from(bodyMap.values())
    .find((body) => !body.primary);

  this.bodies = flatten(sun);
  this.integrator = new RungeKuttaIntegrator();
};

SolarSystem.prototype.find = function (bodyId) {
  return this.bodies.find((body) => body.name == bodyId);
};

SolarSystem.prototype.update = function (t, dt) {

  let currentDate = moment(t + dt);
  let T = this._calculateJulianDate(currentDate);

  this.bodies.forEach(function (body) {

    // Don't calculate data for the sun; treat as stationary
    if (body.name === 'sun') {
      return;
    }

    let kepler_elements;
    if (body.type === PLANET_TYPE) {
      kepler_elements = this._calculateFixedKeplerElements(body, T);
    } else {
      kepler_elements = this._calculatePhysicsBasedElements(body, t, dt);
    }

    let coords = this._toCartesianCoordinates(body.primary, kepler_elements);
    let position = coords.position;
    let velocity = coords.velocity;

    let body_constants = body.constants;
    let primary = body.primary;
    let derived = body.derived;
    let u = primary.constants.u;
    let {
      a,
      e,
      I,
      w,
      omega,
      M
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

    // Convert params to radians for this next transformation
    let argumentPerihelion = (w - omega) * (Math.PI / 180);
    omega = omega * (Math.PI / 180);
    I = I * (Math.PI / 180);
    w = w * (Math.PI / 180);

    body.derived = {
      T: T,
      a: a,
      e: e,
      I: I,
      w: w,
      omega: omega,
      argumentPerihelion: argumentPerihelion,
      position: position,
      position_in_plane: coords.position_in_plane,
      velocity: velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      orbital_period: orbital_period,
      rotation: rotation,
      center: this._transformToEcliptic(primary.derived.position, center, argumentPerihelion, omega, I),
      center_in_plane: center,
      periapsis: this._transformToEcliptic(primary.derived.position, periapsis, argumentPerihelion, omega, I),
      apoapsis: this._transformToEcliptic(primary.derived.position, apoapsis, argumentPerihelion, omega, I),
    }

  }, this);

  this.lastTime = t + dt;
};

SolarSystem.prototype._calculateFixedKeplerElements = function (body, T) {

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

  return {
    a,
    e,
    I,
    w,
    omega,
    M
  };
};

SolarSystem.prototype._calculatePhysicsBasedElements = function (body, t, dt) {

  let primary = body.primary;
  let kepler_elements = body.kepler_elements;

  // First, convert kepler elements to current position, velocity
  let [initialPosition, initialVelocity] = ((kepler_elements) => {

    let a = kepler_elements.a[0];
    let e = kepler_elements.e[0];
    let I = kepler_elements.I[0];
    let L = kepler_elements.L[0];
    let w = kepler_elements.w[0];
    let omega = kepler_elements.omega[0];
    let M = this._calculateMeanAnomaly(L, w);
    let coords = this._toCartesianCoordinates(primary, {
      a,
      e,
      I,
      w,
      omega,
      M
    });

    let position = coords.position;
    let velocity = coords.velocity;

    return [position, velocity];

  })(kepler_elements);

  this.integrator.integrate(initialPosition, initialVelocity, primary, t, dt);

  let newPosition = initialPosition.clone();
  let newVelocity = initialVelocity.clone();

  let r = new Vector3()
    .subVectors(newPosition, primary.derived.position);
  let v = newVelocity.clone();
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

  // Update kepler elements for the next pass
  kepler_elements.a[0] = a;
  kepler_elements.e[0] = e;
  kepler_elements.I[0] = I * 180 / Math.PI;
  kepler_elements.w[0] = w * 180 / Math.PI;
  kepler_elements.L[0] = L * 180 / Math.PI;
  kepler_elements.omega[0] = omega * 180 / Math.PI;

  const calculated_kepler_elements = {
    a: a,
    e: e,
    I: I * 180 / Math.PI,
    w: w * 180 / Math.PI,
    omega: omega * 180 / Math.PI,
    M: M * 180 / Math.PI,
  };

  return calculated_kepler_elements;
};

SolarSystem.prototype._toCartesianCoordinates = function (primary, kepler_elements) {

  let {
    a,
    e,
    I,
    w,
    omega,
    M
  } = kepler_elements;

  let argumentPerihelion = w - omega;
  let u = primary.constants.u;

  const E = this._calculateEccentricAnomaly(e, M);

  let trueAnomaly = Math.sign(E) * Math.acos(
    (Math.cos((Math.PI / 180) * E) - e) /
    (1 - e * Math.cos((Math.PI / 180) * E)))

  // Calculate heliocentric coordinates in the planets orbital plane
  let helioCentricPosition = new Vector3(
    a * (Math.cos((Math.PI / 180) * E) - e),
    a * Math.sqrt(1 - Math.pow(e, 2)) * Math.sin((Math.PI / 180) * E),
    0);

  // Convert to the ecliptic plane
  let eclipticPosition = this._transformToEcliptic(
    primary.derived.position,
    helioCentricPosition,
    argumentPerihelion * Math.PI / 180,
    omega * Math.PI / 180,
    I * Math.PI / 180);

  // Calculate the velocity in the planets orbital planet
  let helioCentricVelocity = new Vector3(-Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0)
    .multiplyScalar((Math.sqrt(u / Math.pow(a, 3)) * a) / Math.sqrt(1 - Math.pow(e, 2)));

  // Convert to the ecliptic plane
  let eclipticVelocity = this._transformToEcliptic(
    new Vector3(0, 0, 0), // Don't offset; we just want the orbital velocity rotated in the appropriate plane
    helioCentricVelocity,
    argumentPerihelion * Math.PI / 180,
    omega * Math.PI / 180,
    I * Math.PI / 180);

  return {
    meanAnomaly: M * (Math.PI / 180),
    eccentricAnomaly: E * (Math.PI / 180),
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
