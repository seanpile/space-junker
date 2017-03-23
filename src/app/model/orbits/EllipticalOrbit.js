import { Vector3, Math as threeMath } from 'three';
import { JulianDate, TransformToEcliptic } from './OrbitUtils';

const degToRad = threeMath.degToRad;

class EllipticalOrbit {

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
    return e >= 0 && e < 1;
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

    const perturbations = keplerElements.perturbations;
    const M = EllipticalOrbit.CalculateMeanAnomaly(L, w, perturbations, T);

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

    let M, argumentPerihelion;
    if (e === 0 && I === 0) {
      // Circular Orbits with zero inclincation
      let trueLongitude = Math.acos(r.x / r.length());
      if (v.x > 0) {
        trueLongitude = (2 * Math.PI) - trueLongitude;
      }

      const E = trueLongitude;
      argumentPerihelion = 0;
      M = E - (e * Math.sin(E));

    } else if (e === 0) {
      // Circular orbits with a +/- inclincation
      // True anomaly is undefined for a circular orbit because circular orbits
      // do not have a uniquely-determined periapsis; Instead, the argument of
      // latitude is used:
      const argumentLatitude = Math.atan2(
        r.z / Math.sin(I),
        (r.x * Math.cos(omega)) + (r.y * Math.sin(omega)));

      const E = 2 * Math.atan(Math.tan(argumentLatitude / 2));
      argumentPerihelion = 0;
      M = E - (e * Math.sin(E));

    } else {

      let trueAnomaly = Math.acos(
        r.dot(ecc) / (ecc.length() * r.length()));

      if (r.dot(v) < 0) {
        trueAnomaly = (2 * Math.PI) - trueAnomaly;
      }

      const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2));

      if (n.length() <= 0 || ecc.length() <= 0) {
        argumentPerihelion = 0;
      } else {
        argumentPerihelion = Math.acos(n.dot(ecc) / (n.length() * ecc.length()));
      }

      if (ecc.z < 0) {
        argumentPerihelion = (2 * Math.PI) - argumentPerihelion;
      }

      M = E - (e * Math.sin(E));
    }

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
    const n = Math.sqrt(u / (this.a ** 3));
    this.M = (this.M + (n * (dt / 1000))) % (2 * Math.PI);
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

    // Calculate true anomaly
    const E = EllipticalOrbit.CalculateEccentricAnomaly(e, M);
    const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2));

    // Calculate perifocal coordinates in the planets orbital plane
    const perifocalPosition = new Vector3(
        a * (Math.cos(E) - e),
        a * Math.sqrt(1 - (e ** 2)) * Math.sin(E),
        0);

    // Calculate the velocity in the planets orbital planet
    const perifocalVelocity = new Vector3(
      -Math.sin(trueAnomaly),
      e + Math.cos(trueAnomaly),
      0).multiplyScalar((Math.sqrt(u / (a ** 3)) * a) / Math.sqrt(1 - (e ** 2)));

    const b = a * Math.sqrt(1 - (e ** 2));
    const periapsis = new Vector3(a * (1 - e), 0, 0);
    const apoapsis = new Vector3(-a * (1 + e), 0, 0);
    const center = new Vector3(periapsis.x - a, 0, 0);

    const orbitalPeriod = 2 * Math.PI * Math.sqrt((a ** 3) /
        (u + (this.body.constants.u || 0)));

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

    const tol = 1e-8;
    const maxTimes = 30;
    let ratio = 1;
    let numTimes = 0;

    const pi2 = Math.PI * 2;
    let M0 = M / pi2;
    M0 = pi2 * (M0 - Math.floor(M0));

    let E = e < 0.8 ? M0 : Math.PI;

    while (Math.abs(ratio) > tol && numTimes < maxTimes) {
      ratio = (E - (e * Math.sin(E)) - M0) / (1 - (e * Math.cos(E)));
      E -= ratio;
      numTimes += 1;
    }

    if (numTimes >= maxTimes) {
      console.error("Didn't iterate on a solution!");
    }

    return E;
  }

  static CalculateMeanAnomaly(L, w, perturbations, T) {
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
  }

}

export default EllipticalOrbit;
