export default class Orbit {

  constructor(body) {
    this.body = body;
    this.stats = {};
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
