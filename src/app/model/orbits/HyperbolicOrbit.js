import { Vector3, Math as threeMath } from 'three';
import Orbit from './Orbit';
import {
  JulianDate,
  TransformToEcliptic,
  CalculateMeanAnomaly,
  CalculateEccentricAnomaly,
} from './OrbitUtils';

const degToRad = threeMath.degToRad;

class HyperbolicOrbit extends Orbit {

  static supports(e) {
    return e > 1;
  }

  setFromKeplerElements(keplerElements, t) {

    const T = JulianDate(t);
    const a = keplerElements.a[0] + (keplerElements.a[1] * T);
    const e = keplerElements.e[0] + (keplerElements.e[1] * T);
    const I = keplerElements.I[0] + (keplerElements.I[1] * T);
    const L = keplerElements.L[0] + (keplerElements.L[1] * T);
    const w = keplerElements.w[0] + (keplerElements.w[1] * T);
    const omega = keplerElements.omega[0] + (keplerElements.omega[1] * T);
    const argumentPerihelion = w - omega;
    const M = CalculateMeanAnomaly(L, w);

    this.a = a;
    this.e = e;
    this.I = degToRad(I);
    this.omega = degToRad(omega);
    this.argumentPerihelion = degToRad(argumentPerihelion);
    this.M = degToRad(M);

    this.updateStats();
    return this;
  }

  setFromCartesian(position, velocity) {

    const r = new Vector3();
    const v = new Vector3();
    const h = new Vector3();
    const n = new Vector3();
    const ecc = new Vector3();
    const axisZ = new Vector3(0, 0, 1);

    const primary = this.body.primary;
    const u = primary.constants.u;

    r.subVectors(position, primary.position);
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

    let trueAnomaly = Math.acos(
      r.dot(ecc) / (ecc.length() * r.length()));

    if (r.dot(v) < 0) {
      trueAnomaly = (2 * Math.PI) - trueAnomaly;
    }

    let argumentPerihelion;
    if (n.length() <= 0) {
      // Zero Inclination
      argumentPerihelion = Math.atan2(ecc.y, ecc.x);
      if (h.z < 0) {
        argumentPerihelion = (2 * Math.PI) - argumentPerihelion;
      }

    } else {

      argumentPerihelion = Math.acos(n.dot(ecc) / (n.length() * ecc.length()));
      if (ecc.z < 0) {
        argumentPerihelion = (2 * Math.PI) - argumentPerihelion;
      }
    }

    const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(trueAnomaly / 2));
    const M = (e * Math.sinh(F)) - F;

    this.a = a;
    this.e = e;
    this.I = I;
    this.omega = omega;
    this.argumentPerihelion = argumentPerihelion;
    this.M = M;

    this.updateStats();
    return this;
  }

  meanAngularMotion() {
    const u = this.body.primary.constants.u;
    return Math.sqrt(u / (Math.pow(-this.a, 3)));
  }

  toMeanAnomaly(trueAnomaly) {
    const e = this.e;
    const F = 2 * Math.atanh((Math.sqrt(e - 1) / Math.sqrt(e + 1)) * Math.tan(trueAnomaly / 2));
    return (e * Math.sinh(F)) - F;
  }

  updateStats() {

    const e = this.e;
    const a = this.a;
    const argumentPerihelion = this.argumentPerihelion;
    const omega = this.omega;
    const I = this.I;
    const M = this.M;
    const u = this.body.primary.constants.u;
    const offset = this.body.primary.position;

    const H = CalculateEccentricAnomaly(e, M);
    // const H = HyperbolicOrbit.CalculateHyperbolicEccentricity(e, M);
    const trueAnomaly = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));

    const r =
      (a * (1 - (e ** 2))) /
      (1 + (e * Math.cos(trueAnomaly)));

    // Calculate heliocentric coordinates in the planets orbital plane
    const perifocalPosition = new Vector3(
      r * Math.cos(trueAnomaly),
      r * Math.sin(trueAnomaly),
      0);

    // Calculate the velocity in the planets orbital planet
    const perifocalVelocity = new Vector3(
      -Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0).normalize().multiplyScalar(Math.sqrt(u * ((2 / r) - (1 / a))));

    const b = a * Math.sqrt((e ** 2) - 1);
    const periapsis = new Vector3(a * (1 - e), 0, 0);
    const apoapsis = undefined;
    const center = new Vector3(periapsis.x - a, 0, 0);
    const orbitalPeriod = Infinity;

    this.stats = Object.assign({}, this.stats, {
      orbitalPeriod,
      semiMajorAxis: a,
      semiMinorAxis: b,
      position: TransformToEcliptic(offset, perifocalPosition, argumentPerihelion, omega, I),
      velocity: TransformToEcliptic(null, perifocalVelocity, argumentPerihelion, omega, I),
      center: TransformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: TransformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: TransformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    });
  }

}

export default HyperbolicOrbit;
