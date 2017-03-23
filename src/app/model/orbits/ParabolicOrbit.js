
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

  advance(dt) {
    const u = this.body.primary.constants.u;

    /**
     * For elliptical orbits, M - M0 = n(t - t0)
     */
    const n = Math.sqrt(u);
    this.M = this.M + (n * (dt / 1000));
  }

  stats(dt) {
    throw new Error('unsupported');

    // b = a / 2;
    // periapsis = new Vector3(a / 2, 0, 0);
    // apoapsis = undefined;
    // center = new Vector3(periapsis.x - (a / 2), 0, 0);
    // orbitalPeriod = Infinity;
  }

}

export default ParabolicOrbit;
