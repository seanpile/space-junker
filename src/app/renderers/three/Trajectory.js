
import * as THREE from 'three';
import ParabolaCurve from '../curves/ParabolaCurve';
import HyperbolaCurve from '../curves/HyperbolaCurve';
import Apsis from './Apsis';

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

class Trajectory extends THREE.Group {

  constructor(body, trajectory, periapsis, apoapsis) {
    super();

    this.body = body;
    this.trajectory = trajectory;
    this.periapsis = periapsis;
    this.apoapsis = apoapsis;
    this.name = `${body.orbit.hashCode()}`;

    this.add(trajectory);

    if (periapsis) {
      this.add(periapsis);
    }

    if (apoapsis) {
      this.add(apoapsis);
    }
  }

  updateCenter(center) {
    this.trajectory.position.copy(center);
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

  static createTrajectory(body, fonts) {

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
      const periapsis = Apsis.createApsis('Pe', fonts);
      const apoapsis = hasApoapsis ? Apsis.createApsis('Ap', fonts) : null;
      return new Trajectory(body, trajectory, periapsis, apoapsis);
    }

    return new Trajectory(body, trajectory);
  }

}

export default Trajectory;
