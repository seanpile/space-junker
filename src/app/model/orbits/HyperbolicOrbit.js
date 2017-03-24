import { Vector3, Math as threeMath } from 'three';
import { JulianDate, TransformToEcliptic, CalculateMeanAnomaly } from './OrbitUtils';

const degToRad = threeMath.degToRad;

class HyperbolicOrbit {

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

    let trueAnomaly = Math.acos(
      r.dot(ecc) / (ecc.length() * r.length()));

    if (r.dot(v) < 0) {
      trueAnomaly = (2 * Math.PI) - trueAnomaly;
    }

    let argumentPerihelion;
    if (n.length() <= 0) {
      argumentPerihelion = 0;
    } else {
      argumentPerihelion = Math.acos(n.dot(ecc) / (n.length() * ecc.length()));
    }

    if (ecc.z < 0) {
      argumentPerihelion = (2 * Math.PI) - argumentPerihelion;
    }

    const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(trueAnomaly / 2));
    const M = (e * Math.sinh(F)) - F;

    this.a = a;
    this.e = e;
    this.I = I;
    this.omega = omega;
    this.argumentPerihelion = argumentPerihelion;
    this.M = M;
  }

  advance(dt) {
    const u = this.body.primary.constants.u;

    /**
     * For elliptical orbits, M - M0 = n(t - t0)
     */
    const n = Math.sqrt(u / (Math.pow(-this.a, 3)));
    this.M = (this.M + (n * (dt / 1000))) % (Math.PI * 2);
  }

  stats(dt) {

    const e = this.e;
    const a = this.a;
    const argumentPerihelion = this.argumentPerihelion;
    const omega = this.omega;
    const I = this.I;
    const M = this.M;
    const u = this.body.primary.constants.u;
    const offset = this.body.primary.derived.position;

    const H = HyperbolicOrbit.CalculateHyperbolicEccentricity(e, M);
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
    const rotation = (this.body.derived.rotation || 0) +
        ((2 * Math.PI * dt) /
        ((this.body.constants.rotation_period || 1) * 86400e3));

    return {
      orbitalPeriod,
      rotation,
      semiMajorAxis: a,
      semiMinorAxis: b,
      position: TransformToEcliptic(offset, perifocalPosition, argumentPerihelion, omega, I),
      velocity: TransformToEcliptic(null, perifocalVelocity, argumentPerihelion, omega, I),
      center: TransformToEcliptic(offset, center, argumentPerihelion, omega, I),
      periapsis: TransformToEcliptic(offset, periapsis, argumentPerihelion, omega, I),
      apoapsis: TransformToEcliptic(offset, apoapsis, argumentPerihelion, omega, I),
    };
  }

  static CalculateEccentricAnomaly(e, M) {
    const tol = 10e-8;
    const maxTimes = 10;

    let E = M;
    let numTimes = 0;
    do {
      const f0 = E - ((e * Math.sin(E)) + M);
      const f1 = 1 - (e * Math.cos(E));
      const ratio = f0 / f1;

      if (Math.abs(ratio) <= tol) {
        return E;
      }

      E -= ratio;
      numTimes += 1;
    } while (numTimes < maxTimes);

    if (numTimes > maxTimes) {
      console.error("Didn't iterate on a solution!");
    }

    return E;
  }

  static CalculateHyperbolicEccentricity(e, M) {

    const tol = 10e-8;
    const maxTimes = 10;

    let deltaH;
    let H0 = M;
    let numTimes = 0;
    do {
      const f0 = ((e * Math.sinh(H0)) - H0) - M;
      const f1 = (e * Math.cosh(H0)) - 1;
      deltaH = f0 / f1;

      if (Math.abs(deltaH) < tol) {
        return H0;
      }

      H0 -= deltaH;
      numTimes += 1;
    } while (numTimes <= maxTimes);

    if (numTimes > maxTimes) {
      throw new Error(`Didn't iterate on a solution! (e = ${e}, M = ${M})`);
    }

    return H0;
  }

}

export default HyperbolicOrbit;
