import BaseRenderer from './BaseRenderer';
import OrbitControls from './lib/OrbitControls';
import {
  FIXED_TYPE,
  PHYSICS_TYPE,
  ASTEROID_TYPE
} from './Bodies';
import * as THREE from 'three';

const TRAJECTORY_SCALE = 5;
const SHOW_VELOCITY_VECTORS = false;

const PLANET_COLOURS = {
  "sun": "yellow",
  "mercury": "silver",
  "venus": "green",
  "earth": "skyblue",
  "moon": "gray",
  "mars": "red",
  "jupiter": "orange",
  "saturn": "tan",
  "uranus": "skyblue",
  "neptune": "lightblue",
  "pluto": "silver"
};

function OrbitalMapRenderer(container, textureLoader, commonState) {

  BaseRenderer.call(this, textureLoader, commonState);

  this.container = container;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(this.renderer.domElement);

  this.scene = new THREE.Scene();
  this.bodyMap = new Map();
};

OrbitalMapRenderer.prototype.viewDidLoad = function (solarSystem) {

  return Promise.all([
      this._loadTextures()
    ])
    .then(([textures]) => {

      let width = window.innerWidth;
      let height = window.innerHeight;

      this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);
      this.camera.up = new THREE.Vector3(0, 0, 1);

      const skybox = this._createSkyBox(textures);
      this.scene.add(skybox);

      const recenter = () => {
        const focus = solarSystem.find(this.state.focus);

        // For all bodies (except sun), use the size of the orbiting radius for
        // the camera position.
        let cameraDistance;
        if (focus.name === 'sun') {
          cameraDistance = 100;
        } else {
          let position = focus.derived.position;
          let primary_position = focus.primary.derived.position;
          cameraDistance = 10 * primary_position.distanceTo(position);
        }

        this.orbitControls.reset();
        this.camera.position.set(0, 0, cameraDistance);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      };

      this.addEventListener('click', (event) => {
        const location = event.location;

        // Do a hit-test check for all planets
        const found = Array.from(this.bodyMap.entries())
          .map((entry) => {

            const id = entry[0];
            const objects = entry[1];

            const position = objects.body.position.clone();
            const projection = position.project(this.camera);
            const body = new THREE.Vector2(projection.x * width, projection.y * height);

            return {
              id: id,
              distance: body.distanceTo(location)
            };
          })
          .sort((left, right) => left.distance - right.distance)
          .find(({
            id,
            distance
          }) => distance < 50);

        // Update the focus to the target planet
        if (found) {
          this.state.focus = found.id;
        }
      });

      this.addEventListener('focus', (event) => {
        recenter();
      });

      this.addEventListener('recenter', (event) => {
        recenter();
      })

      const onWindowResize = this._onWindowResize(height, this.camera.fov);
      this.addEventListener('resize', (event) => {
        onWindowResize();
      });

      this.viewWillAppear = function () {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.maxDistance = 100 * TRAJECTORY_SCALE;
        this.orbitControls.dollySpeed = 2.0;
        onWindowResize();
        recenter();
      };

      this.viewWillDisappear = function () {
        this.orbitControls.dispose();
        this.orbitControls = null;
      };

      // Maintain a mapping from planet -> THREE object representing the planet
      // This will allow us to update the existing THREE object on each iteration
      // of the render loop.
      solarSystem.bodies.forEach((body) => {

        this.bodyMap.set(body.name, {});

        const threeBody = new THREE.Mesh(new THREE.SphereGeometry(body.constants.radius, 32, 32),
          new THREE.MeshBasicMaterial({
            color: PLANET_COLOURS[body.name] || 'white'
          }));

        const periapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
          new THREE.MeshBasicMaterial({
            color: 'purple'
          }));

        const apoapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
          new THREE.MeshBasicMaterial({
            color: 'aqua'
          }));

        this.scene.add(threeBody);
        //this.scene.add(periapsis);
        //this.scene.add(apoapsis);

        if (body.name !== 'sun') {

          const trajectory = new THREE.Line(
            this._createTrajectoryGeometry(),
            new THREE.LineBasicMaterial({
              color: PLANET_COLOURS[body.name] || 'white'
            }));

          this.scene.add(trajectory);
          this.bodyMap.get(body.name)
            .trajectory = trajectory;
          this.bodyMap.get(body.name)
            .trajectoryVertices = Array.from(trajectory.geometry.attributes.position.array);
          this.bodyMap.get(body.name)
            .trajectoryVerticesDirty = [];
        }

        Object.assign(this.bodyMap.get(body.name), {
          body: threeBody,
          periapsis: periapsis,
          apoapsis: apoapsis,
        });

      });

      return Promise.resolve();
    });
};

OrbitalMapRenderer.prototype.render = function (solarSystem) {

  // Find the current user focus
  const focus = solarSystem.find(this.state.focus);

  // Locate primary body, sun
  const sun = solarSystem.find('sun');

  solarSystem.bodies.forEach((body) => {

    let bodyMap = this.bodyMap.get(body.name);
    let threeBody = bodyMap.body;
    let threePeriapsis = bodyMap.periapsis;
    let threeApoapsis = bodyMap.apoapsis;
    let derived = body.derived;

    // Adjust position to re-center the coordinate system on the focus
    let position = this._adjustCoordinates(focus, derived.position);
    // let apoapsis = this._adjustCoordinates(focus, derived.apoapsis);
    // let periapsis = this._adjustCoordinates(focus, derived.periapsis);

    threeBody.position.set(position.x, position.y, position.z);

    if (SHOW_VELOCITY_VECTORS) {
      bodyMap.arrowHelper && this.scene.remove(bodyMap.arrowHelper);
      let arrowHelper = new THREE.ArrowHelper(derived.velocity.clone()
        .normalize(), position, 1, 0xffff00);
      this.scene.add(arrowHelper);
      bodyMap.arrowHelper = arrowHelper;
    }

    // threePeriapsis.position.set(periapsis.x, periapsis.y, periapsis.z);
    // threeApoapsis.position.set(apoapsis.x, apoapsis.y, apoapsis.z);

    this._updateTrajectory(focus, body);
    this._scaleBody(body);
  });

  this.renderer.render(this.scene, this.camera);
};

/**
 * Recenter the coordinate system on the focus being the 'center'.
 */
OrbitalMapRenderer.prototype._adjustCoordinates = function (focus, position) {

  if (!focus)
    return position.clone();

  let coordinates = position.clone()
    .sub(focus.derived.position)
    .multiplyScalar(TRAJECTORY_SCALE);

  return coordinates;
};

OrbitalMapRenderer.prototype._scaleBody = function (body) {

  let bodyMap = this.bodyMap.get(body.name);
  let threeBody = bodyMap.body;
  let trajectory = bodyMap.trajectory;
  let cameraDistance = this.camera.position.distanceTo(threeBody.position);

  let scale = Math.max(0.005 * cameraDistance, body.constants.radius) / body.constants.radius;
  threeBody.scale.set(scale, scale, scale);

  // Allow more 'space' between large bodies and their satellites
  trajectory && trajectory.scale.set(trajectory.scale.x * TRAJECTORY_SCALE, trajectory.scale.y * TRAJECTORY_SCALE, 1);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, body) {

  if (body.name === 'sun')
    return;

  // Redraw the trajectory for this body
  let bodyMap = this.bodyMap.get(body.name);
  let trajectory = bodyMap.trajectory;
  let trajectoryVertices = bodyMap.trajectoryVertices;
  let trajectoryVerticesDirty = bodyMap.trajectoryVerticesDirty;

  let derived = body.derived;
  let position_in_plane = body.derived.position_in_plane;
  let center_in_plane = body.derived.center_in_plane;
  let semiMajorAxis = derived.semiMajorAxis;
  let semiMinorAxis = derived.semiMinorAxis;
  let center = this._adjustCoordinates(focus, derived.center);

  let scaledPosition = new THREE.Vector3()
    .copy(position_in_plane)
    .sub(center_in_plane);
  scaledPosition.multiply(new THREE.Vector3(1 / semiMajorAxis, 1 / semiMinorAxis, 1));

  // Workaround for natural limitations of drawing arcs using straight line segments;
  // you inherently cannot track a planet moving in an ellipse between the planet
  // will always be between two vertices.  This code attempts to manually 'insert'
  // a vertex that corresponds to the planets location.
  // This fixes the issue where the trajectory would wobble in and out of the planet

  const geometry = trajectory.geometry;
  const positions = geometry.attributes.position.array;
  const range = positions.length / 3;
  const verticesToChange = 1;
  const verticesToTest = [];

  for (let i = 0; i < range; i++) {
    const offset = i * 3;
    verticesToTest.push(new THREE.Vector3(trajectoryVertices[offset],
      trajectoryVertices[offset + 1], trajectoryVertices[offset + 2]));
  };

  // Find the vertex that is closest to the planets position
  const sorted = verticesToTest.map((vertex, idx) => [vertex.distanceTo(scaledPosition), vertex, idx])
    .sort((left, right) => {
      return left[0] - right[0];
    });

  trajectoryVerticesDirty.forEach((idx) => {
    let offset = idx * 3;
    positions[offset] = trajectoryVertices[offset];
    positions[offset + 1] = trajectoryVertices[offset + 1];
    positions[offset + 2] = trajectoryVertices[offset + 2];
  });
  const updatedDirtyVertices = [];

  // Overwrite the closest vertices with the planets actual position.  This will
  // ensure that a vertex for our trajectory is always located at the planets
  // location.
  sorted.slice(0, verticesToChange)
    .forEach((element) => {
      let vertex = element[1];
      let offset = element[2] * 3;
      positions[offset] = scaledPosition.x;
      positions[offset + 1] = scaledPosition.y
      positions[offset + 2] = scaledPosition.z;

      updatedDirtyVertices.push(element[2]);
    });

  // Set new value of dirty vertices;
  bodyMap.trajectoryVerticesDirty = updatedDirtyVertices;

  // Signal that this geometry needs a redraw
  geometry.attributes.position.needsUpdate = true;

  // Finally, apply scale/rotation/translation to the trajectory to place it
  // into the correct orbit
  trajectory.scale.set(1, 1, 1);
  trajectory.rotation.set(0, 0, 0);
  trajectory.position.set(0, 0, 0);

  // Now adjust the trajectory to its actual orientation
  trajectory.translateX(center.x);
  trajectory.translateY(center.y);
  trajectory.translateZ(center.z);
  trajectory.rotateZ(derived.omega);
  trajectory.rotateX(derived.I);
  trajectory.rotateZ(derived.argumentPerihelion);
  trajectory.scale.set(semiMajorAxis, semiMinorAxis, 1);
};

OrbitalMapRenderer.prototype._createTrajectoryGeometry = function () {

  const NUM_POINTS = 256;

  // Create the trajectory using a strandard ellipse curve that will
  // eventually scale/rotate/translate into the correct orbit path during
  // the render loop.
  const pointsGeometry = new THREE.Path(new THREE.EllipseCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false, // aClockwise
        0 // aRotation
      )
      .getPoints(NUM_POINTS))
    .createPointsGeometry(NUM_POINTS);
  const bufferGeometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < pointsGeometry.vertices.length; i++) {
    vertices.push(
      pointsGeometry.vertices[i].x,
      pointsGeometry.vertices[i].y,
      pointsGeometry.vertices[i].z
    );
  }

  bufferGeometry.addAttribute('position',
    new THREE.BufferAttribute(new Float32Array(vertices), 3));

  return bufferGeometry;
};

Object.assign(OrbitalMapRenderer.prototype, BaseRenderer.prototype);

export default OrbitalMapRenderer;
