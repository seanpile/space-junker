let maneuverId = 0;

export default class Maneuver {

  constructor({ orbit, deltaV }) {
    this.maneuverId = maneuverId++;
    this.orbit = orbit;
    this.deltaV = deltaV;
  }

}
