import {
  Vector3,
  Quaternion,
} from 'three';

import * as OrbitUtils from './orbits/OrbitUtils';
import EllipticalOrbit from './orbits/EllipticalOrbit';
import ParabolicOrbit from './orbits/ParabolicOrbit';
import HyperbolicOrbit from './orbits/HyperbolicOrbit';
import StationaryOrbit from './orbits/StationaryOrbit';

import Bodies from './Bodies';
import { AU, SHIP_TYPE } from '../Constants';

function SolarSystem() {
  this.bodies = Array.from(Bodies);
  this.initialized = false;
}

SolarSystem.prototype.find = function find(bodyId) {
  return this.bodies.find(body => body.name === bodyId);
};

SolarSystem.prototype.update = function update(t, dt) {

  if (!this.initialized) {
    /**
     * Generate an Orbit object from the initial kepler elements
     */
    this.bodies.forEach((body) => {

      const keplerElements = body.constants.kepler_elements;
      const e = OrbitUtils.EccentricityAt(keplerElements, t + dt);

      let orbit;
      if (body.name === 'sun') {
        orbit = new StationaryOrbit(body);
      } else {
        const OrbitType = this._orbitType(e);
        orbit = new OrbitType(body).setFromKeplerElements(keplerElements, t + dt);
      }

      body.orbit = orbit;
    });

    this.initialized = true;
  }

  this.bodies.forEach((body) => {

    body.orbit.advance(dt);
    const derived = body.orbit.stats(dt);
    body.derived = derived;

    if (body.type === SHIP_TYPE) {
      this._applyRotation(body, dt);
      this._applyThrust(body, dt);
    }
  });
};

SolarSystem.prototype._orbitType = function (e) {

  const found = [EllipticalOrbit, ParabolicOrbit, HyperbolicOrbit]
    .find(orbit => orbit.supports(e));

  if (!found) {
    throw new Error(`Unexpected value for e: ${e}`);
  }

  return found;
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

    const velocity = body.derived.velocity.clone().add(deltaV);
    const position = body.derived.position.clone().add(
      velocity.clone().multiplyScalar(dt / 1000),
    );

    // Check to see if the modified orbit is still supported by the current Orbit; if not,
    // instantiate the correct Orbit
    const eccentricity = OrbitUtils.Eccentricity(body, position, velocity);
    if (!body.orbit.constructor.supports(eccentricity)) {
      const OrbitType = this._orbitType(eccentricity);
      body.orbit = new OrbitType(body);
    }

    // Update orbital elements from the new position, velocity elements
    body.orbit.setFromCartesian(position, velocity);
  };
}());


export default SolarSystem;
