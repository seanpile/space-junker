import moment from 'moment';
import PLANETS, {
  AU
} from './Planets';
import {
  Vector3
} from 'three';

const J2000_date = moment('2000-01-01T12:00:00Z');
const J2000_epoch = 2451545.0;

function SolarSystem() {

  const planetMap = new Map(Object.keys(PLANETS)
    .map(function (name) {
      let planet = PLANETS[name];
      planet.name = name;
      planet.derived = {};
      return [name, planet];
    }));

  const planets = Array.from(planetMap.values())
    .map((planet) => {

      if (planet.primary) {
        planet.primary = planetMap.get(planet.primary);
      }

      return planet;
    });

  this.planets = planets;
  this.bodies = [];
};

SolarSystem.prototype.update = function (t, dt) {

  let currentDate = moment(t + dt);
  let T = this._calculateJulianDate(currentDate);

  this.planets.forEach(function (planet) {

    // Don't calculate data for the sun; treat as stationary
    if (planet.name === 'sun') {
      planet.derived = {
        position: new Vector3(0, 0, 0)
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

    let delta = this._toCartesianCoordinates(a, e, I, L, w, omega, M, u);
    let position = delta.position;
    let velocity = delta.velocity;

    // Semi-minor axis
    let b = a * Math.sqrt(1 - Math.pow(e, 2));
    let periapsis = new Vector3(a * (1 - e), 0, 0);
    let apoapsis = new Vector3(-a * (1 + e), 0, 0);
    let center = new Vector3(periapsis.x - a, 0, 0);

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
      velocity: velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      center: this._transformToEcliptic(center, argumentPerihelion, omega, I),
      periapsis: this._transformToEcliptic(periapsis, argumentPerihelion, omega, I),
      apoapsis: this._transformToEcliptic(apoapsis, argumentPerihelion, omega, I),
    }

  }, this);

  this.lastTime = t + dt;
};

SolarSystem.prototype._toCartesianCoordinates = function (a, e, I, L, w, omega, M, u) {

  let argumentPerihelion = w - omega;

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
    helioCentricVelocity,
    argumentPerihelion * Math.PI / 180,
    omega * Math.PI / 180,
    I * Math.PI / 180);

  return {
    meanAnomaly: M * (Math.PI / 180),
    eccentricAnomaly: E * (Math.PI / 180),
    trueAnomaly: trueAnomaly,
    position: eclipticPosition,
    velocity: eclipticVelocity
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

SolarSystem.prototype._transformToEcliptic = function (position, w, omega, I) {

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

  return new Vector3(x_ecl, y_ecl, z_ecl);
};

export default SolarSystem;
