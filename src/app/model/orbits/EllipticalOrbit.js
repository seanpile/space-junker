import { Quaternion, Vector3, Math as threeMath } from 'three';
import hash from 'string-hash';
import Orbit from './Orbit';
import {
  JulianDate,
  TransformToEcliptic,
  CalculateMeanAnomaly,
  CalculateEccentricAnomaly,
} from './OrbitUtils';

const degToRad = threeMath.degToRad;

class EllipticalOrbit extends Orbit {

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
    const M = CalculateMeanAnomaly(L, w, perturbations, T);

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


      M = E - (e * Math.sin(E));
    }

    this.a = a;
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
    const n = Math.sqrt(u / (this.a ** 3));
    this.M = (this.M + (n * (dt / 1000))) % (2 * Math.PI);

    this.updateStats();
  }

  /**
   * Return the projected Mean Anomaly and Time when the body will reach this point
   * on the orbit.
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

    let angle = Math.atan2(perifocalPosition.y, perifocalPosition.x);
    if (angle < 0) {
      angle = (2 * Math.PI) + angle;
    }
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

    // Calculate true anomaly
    const E = CalculateEccentricAnomaly(e, M);
    const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
                                       Math.sqrt(1 - e) * Math.cos(E / 2));

    // Calculate perifocal coordinates in the planets orbital plane
    const perifocalPosition = new Vector3(
        a * (Math.cos(E) - e),
        a * Math.sqrt(1 - (e ** 2)) * Math.sin(E),
        0);

    // Calculate the velocity in the planets perifocal plane
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

export default EllipticalOrbit;
