import { Vector3 } from 'three';

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
    this.derived = {};
  }

  isPlanet() {
    return false;
  }

  isShip() {
    return false;
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

  relativePosition() {
    if (!this.primary) {
      return this.derived.position;
    }

    if (!this.derived.position || !this.primary.derived.position) {
      return undefined;
    }

    return new Vector3().subVectors(this.derived.position, this.primary.derived.position);
  }

}

class Planet extends Body {

  isPlanet() {
    return true;
  }

}

class Ship extends Body {

  constructor(name, constants, stages) {
    super(name, constants);
    this.stages = stages;
  }

  isShip() {
    return true;
  }

  addSecondary(body) {
    throw new Error("Ship's cannot have bodies orbiting them");
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
