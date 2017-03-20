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
      const keplerElements = this._calculateInitialKeplerElements(body, T);
      body.derived = keplerElements;
    });

    this.initialized = true;
  }

  this.bodies.forEach((body) => {
    const keplerElements = this._calculateKeplerElementsAtTime(body, t + dt);
    const coords = this._toCartesianCoordinates(body.primary, keplerElements);
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
    } = keplerElements;

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
      a,
      e,
      I,
      omega,
      argumentPerihelion,
      M,
      position,
      position_in_plane: coords.position_in_plane,
      velocity,
      semiMajorAxis: a,
      semiMinorAxis: b,
      orbitalPeriod,
      rotation,
      center_in_plane: center,
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

    orientation.copy(motion.heading0);
    orientation.applyQuaternion(motion.rotation);
    orientation.normalize();

    const stage = body.stages[0];
    const thrust = stage.thrust * motion.thrust;
    const isp = stage.isp;
    const g0 = body.primary.constants.u / (body.primary.constants.radius ** 2);
    const deltaM = thrust / (g0 * isp * AU);

    const m0 = stage.mass + stage.propellant;
    stage.propellant -= (deltaM * dt) / 1000;
    const m1 = stage.mass + stage.propellant;

    const deltaV = orientation.clone()
      .multiplyScalar(isp * g0 * Math.log(m0 / m1));

    body.derived.velocity.add(deltaV);
    body.derived.position.add(body.derived.velocity.clone()
      .multiplyScalar(dt / 1000));

    const updated = this._calculateKeplerElementsFromCartesian(body);
    body.derived.a = updated.a;
    body.derived.e = updated.e;
    body.derived.I = updated.I;
    body.derived.omega = updated.omega;
    body.derived.argumentPerihelion = updated.argumentPerihelion;
    body.derived.M = updated.M;
  };
}());

SolarSystem.prototype._calculateInitialKeplerElements = function (body, T) {
  // Planets are fixed on rails; we simply a
  const keplerElements = body.kepler_elements;
  const a = keplerElements.a[0] + (keplerElements.a[1] * T);
  const e = keplerElements.e[0] + (keplerElements.e[1] * T);
  const I = keplerElements.I[0] + (keplerElements.I[1] * T);
  const L = keplerElements.L[0] + (keplerElements.L[1] * T);
  const w = keplerElements.w[0] + (keplerElements.w[1] * T);
  const omega = keplerElements.omega[0] + (keplerElements.omega[1] * T);
  const perturbations = keplerElements.perturbations;
  const M = this._calculateMeanAnomaly(L, w, perturbations, T);
  const argumentPerihelion = w - omega;

  return {
    a,
    e,
    I: I * (Math.PI / 180),
    omega: omega * (Math.PI / 180),
    argumentPerihelion: argumentPerihelion * (Math.PI / 180),
    M: M * (Math.PI / 180),
  };
};

SolarSystem.prototype._calculateKeplerElementsAtTime = function (body, t) {
  const {
    a,
    e,
    I,
    omega,
    argumentPerihelion,
    M,
  } = body.derived;

  /**
   * For elliptical orbits, M - M0 = n(t - t0)
   */

  const lastTime = this.lastTime || t;
  const delta = (t - lastTime) / 1000;
  const u = body.primary ? body.primary.constants.u : 0;
  const n = Math.sqrt(u / (a ** 3));
  const updatedM = (n * delta) + M;

  return Object.assign({
    a,
    e,
    I,
    omega,
    argumentPerihelion,
  }, {
    M: updatedM,
  });
};

SolarSystem.prototype._calculateKeplerElementsFromCartesian = function (body) {
  const primary = body.primary;
  const position = body.derived.position;
  const velocity = body.derived.velocity;

  const r = new Vector3()
    .subVectors(position, primary.derived.position);
  const v = velocity.clone();
  const u = primary.constants.u;

  const h = new Vector3()
    .crossVectors(r, v);

  if (h.length() <= 0) {
    console.error('angular momentum is zero!');
  }

  // Semi-Major Axis
  const specificEnergy = (v.lengthSq() / 2) - (u / r.length());
  const a = -u / (2 * specificEnergy);

  // Eccentricity
  const esub = h.lengthSq() / (u * a);
  const e = esub > 1 ? 0 : Math.sqrt(1 - esub);

  // Inclination, Longitude of the ascending node
  const I = -Math.acos(h.z / h.length());
  const omega = Math.atan2(h.x, h.y);

  let E;
  let argumentPerihelion;
  if (e === 0 && I === 0) {
    // Circular Orbits with zero inclincation

    // let trueLongitude = Math.acos(r.x / r.length());
    // if (v.x > 0) {
    //   trueLongitude = 2 * Math.PI - trueLongitude;
    // }
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
    const eccentricityVector = new Vector3()
      .crossVectors(v, h)
      .multiplyScalar(1 / u)
      .sub(r.clone()
        .multiplyScalar(1 / r.length()));

    let trueAnomaly = Math.acos(
      eccentricityVector.dot(r) / (eccentricityVector.length() * r.length()));

    if (r.dot(v) < 0) {
      trueAnomaly = (2 * Math.PI) - trueAnomaly;
    }

    const argumentLatitude = Math.atan2(
      r.z / Math.sin(I),
      (r.x * Math.cos(omega)) + (r.y * Math.sin(omega)));

    E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2));
    argumentPerihelion = argumentLatitude - trueAnomaly;
  }

  const M = E - (e * Math.sin(E));

  const calculatedKeplerElements = {
    a,
    e,
    I,
    omega,
    argumentPerihelion,
    M,
  };

  return calculatedKeplerElements;
};

SolarSystem.prototype._toCartesianCoordinates = function (primary, keplerElements) {
  const {
    a,
    e,
    I,
    argumentPerihelion,
    omega,
    M,
  } = keplerElements;

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
  const helioCentricVelocity = new Vector3(-Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0)
    .multiplyScalar((Math.sqrt(u / (a ** 3)) * a) / Math.sqrt(1 - (e ** 2)));

  // Convert to the ecliptic plane
  const eclipticVelocity = this._transformToEcliptic(
    new Vector3(0, 0, 0),
    helioCentricVelocity,
    argumentPerihelion,
    omega,
    I);

  return {
    meanAnomaly: M,
    eccentricAnomaly: E,
    trueAnomaly,
    position: eclipticPosition,
    position_in_plane: helioCentricPosition,
    velocity: eclipticVelocity,
    velocity_in_plane: helioCentricVelocity,
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
  // e = radians
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

  if (numTimes === 10) {
    console.log("Didn't iterate on a solution!");
  }

  return E;
};

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

    return rotation.add(offset);
  };
}());

export default SolarSystem;
