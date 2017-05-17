import hash from 'string-hash';
import { Quaternion, Vector3 } from 'three';

export default class Orbit {

  constructor(body, a, e, I, omega, argumentPerihelion, M) {
    this.body = body;
    this.a = a;
    this.e = e;
    this.I = I;
    this.omega = omega;
    this.argumentPerihelion = argumentPerihelion;
    this.M = M;
    this.stats = {};
  }

  toString() {
    return `
      ${this.body.name}
      ---
        a = ${this.a}
        e = ${this.e},
        I = ${this.I},
        omega = ${this.omega},
        argumentPerihelion = ${this.argumentPerihelion},
        Mean Anomaly = ${this.M}`;
  }

  /**
   * Generates a unique hashcode for this orbit; Note, we don't include mean anomaly
   * because that changes over time.
   */
  hashCode() {
    const prime = 31;
    let result = 1;
    result = (prime * result) + hash(`${this.a}`);
    result = (prime * result) + hash(`${this.e}`);
    result = (prime * result) + hash(`${this.I}`);
    result = (prime * result) + hash(`${this.omega}`);
    result = (prime * result) + hash(`${this.argumentPerihelion}`);
    return result;
  }

  static supports(e) {
    throw new Error('unimplemented method');
  }

  clone() {
    throw new Error('unimplemented method');
  }

  toMeanAnomaly(trueAnomaly) {
    throw new Error('unimplemented method');
  }

  setFromKeplerElements(keplerElements, t) {
    throw new Error('unimplemented method');
  }

  setFromCartesian(position, velocity) {
    throw new Error('unimplemented method');
  }

  updateStats() {
    throw new Error('unimplemented method');
  }

  /**
   * Return the projected orbit for the body at this location on the orbit
   */
  project(location) {

    const position = new Vector3().subVectors(location, this.body.primary.position);

    const Q1 = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 0, 1), -this.omega);
    const Q2 = new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), -this.I);
    const Q3 = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 0, 1), -this.argumentPerihelion);

    const perifocalPosition = new Vector3()
      .copy(position)
      .applyQuaternion(Q1)
      .applyQuaternion(Q2)
      .applyQuaternion(Q3);

    let trueAnomaly = Math.atan2(perifocalPosition.y, perifocalPosition.x);
    if (trueAnomaly < 0) {
      trueAnomaly = (2 * Math.PI) + trueAnomaly;
    }

    const M = this.toMeanAnomaly(trueAnomaly);

    const projectedOrbit = this.clone();
    projectedOrbit.M = M;
    projectedOrbit.updateStats();

    return projectedOrbit;
  }

  /**
   * Returns the time (in seconds) the body will reach the given mean anomaly.
   */
  delta(M) {
    if (this.e < 1) {
      if (M < this.M) {
        return (((2 * Math.PI) + M) - this.M) / this.meanAngularMotion();
      }

      return (M - this.M) / this.meanAngularMotion();
    }

    // Orbit's do not repeat if e <= 1, point will never be reached
    if (M < this.M) {
      return Infinity;
    }

    return (M - this.M) / this.meanAngularMotion();
  }

  /**
   * Modifies this orbit by advancing by time dt (milliseconds)
   */
  advance(dt) {
    const n = this.meanAngularMotion();
    let M = (this.M + (n * (dt / 1000)));

    // Keep anomaly capped to 360 degrees for repeating orbits
    if (this.e < 1) {
      M %= (2 * Math.PI);
    }

    this.M = M;
    this.updateStats();
  }

}
