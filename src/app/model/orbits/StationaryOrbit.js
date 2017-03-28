import { Vector3 } from 'three';

class StationaryOrbit {

  advance(dt) {
    // No-op
  }

  stats() {
    return {
      position: new Vector3(),
      velocity: new Vector3(),
      apoapsis: new Vector3(),
      periapsis: new Vector3(),
      center: new Vector3(),
    };
  }

}

export default StationaryOrbit;