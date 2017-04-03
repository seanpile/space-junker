import { Vector3 } from 'three';
import Orbit from './Orbit';

class StationaryOrbit extends Orbit {

  constructor(body) {
    super(body);
    Object.assign(this.stats, {
      position: new Vector3(),
      velocity: new Vector3(),
      apoapsis: new Vector3(),
      periapsis: new Vector3(),
      center: new Vector3(),
    });
  }

  advance(dt) {
    // No-op
  }

}

export default StationaryOrbit;
