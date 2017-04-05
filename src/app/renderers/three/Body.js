
import * as THREE from 'three';

class Body extends THREE.Group {

  constructor(body, sphere, trajectory) {
    super();

    // The underlying body model object
    this.body = body;

    // Three Objects related to this body
    this.sphere = sphere;
    this.sphere.name = body.name;
    this.trajectory = trajectory;

    if (sphere) {
      this.add(sphere);
    }

    if (trajectory) {
      this.add(trajectory);
    }
  }

  updatePosition(position) {
    this.sphere.position.copy(position);
  }

  refreshTrajectory(newTrajectory) {
    this.remove(this.trajectory);
    this.add(newTrajectory);
    this.trajectory = newTrajectory;
  }

  hideTrajectory() {
    this.trajectory.visible = false;
  }

  showTrajectory() {
    this.trajectory.visible = true;
  }

}

export default Body;
