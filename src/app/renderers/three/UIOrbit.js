
import * as THREE from 'three';
import { adjustCoordinates } from '../RenderUtils';
import ParabolaCurve from '../curves/ParabolaCurve';
import HyperbolaCurve from '../curves/HyperbolaCurve';
import UIApsis from './UIApsis';

const NUM_POINTS = 128;
const PLANET_COLOURS = {
  sun: 'yellow',
  mercury: 'silver',
  venus: 'green',
  earth: 'skyblue',
  moon: 'gray',
  mars: 'red',
  jupiter: 'orange',
  saturn: 'tan',
  uranus: 'skyblue',
  neptune: 'lightblue',
  pluto: 'silver',
};

export default class Orbit extends THREE.Group {

  constructor(body, trajectory, periapsis, apoapsis, maneuvers = []) {
    super();

    this.body = body;
    this.trajectory = trajectory;
    this.periapsis = periapsis;
    this.apoapsis = apoapsis;
    this.maneuvers = maneuvers;
    this.name = `${body.orbit.hashCode()}`;

    this.add(trajectory);

    if (periapsis) {
      this.add(periapsis);
    }

    if (apoapsis) {
      this.add(apoapsis);
    }

    if (maneuvers && maneuvers.length > 0) {
      this.add(...maneuvers);
    }
  }

  hideApses() {
    if (this.periapsis) {
      this.periapsis.visible = false;
    }

    if (this.apoapsis) {
      this.apoapsis.visible = false;
    }
  }

  showApses() {
    if (this.periapsis) {
      this.periapsis.visible = true;
    }

    if (this.apoapsis) {
      this.apoapsis.visible = true;
    }
  }

  setColor(color) {
    this.trajectory.material.color.set(color);
  }

  update(focus, camera) {

    const stats = this.body.orbit.stats;
    // Update center position of trajectory
    adjustCoordinates(this.trajectory.position, focus, stats.center);

    const cameraDistance = camera.position.distanceTo(this.trajectory.position);
    const maxApsisScale = 2e-4;
    const apsisScale = Math.min(maxApsisScale, 8e-3 * cameraDistance);

    if (this.periapsis) {
      adjustCoordinates(this.periapsis.position, focus, stats.periapsis);
      this.periapsis.scale.set(apsisScale, apsisScale, apsisScale);
      this.periapsis.setRotationFromQuaternion(camera.quaternion);
    }

    if (this.apoapsis) {
      adjustCoordinates(this.apoapsis.position, focus, stats.apoapsis);
      this.apoapsis.scale.set(apsisScale, apsisScale, apsisScale);
      this.apoapsis.setRotationFromQuaternion(camera.quaternion);
    }

    if (this.maneuvers && this.maneuvers.length > 0) {
      this.maneuvers.forEach((m) => {
        adjustCoordinates(m.position, focus, m.maneuver.orbit.stats.position);
        m.scale.set(6 * apsisScale, 6 * apsisScale, 6 * apsisScale);
        // m.setRotationFromQuaternion(camera.quaternion);
      });
    }
  }

  addManeuver(maneuver) {
    const M0 = this.body.orbit.M;

    this.add(maneuver);
    this.maneuvers.push(maneuver);
    this.maneuvers.sort((m1, m2) => {

      let M1 = m1.maneuver.orbit.M;
      let M2 = m2.maneuver.orbit.M;

      M1 += (M1 < M0 ? 2 * Math.PI : 0);
      M2 += (M2 < M0 ? 2 * Math.PI : 0);

      return M1 - M2;
    });
  }

  static createOrbit(body, fonts) {

    const e = body.orbit.e;

    let curve;
    let hasApoapsis = false;
    if (e >= 0 && e < 1) {
      // Unit Ellipse
      curve = new THREE.EllipseCurve(
          0, 0, // ax, aY
          1, 1, // xRadius, yRadius
          0, 2 * Math.PI, // aStartAngle, aEndAngle
          false, // aClockwise
          0, // aRotation
        );
      hasApoapsis = true;

    } else if (e === 1) {
      // Unit parabola with focus centered on (0, 0), p = 1, q = 1 / 2
      curve = new ParabolaCurve(1 / 2, 0, 1, -10, 10);

    } else if (e >= 1) {
      // Unit Hyperbola
      curve = new HyperbolaCurve(
          0, 0, // ax, aY
          1, 1, // xRadius, yRadius
          -Math.PI, Math.PI,
        );
    }

    // Create the trajectory using a strandard ellipse curve that will
    // eventually scale/rotate/translate into the correct orbit path during
    // the render loop.
    const pointsGeometry =
      new THREE.Path(curve.getPoints(NUM_POINTS)).createPointsGeometry(NUM_POINTS);
    const bufferGeometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < pointsGeometry.vertices.length; i += 1) {
      vertices.push(
        pointsGeometry.vertices[i].x,
        pointsGeometry.vertices[i].y,
        pointsGeometry.vertices[i].z,
      );
    }

    bufferGeometry.addAttribute('position',
                                new THREE.BufferAttribute(new Float32Array(vertices), 3));

    const material = new THREE.LineBasicMaterial({ color: PLANET_COLOURS[body.name] || 'white' });
    const trajectory = new THREE.Line(bufferGeometry, material);

    // Save the orbit's hashcode as the name so that we can easily detect if the orbit
    // changes.
    trajectory.rotateZ(body.orbit.omega);
    trajectory.rotateX(body.orbit.I);
    trajectory.rotateZ(body.orbit.argumentPerihelion);
    trajectory.scale.set(body.orbit.stats.semiMajorAxis, body.orbit.stats.semiMinorAxis, 1);

    if (body.isShip()) {
      const periapsis = UIApsis.createApsis('Pe', fonts);
      const apoapsis = hasApoapsis ? UIApsis.createApsis('Ap', fonts) : null;
      return new Orbit(body, trajectory, periapsis, apoapsis);
    }

    return new Orbit(body, trajectory);
  }

}
