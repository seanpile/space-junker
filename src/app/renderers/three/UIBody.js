
import * as THREE from 'three';

class UIBody extends THREE.Group {

  constructor(body, sphere, orbit) {
    super();

    // The underlying body model object
    this.body = body;

    // Three Objects related to this body
    this.sphere = sphere;
    this.sphere.name = body.name;
    this.orbit = orbit;

    if (sphere) {
      this.add(sphere);
    }

    if (orbit) {
      this.add(orbit);
    }
  }

  updatePosition(position) {
    this.sphere.position.copy(position);
  }

  refreshOrbit(newOrbit) {
    this.remove(this.orbit);
    this.add(newOrbit);
    this.orbit = newOrbit;
  }

  hideOrbit() {
    this.orbit.visible = false;
  }

  showOrbit() {
    this.orbit.visible = true;
  }

}

export default UIBody;
