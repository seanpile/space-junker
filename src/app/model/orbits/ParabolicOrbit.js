import { Vector3, Math as threeMath } from 'three';
import { JulianDate, TransformToEcliptic } from './OrbitUtils';

const degToRad = threeMath.degToRad;

class ParabolicOrbit {

  constructor(body, a, e, I, omega, argumentPerihelion, M) {
    this.body = body;
    this.a = a;
    this.e = e;
    this.I = I;
    this.omega = omega;
    this.argumentPerihelion = argumentPerihelion;
    this.M = M;
  }

  static supports(e) {
    return e === 1;
  }

  setFromKeplerElements(keplerElements, t) {
    const T = JulianDate(t);
    const p = keplerElements.p[0] + (keplerElements.p[1] * T);
    const e = keplerElements.e[0] + (keplerElements.e[1] * T);
    const I = keplerElements.I[0] + (keplerElements.I[1] * T);
    const w = keplerElements.w[0] + (keplerElements.w[1] * T);
    const omega = keplerElements.omega[0] + (keplerElements.omega[1] * T);
    const argumentPerihelion = w - omega;

    // TODO: Fix
    const M = -30;

    this.p = p;
    this.e = e;
    this.I = degToRad(I);
    this.omega = degToRad(omega);
    this.argumentPerihelion = degToRad(argumentPerihelion);
    this.M = degToRad(M);

    return this;
  }

  advance(dt) {
    const u = this.body.primary.constants.u;

    /**
     * For elliptical orbits, M - M0 = n(t - t0)
     */
    const n = Math.sqrt(u / Math.pow(this.p, 3));
    this.M = this.M + (n * (dt / 1000));
  }

  stats(dt) {

    const p = this.p;
    const e = this.e;
    const argumentPerihelion = this.argumentPerihelion;
    const omega = this.omega;
    const I = this.I;
    const M = this.M;
    const u = this.body.primary.constants.u;
    const offset = this.body.primary.derived.position;

    const q = p / 2;
    const B = 3 * M;
    const trueAnomaly = 2 * Math.atan(
      Math.pow(B + Math.sqrt(1 + (B ** 2)), 1 / 3) -
      Math.pow(B + Math.sqrt(1 + (B ** 2)), -1 / 3));

    const r = (q * (1 + e)) / (1 + (e * Math.cos(trueAnomaly)));

    // Calculate heliocentric coordinates in the planets orbital plane
    const perifocalPosition = new Vector3(
      r * Math.cos(trueAnomaly),
      r * Math.sin(trueAnomaly),
      0);

    // Calculate the velocity in the planets orbital planet
    const perifocalVelocity = new Vector3(
      -Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0).normalize().multiplyScalar(Math.sqrt((2 * u) / r));

    const b = q;
    const periapsis = new Vector3(q, 0, 0);
    const apoapsis = undefined;
    const center = new Vector3(0, 0, 0);

    const orbitalPeriod = Infinity;
    const rotation = (this.body.derived.rotation || 0) +
        ((2 * Math.PI * dt) /
        ((this.body.constants.rotation_period || 1) * 86400e3));

    return {
      orbitalPeriod,
      rotation,
      semiMajorAxis: p,
      semiMinorAxis: q,
      position: TransformToEcliptic(offset, perifocalPosition, argumentPerihelion, omega, I),
      velocity: TransformToEcliptic(null, perifocalVelocity, argumentPerihelion, omega, I),
      center: TransformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: TransformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: TransformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    };
  }

}

export default ParabolicOrbit;
