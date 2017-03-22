import moment from 'moment';
import {
  Vector3,
  Quaternion,
} from 'three';

import Bodies from './Bodies';
import { AU, SHIP_TYPE } from '../Constants';

const J2000Date = moment('2000-01-01T12:00:00Z');
const J2000Epoch = 2451545.0;

function SolarSystem() {
  this.bodies = Array.from(Bodies);
  this.initialized = false;
}

SolarSystem.prototype.find = function find(bodyId) {
  return this.bodies.find(body => body.name === bodyId);
};

SolarSystem.prototype.update = function update(t, dt) {
  const currentDate = moment(t + dt);

  if (!this.initialized) {
    /**
     * Generate a starting position/velocity from the initial kepler
     * elements
     */
    const T = this._calculateJulianDate(currentDate);
    this.bodies.forEach((body) => {
      const orbit = this._calculateInitialOrbit(body, T);
      body.derived.orbit = orbit;
    });

    this.initialized = true;
  }

  this.bodies.forEach((body) => {
    const orbit = this._advanceOrbit(body, t + dt);
    const coords = this._toCartesianCoordinates(body);

    if (body.name === 'apollo 11') {

      // We calculate heliocentric position coordinates oriented from the ecliptic plane
      // When reversing, we need to first convert these coordinates to ECI based coordinates
      //
      // body.derived.position = coords.position;
      // body.derived.velocity = coords.velocity;
      // const inverseOrbit = this._calculateOrbitFromCartesian(body);
      //
      // body.derived.orbit = inverseOrbit;
      // const inverseCoords = this._toCartesianCoordinates(body);

      // console.log(coords.position);
      // console.log(inverseCoords.position);

      //
      //
      // console.log(orbit.M);
      // console.log(inverseOrbit.M);
      // console.log(orbit.I);
      // console.log(inverseOrbit.I);
      // console.log(orbit.omega);
      // console.log(inverseOrbit.omega);
      // console.log(orbit.argumentPerihelion);
      // console.log(inverseOrbit.argumentPerihelion);
    }

    const position = coords.position;
    const velocity = coords.velocity;

    const bodyConstants = body.constants;
    const primary = body.primary;
    const derived = body.derived;
    const u = body.primary ? primary.constants.u : 0;
    const offset = body.primary ? primary.derived.position : new Vector3(0, 0, 0);
    const {
      a,
      e,
      I,
      argumentPerihelion,
      omega,
      M,
    } = orbit;

    // Semi-minor axis
    const b = a * Math.sqrt(1 - (e ** 2));

    // Trajectory Elements
    const periapsis = new Vector3(a * (1 - e), 0, 0);
    const apoapsis = new Vector3(-a * (1 + e), 0, 0);
    const center = new Vector3(periapsis.x - a, 0, 0);

    // Orbital Period and Rotational Period
    const orbitalPeriod = 2 * Math.PI * Math.sqrt((a ** 3) /
      (u + (bodyConstants.u || 0)));

    const rotation = (derived.rotation || 0) +
      ((2 * Math.PI * dt) /
      ((bodyConstants.rotation_period || 1) * 86400e3));

    body.derived = {
      orbit,
      a,
      e,
      I,
      omega,
      argumentPerihelion,
      M,
      position,
      velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      orbitalPeriod,
      rotation,
      center: this._transformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: this._transformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: this._transformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    };

    if (body.type === SHIP_TYPE) {
      this._applyRotation(body, dt);
      this._applyThrust(body, dt);
    }
  });

  this.lastTime = t + dt;
};

SolarSystem.prototype._applyRotation = (function () {
  // Initialize objects once to avoid frequent object creation
  const adjustment = new Quaternion();
  const axisX = new Vector3(1, 0, 0);
  const axisY = new Vector3(0, 1, 0);
  const axisZ = new Vector3(0, 0, 1);

  // rad / second
  const DAMPING_STEP = Math.PI / (2 ** 3);

  const dampenMotion = (val, dt) => {
    let adjusted = val - ((Math.sign(val) * DAMPING_STEP * dt) / 1000);
    if (Math.abs(adjusted) < 10e-10) {
      adjusted = 0;
    }

    return adjusted;
  };

  return function applyRotation(body, dt) {
    const rotation = body.motion.rotation;

    adjustment.setFromAxisAngle(axisX, ((body.motion.pitch || 0) * dt) / 1000);
    rotation.multiply(adjustment);
    adjustment.setFromAxisAngle(axisY, ((body.motion.roll || 0) * dt) / 1000);
    rotation.multiply(adjustment);
    adjustment.setFromAxisAngle(axisZ, ((body.motion.yaw || 0) * dt) / 1000);
    rotation.multiply(adjustment);

    if (body.motion.sas) {
      body.motion.pitch = dampenMotion(body.motion.pitch, dt);
      body.motion.roll = dampenMotion(body.motion.roll, dt);
      body.motion.yaw = dampenMotion(body.motion.yaw, dt);
    }
  };
}());

SolarSystem.prototype._applyThrust = (function () {
  const orientation = new Vector3();

  return function applyThrust(body, dt) {
    const motion = body.motion;

    // No thrust to apply
    if (motion.thrust <= 0) {
      return;
    }

    const stage = body.stages[0];
    if (stage.propellant <= 0) {
      return;
    }

    orientation.copy(motion.heading0);
    orientation.applyQuaternion(motion.rotation);
    orientation.normalize();

    const thrust = stage.thrust * motion.thrust;
    const isp = stage.isp;
    const g0 = body.primary.constants.u / (body.primary.constants.radius ** 2);
    const deltaM = thrust / (g0 * isp * AU);

    const m0 = stage.mass + stage.propellant;
    stage.propellant = Math.max(0, stage.propellant - (deltaM * (dt / 1000)));
    const m1 = stage.mass + stage.propellant;

    const deltaV = orientation.clone()
      .multiplyScalar(isp * g0 * Math.log(m0 / m1));

    body.derived.velocity.add(deltaV);
    body.derived.position.add(body.derived.velocity.clone()
      .multiplyScalar(dt / 1000));

    body.derived.orbit = this._calculateOrbitFromCartesian(body);
  };
}());

SolarSystem.prototype._calculateInitialOrbit = function (body, T) {
  // Planets are fixed on rails; we simply a
  const keplerElements = body.kepler_elements;
  const a = keplerElements.a[0] + (keplerElements.a[1] * T);
  const e = keplerElements.e[0] + (keplerElements.e[1] * T);
  const I = keplerElements.I[0] + (keplerElements.I[1] * T);
  const L = keplerElements.L[0] + (keplerElements.L[1] * T);
  const w = keplerElements.w[0] + (keplerElements.w[1] * T);
  const omega = keplerElements.omega[0] + (keplerElements.omega[1] * T);
  const argumentPerihelion = w - omega;

  const perturbations = keplerElements.perturbations;
  const M = this._calculateMeanAnomaly(L, w, perturbations, T);

  return {
    a,
    e,
    I: I * (Math.PI / 180),
    omega: omega * (Math.PI / 180),
    argumentPerihelion: argumentPerihelion * (Math.PI / 180),
    M: M * (Math.PI / 180),
  };
};

SolarSystem.prototype._advanceOrbit = function (body, t) {

  const orbit = body.derived.orbit;
  const a = orbit.a;
  const e = orbit.e;
  const M = orbit.M;

  const lastTime = this.lastTime || t;
  const delta = (t - lastTime) / 1000;
  const u = body.primary ? body.primary.constants.u : 0;

  /**
   * For elliptical orbits, M - M0 = n(t - t0)
   */

  let n;
  if (e === 0) {
    // Circular Orbit
    n = Math.sqrt(u / (a ** 3));
  } else if (e < 1) {
    // Elliptical Orbit
    n = Math.sqrt(u / (a ** 3));
  } else if (e === 1) {
    // Parabolic Orbit
    n = Math.sqrt(u);
  } else if (e > 1) {
    // Hyperbolic Orbit
    n = Math.sqrt(u / Math.pow(-a, 3));
  } else {
    console.error(`e < 0!  (e = ${e})`);
  }

  const M1 = M + (n * delta);
  orbit.M = M1;

  return orbit;
};

SolarSystem.prototype._calculateOrbitFromCartesian = (function () {

  const r = new Vector3();
  const v = new Vector3();
  const h = new Vector3();
  const n = new Vector3();
  const ecc = new Vector3();
  const axisZ = new Vector3(0, 0, 1);

  return function (body) {
    const primary = body.primary;
    const position = body.derived.position;
    const velocity = body.derived.velocity;
    const u = primary.constants.u;

    r.subVectors(position, primary.derived.position);
    v.copy(velocity);
    h.crossVectors(r, v);
    n.crossVectors(axisZ, h);
    ecc.crossVectors(v, h)
      .multiplyScalar(1 / u)
      .sub(r.clone()
        .multiplyScalar(1 / r.length()));

    // Semi-Major Axis
    const specificEnergy = (v.lengthSq() / 2) - (u / r.length());
    const a = -u / (2 * specificEnergy);

    // Eccentricity
    const e = ecc.length();

    // Inclination, Longitude of the ascending node
    const I = Math.acos(h.z / h.length());
    let omega = Math.acos(n.x / n.length());

    if (n.length() <= 0) {
      omega = 0;
    } else if (n.y < 0) {
      omega = (2 * Math.PI) - omega;
    }

    let E;
    let argumentPerihelion;
    if (e === 0 && I === 0) {
      // Circular Orbits with zero inclincation

      let trueLongitude = Math.acos(r.x / r.length());
      if (v.x > 0) {
        trueLongitude = (2 * Math.PI) - trueLongitude;
      }

      E = trueLongitude;
      argumentPerihelion = 0;

    } else if (e === 0) {
      // Circular orbits with a +/- inclincation
      // True anomaly is undefined for a circular orbit because circular orbits
      // do not have a uniquely-determined periapsis; Instead, the argument of
      // latitude is used:
      const argumentLatitude = Math.atan2(
      r.z / Math.sin(I),
      (r.x * Math.cos(omega)) + (r.y * Math.sin(omega)));

      E = 2 * Math.atan(Math.tan(argumentLatitude / 2));
      argumentPerihelion = 0;
    } else {

      let trueAnomaly = Math.acos(
      r.dot(ecc) / (ecc.length() * r.length()));

      if (r.dot(v) < 0) {
        trueAnomaly = (2 * Math.PI) - trueAnomaly;
      }

      E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2));


      if (n.length() <= 0 || ecc.length() <= 0) {
        argumentPerihelion = 0;
      } else {
        argumentPerihelion = Math.acos(n.dot(ecc) / (n.length() * ecc.length()));
      }

      if (ecc.z < 0) {
        argumentPerihelion = (2 * Math.PI) - argumentPerihelion;
      }
    }

    const M = E - (e * Math.sin(E));

    return {
      a,
      e,
      I,
      omega,
      argumentPerihelion,
      M,
    };
  };
}());

SolarSystem.prototype._toCartesianCoordinates = function (body) {
  const e = body.derived.orbit.e;
  if (e === 0 || e < 1) {
    return this._toCartesianElliptical(body);
  } else if (e >= 1) {
    return this._toCartesianHyperbolic(body);
  }

  console.error(`unexpected e:  ${e}`);
};

SolarSystem.prototype._toCartesianElliptical = function (body) {
  const {
      a, e, I, argumentPerihelion, omega, M,
    } = body.derived.orbit;

  const primary = body.primary;
  const u = primary ? primary.constants.u : 0;
  const offset = primary ? primary.derived.position : new Vector3(0, 0, 0);
  const E = this._calculateEccentricAnomaly(e, M * (180 / Math.PI)) * (Math.PI / 180);

  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2));

  // Calculate heliocentric coordinates in the planets orbital plane
  const helioCentricPosition = new Vector3(
      a * (Math.cos(E) - e),
      a * Math.sqrt(1 - (e ** 2)) * Math.sin(E),
      0);

  // Convert to the ecliptic plane
  const eclipticPosition = this._transformToEcliptic(
    offset,
    helioCentricPosition,
    argumentPerihelion,
    omega,
    I);

    // Calculate the velocity in the planets orbital planet
  const helioCentricVelocity = new Vector3(
    -Math.sin(trueAnomaly),
    e + Math.cos(trueAnomaly),
    0).multiplyScalar((Math.sqrt(u / (a ** 3)) * a) / Math.sqrt(1 - (e ** 2)));

    // Convert to the ecliptic plane
  const eclipticVelocity = this._transformToEcliptic(
    null,
    helioCentricVelocity,
    argumentPerihelion,
    omega,
    I);

  return {
    position: eclipticPosition,
    velocity: eclipticVelocity,
  };
};

SolarSystem.prototype._toCartesianHyperbolic = function (body) {
  const {
      a, e, I, argumentPerihelion, omega, M,
    } = body.derived.orbit;

  const primary = body.primary;
  const u = primary ? primary.constants.u : 0;
  const offset = primary ? primary.derived.position : new Vector3(0, 0, 0);
  const H = this._calculateHyperbolicEccentricity(e, M);
  const trueAnomaly = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));

  const r =
    (a * (1 - (e ** 2))) /
    (1 + (e * Math.cos(trueAnomaly)));

  // Calculate heliocentric coordinates in the planets orbital plane
  const perifocalPosition = new Vector3(
      r * Math.cos(trueAnomaly),
      r * Math.sin(trueAnomaly),
      0);

  // Convert to the ecliptic plane
  const eclipticPosition = this._transformToEcliptic(
    offset,
    perifocalPosition,
    argumentPerihelion,
    omega,
    I);

    // Calculate the velocity in the planets orbital planet
  const perifocalVelocity = new Vector3(
    -Math.sin(trueAnomaly),
    e + Math.cos(trueAnomaly),
    0).normalize().multiplyScalar(Math.sqrt(u * ((2 / r) - (1 / a))));

    // Convert to the ecliptic plane
  const eclipticVelocity = this._transformToEcliptic(
    null,
    perifocalVelocity,
    argumentPerihelion,
    omega,
    I);

  return {
    position: eclipticPosition,
    velocity: eclipticVelocity,
  };
};

SolarSystem.prototype._calculateJulianDate = function calculateJulianDate(date) {
  const Teph = J2000Epoch + date.diff(J2000Date, 'days', true);
  const T = (Teph - J2000Epoch) / 36525;
  return T;
};

SolarSystem.prototype._calculateMeanAnomaly =
  function calculateMeanAnomaly(L, w, perturbations, T) {
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
  };

SolarSystem.prototype._calculateEccentricAnomaly = function calculateEccentricAnomaly(e, M) {
  // Calculate eccentric anomaly, E
  // e_star = degrees
  // M = degrees
  // E = degrees

  const tol = 10e-6;
  const eStar = 57.29578 * e;
  let E = M + (eStar * Math.sin((Math.PI / 180) * M));
  let deltaE;
  let deltaM;
  let numTimes = 0;
  do {
    deltaM = M - (E - (eStar * Math.sin((Math.PI / 180) * E)));
    deltaE = deltaM / (1 - (e * Math.cos((Math.PI / 180) * E)));
    E += deltaE;
    numTimes += 1;
  } while (Math.abs(deltaE) > tol && numTimes <= 10);

  if (numTimes > 10) {
    console.error("Didn't iterate on a solution!");
  }

  return E;
};

SolarSystem.prototype._calculateHyperbolicEccentricity = (function () {

  function f(H, M, e) {
    return ((e * Math.sinh(H)) - H) - M;
  }

  function f1(H, M, e) {
    return (e * Math.cosh(H)) - 1;
  }

  return function calculateHyperbolicEccentricity(e, M) {
    // Calculate eccentric anomaly, E
    // e_star = degrees
    // e = radians

    const tol = 10e-8;
    let numTimes = 0;
    const maxTimes = 10;
    let deltaH;
    let H0 = M;
    do {
      deltaH = f(H0, M, e) / f1(H0, M, e);

      if (Math.abs(deltaH) < tol) {
        return H0;
      }

      H0 -= deltaH;
      numTimes += 1;
    } while (numTimes <= maxTimes);

    if (numTimes > maxTimes) {
      console.log("Didn't iterate on a solution!");
    }

    return H0;
  };
}());


SolarSystem.prototype._transformToEcliptic = (function () {
  const axisZ = new Vector3(0, 0, 1);
  const axisX = new Vector3(1, 0, 0);

  return function (offset, position, w, omega, I) {
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

export default SolarSystem;
