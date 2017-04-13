import { Vector3 } from 'three';
import StationaryOrbit from './orbits/StationaryOrbit';

/**
 * Kepler elements taken from http://ssd.jpl.nasa.gov/txt/aprx_pos_planets.pdf
 * Planetary constants taken from http://www.braeunig.us/space/constant.htm
 *
 * All distances are scaled down by the AU to reduce the size of the numbers
 * throughout the simulation.
 */
class Body {

  constructor(name, constants) {
    this.name = name;
    this.constants = constants;
    this.primary = null;
    this.secondaries = [];
    this.orbit = new StationaryOrbit(this);
    this.maneuvers = [];
  }

  isPlanet() {
    return false;
  }

  isShip() {
    return false;
  }

  get position() {
    return this.orbit.stats.position;
  }

  get velocity() {
    return this.orbit.stats.velocity;
  }

  get mass() {
    return this.constants.mass;
  }

  hasSecondary(body) {
    return this.secondaries.some(s => s === body);
  }

  addSecondary(body) {
    if (this.hasSecondary(body)) {
      return false;
    }

    this.secondaries.push(body);
    return true;
  }

  removeSecondary(body) {
    const idx = this.secondaries.findIndex(s => s === body);
    if (idx < 0) {
      return false;
    }

    this.secondaries.splice(idx, 1);
    return true;
  }

  relativePosition(body = this.primary) {
    if (!body) {
      return this.position;
    }

    if (!this.position || !body.position) {
      return undefined;
    }

    return new Vector3().subVectors(this.position, body.position);
  }

}

class Planet extends Body {

  isPlanet() {
    return true;
  }

}

class Ship extends Body {

  constructor(name, constants, model, stages, maneuvers = []) {
    super(name, constants);
    this.model = model;
    this.stages = stages;
    this.maneuvers = maneuvers;
  }

  isShip() {
    return true;
  }

  addSecondary(body) {
    throw new Error("Ship's cannot have bodies orbiting them");
  }

  addManeuver(maneuver) {
    this.maneuvers.push(maneuver);
  }

  get mass() {
    let mass = 0;
    this.stages.forEach((stage) => {
      mass += stage.mass + stage.propellant;
    });

    return mass;
  }

}

export { Ship, Planet };
