import {
  Vector3,
  Quaternion,
} from 'three';

import * as OrbitUtils from './orbits/OrbitUtils';
import EllipticalOrbit from './orbits/EllipticalOrbit';
import ParabolicOrbit from './orbits/ParabolicOrbit';
import HyperbolicOrbit from './orbits/HyperbolicOrbit';
import StationaryOrbit from './orbits/StationaryOrbit';

import { Planet, Ship } from './Bodies';
import Universe from './universe.json';
import { AU } from '../Constants';

const PLANET_TYPE = 'planet';
const SHIP_TYPE = 'ship';

function SolarSystem() {
  this.initialized = false;
  this.seed();
}

SolarSystem.prototype.seed = function () {

  // Stringify -> Parse to ensure that we're not sharing any data between instances of
  // SolarSystem
  const bodyData = JSON.parse(JSON.stringify(Universe));

  // Initialize map
  const bodyMap = new Map(Object.keys(bodyData).map((name) => {
    const data = bodyData[name];
    const constants = data.constants;

    // Normalize all distance units by the AU unit to scale down large numbers
    constants.u /= (AU ** 3);
    constants.radius /= AU;

    let body;
    if (data.type === PLANET_TYPE) {
      body = new Planet(name, constants);
    } else if (data.type === SHIP_TYPE) {
      body = new Ship(name, constants, data.stages);
      body.motion = {
        heading0: new Vector3(0, 1, 0),
        rotation: new Quaternion(),
        pitch: 0, // rad / second
        yaw: 0, // rad / second
        roll: 0, // rad / second
        sas: true,
        thrust: 0, // 0 (no thrust) -> 1 (max thrust)
      };
    }

    body.primary = data.primary;
    return [name, body];
  }));

  // Set back-references on body graph
  Array
      .from(bodyMap.values())
      .forEach((body) => {
        // Set primary
        if (body.primary) {
          const primary = bodyMap.get(body.primary);
          body.primary = primary;
          primary.addSecondary(body);
        }
      });

  // Flatten the dependency graph to ensure that primary bodies are always
  // evaluated before their secondaries (satellites)
  function flatten(body) {
    if (!body) {
      return [];
    }

    return (body.secondaries || []).reduce((bodies, b) => bodies.concat(flatten(b)), [body]);
  }

  this.bodies = flatten(bodyMap.get('sun'));
};

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
      if (body.isPlanet()) {
        body.constants.sphereOfInfluence = OrbitUtils.SphereOfInfluence(body);
      }
    });

    this.initialized = true;
  }

  this.bodies.forEach((body) => {

    body.orbit.advance(dt);

    if (body.isPlanet()) {
      this._applyPlanetaryRotation(body, dt);
    } else if (body.isShip()) {
      this._checkSphereOfInfluence(body);
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

SolarSystem.prototype._applyPlanetaryRotation = function (planet, dt) {

  const rotation = (planet.constants.rotation || 0) +
    ((2 * Math.PI * dt) /
      ((planet.constants.rotation_period || 1) * 86400e3));

  planet.constants.rotation = rotation % (2 * Math.PI);
};

SolarSystem.prototype._checkSphereOfInfluence = function (body) {

  const sun = this.find('sun');

  // Check for Sphere of Influence change; this should be optimized later
  const spheresOfInfluence =
    this.bodies
      .filter(b => b !== body && b !== sun)
      .map(b => ({ body: b, distance: body.relativePosition(b).length() }))
      .filter(({ body: b, distance }) => distance < b.constants.sphereOfInfluence)
      .sort(({ b1, d1 }, { b2, d2 }) => d1 - d2);

  // This body has escaped the influence of a body, it should now orbit the sun!
  if (spheresOfInfluence.length === 0) {
    if (body.primary !== sun) {
      this._switchSphereOfInfluence(body, sun);
    }
  } else {

  }
};

SolarSystem.prototype._switchSphereOfInfluence = function (body, to) {
  const { position, velocity } = body;
  console.log(position);
  console.log(velocity);
  body.primary.removeSecondary(body);
  body.primary = to;
  body.primary.addSecondary(body);

  const eccentricity = OrbitUtils.Eccentricity(body, position, velocity);
  const OrbitType = this._orbitType(eccentricity);
  body.orbit = new OrbitType(body);
  body.orbit.setFromCartesian(position, velocity);
};

SolarSystem.prototype._applyRotation = (function () {
  // Initialize objects once to avoid frequent object creation
  const adjustment = new Quaternion();
  const axisX = new Vector3(1, 0, 0);
  const axisY = new Vector3(0, 1, 0);
  const axisZ = new Vector3(0, 0, 1);

  // rad / second
  const DAMPING_STEP = Math.PI / (2 ** 9);

  const dampenMotion = (val) => {
    let adjusted = val - (Math.sign(val) * DAMPING_STEP);
    if (Math.abs(adjusted) < 10e-10) {
      adjusted = 0;
    }

    return adjusted;
  };

  return function applyRotation(body, dt) {
    const rotation = body.motion.rotation;
    const sasEnabled = body.motion.sas;

    if (body.motion.pitch !== 0) {
      adjustment.setFromAxisAngle(axisX, (body.motion.pitch * dt) / 1000);
      rotation.multiply(adjustment);

      if (sasEnabled) {
        body.motion.pitch = dampenMotion(body.motion.pitch);
      }
    }

    if (body.motion.roll !== 0) {
      adjustment.setFromAxisAngle(axisY, (body.motion.roll * dt) / 1000);
      rotation.multiply(adjustment);

      if (sasEnabled) {
        body.motion.roll = dampenMotion(body.motion.roll);
      }
    }

    if (body.motion.yaw !== 0) {
      adjustment.setFromAxisAngle(axisZ, (body.motion.yaw * dt) / 1000);
      rotation.multiply(adjustment);

      if (sasEnabled) {
        body.motion.yaw = dampenMotion(body.motion.yaw);
      }
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

    const velocity = body.velocity.clone().add(deltaV);
    const position = body.position.clone().add(
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
