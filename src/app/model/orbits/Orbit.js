import hash from 'string-hash';

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

  setFromKeplerElements(keplerElements, t) {
    throw new Error('unimplemented method');
  }

  setFromCartesian(position, velocity) {
    throw new Error('unimplemented method');
  }

  advance(dt) {
    throw new Error('unimplemented method');
  }

}
