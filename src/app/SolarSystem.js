import moment from 'moment';
import BODIES, {
  AU,
  PLANET_TYPE,
  SHIP_TYPE,
  ASTEROID_TYPE
} from './Bodies';

import {
  Vector3,
  Quaternion
} from 'three';

const J2000_date = moment('2000-01-01T12:00:00Z');
const J2000_epoch = 2451545.0;

function SolarSystem() {

  // Initialize map
  const bodyMap = new Map(Object.keys(BODIES)
    .map(function (name) {
      let planet = BODIES[name];
      planet.name = name;
      planet.derived = {};
      return [name, planet];
    }));

  // Create a graph based on the primary -> secondary relationship
  const bodyDependencyGraph = Array.from(bodyMap.values())
    .map((planet) => {
      // Add in back references to the primary

      if (planet.primary) {
        planet.primary = bodyMap.get(planet.primary);
        return [planet.primary, planet];
      } else {
        return [null, planet];
      }
    })
    .reduce((tree, [primary, body]) => {
      // Organize the map by primary -> [secondaries]

      // Base case for sun
      if (!primary && !tree.has(body)) {
        tree.set(body, []);
        return tree;
      }

      if (!tree.has(primary))
        tree.set(primary, []);

      tree.get(primary)
        .push(body);
      return tree;

    }, new Map());

  // Set the secondaries as a property onto each body
  for (let [primary, secondaries] of bodyDependencyGraph.entries()) {
    primary.secondaries = secondaries;
  }

  const sortedBodies = [];
  let sun = Array.from(bodyMap.values())
    .find((body) => !body.primary);

  function flatten(body) {
    if (!body) {
      return [];
    }

    return (body.secondaries || [])
      .reduce((bodies, b) => {
        return bodies.concat(flatten(b));
      }, [body]);
  }

  this.planets = flatten(sun);
  this.bodies = [];
};

SolarSystem.prototype.find = function (planetId) {
  return this.planets.find((planet) => planet.name == planetId);
};

SolarSystem.prototype.update = function (t, dt) {

  let currentDate = moment(t + dt);
  let T = this._calculateJulianDate(currentDate);

  this.planets.forEach(function (planet) {

    // Don't calculate data for the sun; treat as stationary
    if (planet.name === 'sun') {
      planet.derived = {
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        apoapsis: new Vector3(0, 0, 0),
        periapsis: new Vector3(0, 0, 0),
        center: new Vector3(0, 0, 0)
      };

      return;
    }

    let kepler_elements = planet.kepler_elements;
    let planet_constants = planet.constants;
    let primary = planet.primary;
    let derived = planet.derived;
    let u = primary.constants.u;

    // For bodies...
    //  -> Calculate initial r, v using kepler_elements
    //  -> Integrate to find r', v'
    //  -> Use r', v' to compute kepler elements

    let a = kepler_elements.a[0] + kepler_elements.a[1] * T;
    let e = kepler_elements.e[0] + kepler_elements.e[1] * T;
    let I = kepler_elements.I[0] + kepler_elements.I[1] * T;
    let L = kepler_elements.L[0] + kepler_elements.L[1] * T;
    let w = kepler_elements.w[0] + kepler_elements.w[1] * T;
    let omega = kepler_elements.omega[0] + kepler_elements.omega[1] * T;
    let perturbations = kepler_elements.perturbations;
    let M = this._calculateMeanAnomaly(L, w, perturbations, T);

    let delta = this._toCartesianCoordinates(primary, a, e, I, L, w, omega, M);
    let position = delta.position;
    let velocity = delta.velocity;

    // Semi-minor axis
    let b = a * Math.sqrt(1 - Math.pow(e, 2));
    let periapsis = new Vector3(a * (1 - e), 0, 0);
    let apoapsis = new Vector3(-a * (1 + e), 0, 0);
    let center = new Vector3(periapsis.x - a, 0, 0);

    let rotation = (derived.rotation || 0) +
      2 * Math.PI * dt /
      ((planet_constants.rotation_period || 1) * 86400e3);

    // Convert params to radians for this next transformation
    let argumentPerihelion = (w - omega) * (Math.PI / 180);
    omega = omega * (Math.PI / 180);
    I = I * (Math.PI / 180);
    w = w * (Math.PI / 180);

    planet.derived = {
      T: T,
      a: a,
      e: e,
      I: I,
      w: w,
      omega: omega,
      argumentPerihelion: argumentPerihelion,
      position: position,
      position_in_plane: delta.position_in_plane,
      velocity: velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      rotation: rotation,
      center: this._transformToEcliptic(primary.derived.position, center, argumentPerihelion, omega, I),
      center_in_plane: center,
      periapsis: this._transformToEcliptic(primary.derived.position, periapsis, argumentPerihelion, omega, I),
      apoapsis: this._transformToEcliptic(primary.derived.position, apoapsis, argumentPerihelion, omega, I),
    }

  }, this);

  this.lastTime = t + dt;
};

SolarSystem.prototype._toCartesianCoordinates = function (primary, a, e, I, L, w, omega, M) {

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
    new Vector3(0, 0, 0), // Don't offset; we just want the orbital velocity
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

  let x = position.x;
  let y = position.y;
  let z = position.z;

  let x_ecl =
    (Math.cos(w) * Math.cos(omega) - Math.sin(w) * Math.sin(omega) * Math.cos(I)) * x +
    (-Math.sin(w) * Math.cos(omega) - Math.cos(w) * Math.sin(omega) * Math.cos(I)) * y;
  let y_ecl =
    (Math.cos(w) * Math.sin(omega) + Math.sin(w) * Math.cos(omega) * Math.cos(I)) * x +
    (-Math.sin(w) * Math.sin(omega) + Math.cos(w) * Math.cos(omega) * Math.cos(I)) * y;
  let z_ecl = Math.sin(w) * Math.sin(I) * x +
    Math.cos(w) * Math.sin(I) * y;

  // Offset by a vector, e.g... the primary's position or velocity depending on
  // which vector we are transforming
  return new Vector3(x_ecl, y_ecl, z_ecl)
    .add(offset);
};

export default SolarSystem;
