import BaseRenderer from './BaseRenderer';
import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

const DEFAULT_FOCUS = 'earth';

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

function OrbitalMapRenderer(container, textureLoader) {

  BaseRenderer.call(this, textureLoader);

  this.container = container;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(this.renderer.domElement);

  this.scene = new THREE.Scene();
  this.bodyMap = new Map();
  this.focus = DEFAULT_FOCUS;

};

OrbitalMapRenderer.prototype.recenter = function () {
  console.log("Resetting camera");
  this.camera.position.set(0, 0, 5);
  this.camera.lookAt(new THREE.Vector3(0, 0, 0));

  this.orbitControls.reset();
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
      this.camera.position.z = 5;

      const scope = this;
      const onClick = (event) => {
        let width = window.innerWidth;
        let height = window.innerHeight;

        let pixelMultiplier = window.devicePixelRatio;
        let target = new THREE.Vector2(
          (event.clientX - width / 2) * pixelMultiplier,
          (height / 2 - event.clientY) * pixelMultiplier);

        // Do a hit-test check for all planets
        let found = Object.keys(scope.bodyMap)
          .map((id) => {

            let projection = scope.bodyMap[id].body.position.clone()
              .project(scope.camera);
            let body = new THREE.Vector2(projection.x * width, projection.y * height);

            return {
              id: id,
              distance: body.distanceTo(target)
            };
          })
          .sort((left, right) => left.distance - right.distance)
          .find(({
            id,
            distance
          }) => distance < 50);

        // Update the focus to the target planet
        if (found) {
          scope.focus = found.id;
        }
      };

      const onWindowResize = this._onWindowResize(height, this.camera.fov);

      this.viewWillAppear = function () {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.maxDistance = 100;
        this.orbitControls.dollySpeed = 2.0;
        addEventListener("mousedown", onClick);
        addEventListener("resize", onWindowResize, false);

        onWindowResize();
      };

      this.viewWillDisappear = function () {
        removeEventListener("resize", onWindowResize, false);
        removeEventListener("mousedown", onClick);
        this.orbitControls.dispose();
      };

      // Maintain a mapping from planet -> THREE object representing the planet
      // This will allow us to update the existing THREE object on each iteration
      // of the render loop.
      solarSystem.planets.forEach(function (planet) {

        const threeBody = new THREE.Mesh(new THREE.SphereGeometry(planet.constants.radius, 32, 32),
          new THREE.MeshBasicMaterial({
            color: PLANET_COLOURS[planet.name] || 'white'
          }));

        this.scene.add(threeBody);
        this.bodyMap[planet.name] = Object.create(null);
        this.bodyMap[planet.name].body = threeBody;

        if (planet.name !== 'sun') {

          const periapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 'purple'
            }));

          const apoapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 'aqua'
            }));

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
              .getPoints(256))
            .createPointsGeometry(256);
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

          const trajectory = new THREE.Line(
            bufferGeometry,
            new THREE.LineBasicMaterial({
              color: PLANET_COLOURS[planet.name] || 'white'
            }));

          //this.scene.add(periapsis);
          //this.scene.add(apoapsis);
          this.scene.add(trajectory);

          this.bodyMap[planet.name].periapsis = periapsis;
          this.bodyMap[planet.name].apoapsis = apoapsis;
          this.bodyMap[planet.name].trajectory = trajectory;
          this.bodyMap[planet.name].trajectoryVertices = Array.from(vertices);
        }

      }, this);

      return Promise.resolve();
    });
};

OrbitalMapRenderer.prototype.render = function (solarSystem) {

  const focus = solarSystem.planets.find((planet) => planet.name === this.focus);

  solarSystem.planets.forEach((planet) => {

    let threeBody = this.bodyMap[planet.name].body;
    let derived = planet.derived;

    // Adjust position to re-center the coordinate system on the focus
    let position = this._adjustCoordinates(focus, derived.position);

    threeBody.position.set(position.x, position.y, position.z);

    if (planet.name !== 'sun') {
      let apoapsis = this._adjustCoordinates(focus, derived.apoapsis);
      let periapsis = this._adjustCoordinates(focus, derived.periapsis);

      let threePeriapsis = this.bodyMap[planet.name].periapsis;
      let threeApoapsis = this.bodyMap[planet.name].apoapsis;
      threePeriapsis.position.set(periapsis.x, periapsis.y, periapsis.z);
      threeApoapsis.position.set(apoapsis.x, apoapsis.y, apoapsis.z);

      this._updateTrajectory(focus, planet);
    }

    this._scalePlanet(planet);

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
    .sub(focus.derived.position);

  return coordinates;
};

OrbitalMapRenderer.prototype._scalePlanet = function (planet) {

  /** Don't do anything unless the camera changed, minor optimization */
  let sizeAt1AU = 0.005;

  let threeBody = this.bodyMap[planet.name].body;
  let cameraDistance = this.camera.position.distanceTo(threeBody.position);
  let size = 2 * cameraDistance * sizeAt1AU;
  let scale = size / planet.constants.radius;

  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, planet) {
  // Redraw the trajectory for this planet
  let trajectory = this.bodyMap[planet.name].trajectory;
  let trajectoryVertices = this.bodyMap[planet.name].trajectoryVertices;

  let derived = planet.derived;
  let position_in_plane = planet.derived.position_in_plane;
  let center_in_plane = planet.derived.center_in_plane;
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
  const range = Math.floor(positions.length / 3 / 2);
  const verticesToTest = [];

  // Look at all the odd indexed vertices only for simplification
  for (let i = 0; i < range; i++) {
    const offset = (i * 2 + 1) * 3;
    verticesToTest.push(new THREE.Vector3(trajectoryVertices[offset],
      trajectoryVertices[offset + 1], trajectoryVertices[offset + 2]));
  };

  // Find the vertex that is closest to the planets position
  const sorted = verticesToTest.map((vertex, idx) => [vertex.distanceTo(scaledPosition), vertex, idx])
    .sort((left, right) => {
      return left[0] - right[0];
    });

  // Overwrite the closest vertex with the planets actual position.  This will
  // ensure that a vertex for our trajectory is always located at the planets
  // location.
  sorted.forEach((element, idx) => {
    let vertex = element[1];
    let offset = (element[2] * 2 + 1) * 3;
    if (idx == 0) {
      positions[offset] = scaledPosition.x;
      positions[offset + 1] = scaledPosition.y
      positions[offset + 2] = scaledPosition.z;
    } else {
      positions[offset] = trajectoryVertices[offset];
      positions[offset + 1] = trajectoryVertices[offset + 1];
      positions[offset + 2] = trajectoryVertices[offset + 2];
    }
  });

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

Object.assign(OrbitalMapRenderer.prototype, BaseRenderer.prototype);

export default OrbitalMapRenderer;
