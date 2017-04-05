import { Vector3, Math as threeMath } from 'three';
import { JulianDate, TransformToEcliptic, CalculateMeanAnomaly } from './OrbitUtils';
import Orbit from './Orbit';

const degToRad = threeMath.degToRad;

class ParabolicOrbit extends Orbit {

  constructor(body, p, e, I, omega, argumentPerihelion, M) {
    super(body, 0, e, I, omega, argumentPerihelion, M);
    this.p = p;
  }

  /**
   * Override hashCode to include p
   */
  hashCode() {
    const prime = 37;
    const hash = super.hashCode();
    return (hash * prime) + hash(`${this.p}`);
  }

  static supports(e) {
    return e === 1;
  }

  setFromKeplerElements(keplerElements, t) {
    const T = JulianDate(t);
    const p = keplerElements.p[0] + (keplerElements.p[1] * T);
    const e = keplerElements.e[0] + (keplerElements.e[1] * T);
    const I = keplerElements.I[0] + (keplerElements.I[1] * T);
    const L = keplerElements.L[0] + (keplerElements.L[1] * T);
    const w = keplerElements.w[0] + (keplerElements.w[1] * T);
    const omega = keplerElements.omega[0] + (keplerElements.omega[1] * T);
    const argumentPerihelion = w - omega;
    const M = CalculateMeanAnomaly(L, w);

    this.p = p;
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

    // Perifocal Distance and Semi-Latus Rectum
    const q = (h.length() ** 2) / (2 * u);
    const p = 2 * q;

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

    let argumentPerihelion;
    let trueAnomaly = Math.acos(
        r.dot(ecc) / (ecc.length() * r.length()));

    if (r.dot(v) < 0) {
      trueAnomaly = (2 * Math.PI) - trueAnomaly;
    }

    const D = Math.sqrt(2 * q) * Math.tan(trueAnomaly / 2);

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

    const M = (q * D) + ((D ** 3) / 6);

    this.p = p;
    this.e = e;
    this.I = I;
    this.omega = omega;
    this.argumentPerihelion = argumentPerihelion;
    this.M = M;

    this.updateStats();
    return this;
  }

  advance(dt) {
    const u = this.body.primary.constants.u;

    /**
     * For elliptical orbits, M - M0 = n(t - t0)
     */
    const n = Math.sqrt(u / Math.pow(this.p, 3));
    this.M = this.M + (n * (dt / 1000));

    this.updateStats();
  }

  updateStats() {

    const p = this.p;
    const e = this.e;
    const argumentPerihelion = this.argumentPerihelion;
    const omega = this.omega;
    const I = this.I;
    const M = this.M;
    const u = this.body.primary.constants.u;
    const offset = this.body.primary.position;

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

    const periapsis = new Vector3(q, 0, 0);
    const apoapsis = undefined;
    const center = new Vector3(0, 0, 0);
    const orbitalPeriod = Infinity;

    this.stats = Object.assign({}, this.stats, {
      orbitalPeriod,
      semiMajorAxis: p,
      semiMinorAxis: q,
      position: TransformToEcliptic(offset, perifocalPosition, argumentPerihelion, omega, I),
      velocity: TransformToEcliptic(null, perifocalVelocity, argumentPerihelion, omega, I),
      center: TransformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: TransformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: TransformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    });
  }

}

export default ParabolicOrbit;
