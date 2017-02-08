import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

const DEFAULT_FOCUS = 'earth';

const PLANET_COLOURS = {
  "mercury": "silver",
  "mars": "red",
  "earth": "skyblue",
  "venus": "green",
  "sun": "yellow",
  "jupiter": "orange",
  "saturn": "tan",
  "uranus": "skyblue",
  "neptune": "lightblue",
  "pluto": "silver"
};

const PLANET_SIZES = {
  "mercury": 2.5,
  "venus": 6,
  "earth": 3,
  "iss": 0.5,
  "pluto": 6,
  "mars": 3.5,
  "jupiter": 10,
  "uranus": 7,
  "neptune": 7,
  "saturn": 8,
  "sun": 15,
}

function OrbitalMapRenderer(container, backgroundImage) {

  let width = 1024;
  let height = 680;

  this.container = container;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(width, height);
  container.appendChild(this.renderer.domElement);

  this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);
  this.camera.position.z = 5;

  this.scene = new THREE.Scene();
  this.planetMap = new Map();
  this.focus = DEFAULT_FOCUS;
  this.prevTrajectory = Object.create(null);

  const scope = this;
  const onClick = (event) => {
    let pixelMultiplier = window.devicePixelRatio;
    let target = new THREE.Vector2(
      (event.clientX - width / 2) * pixelMultiplier,
      (height / 2 - event.clientY) * pixelMultiplier);

    // Do a hit-test check for all planets
    let found = Object.keys(scope.planetMap)
      .map((id) => {

        let projection = scope.planetMap[id].body.position.clone()
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
      scope.cameraChanged = true;
    }
  };

  const onChangeOrbit = (event) => {
    scope.cameraChanged = true;
  };

  this.addHandlers = function () {
    scope.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    scope.orbitControls.maxDistance = 100;
    scope.orbitControls.dollySpeed = 5.0;
    scope.orbitControls.addEventListener("change", onChangeOrbit);
    addEventListener("mousedown", onClick);
  };

  this.removeHandlers = function () {
    scope.orbitControls.removeEventListener("change", onChangeOrbit);
    scope.orbitControls.dispose();
    removeEventListener("mousedown", onClick);
  };
};

OrbitalMapRenderer.prototype.recenter = function () {
  console.log("Resetting camera");
  this.camera.position.set(0, 0, 5);
  this.camera.lookAt(new THREE.Vector3(0, 0, 0));
  this.cameraChanged = true;
};

OrbitalMapRenderer.prototype.initialize = function (solarSystem) {

  // Add event handlers, orbit controls
  this.addHandlers();

  // Maintain a mapping from planet -> THREE object representing the planet
  // This will allow us to update the existing THREE object on each iteration
  // of the render loop.
  solarSystem.planets.forEach(function (planet) {

    // Remove all existing objects from scene map
    let threeObjects = this.planetMap[planet.name] || {};
    for (let threeObject of Object.values(threeObjects))
      this.scene.remove(threeObject);

    const threeBody = new THREE.Mesh(new THREE.SphereGeometry(planet.constants.radius, 32, 32),
      new THREE.MeshBasicMaterial({
        color: PLANET_COLOURS[planet.name]
      }));

    this.scene.add(threeBody);
    this.planetMap[planet.name] = Object.create(null);
    this.planetMap[planet.name].body = threeBody;

    if (planet.name !== 'sun') {

      const periapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
        new THREE.MeshBasicMaterial({
          color: 'purple'
        }));

      const apoapsis = new THREE.Mesh(new THREE.SphereGeometry(0.01, 32, 32),
        new THREE.MeshBasicMaterial({
          color: 'aqua'
        }));

      const trajectory = new THREE.Line(new THREE.RingGeometry(1, 1, 1024),
        new THREE.LineBasicMaterial({
          color: PLANET_COLOURS[planet.name]
        }));

      this.scene.add(periapsis);
      this.scene.add(apoapsis);
      this.scene.add(trajectory);

      this.planetMap[planet.name].periapsis = periapsis;
      this.planetMap[planet.name].apoapsis = apoapsis;
      this.planetMap[planet.name].trajectory = trajectory;

      let trajectoryStats = Object.create(null);
      trajectoryStats.argumentPerihelion = 0;
      trajectoryStats.I = 0;
      trajectoryStats.omega = 0;
      this.prevTrajectory[planet.name] = trajectoryStats;
    }

  }, this);

  this.scene.background = new THREE.Color('black');
  this.cameraChanged = true;
  return Promise.resolve();
};

OrbitalMapRenderer.prototype.uninitialize = function () {
  this.removeHandlers();
};

OrbitalMapRenderer.prototype.render = function (solarSystem) {

  const focus = solarSystem.planets.find((planet) => planet.name === this.focus);

  solarSystem.planets.forEach((planet) => {

    let threeBody = this.planetMap[planet.name].body;
    let derived = planet.derived;

    // Adjust position to re-center the coordinate system on the focus
    let position = this._adjustCoordinates(focus, derived.position);

    threeBody.position.set(position.x, position.y, position.z);

    if (planet.name !== 'sun') {
      let apoapsis = this._adjustCoordinates(focus, derived.apoapsis);
      let periapsis = this._adjustCoordinates(focus, derived.periapsis);

      let threePeriapsis = this.planetMap[planet.name].periapsis;
      let threeApoapsis = this.planetMap[planet.name].apoapsis;
      threePeriapsis.position.set(periapsis.x, periapsis.y, periapsis.z);
      threeApoapsis.position.set(apoapsis.x, apoapsis.y, apoapsis.z);

      this._updateTrajectory(focus, planet);
    }

    this._scalePlanet(planet);

  });

  this.renderer.render(this.scene, this.camera);
  this.cameraChanged = false;
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
  if (!this.cameraChanged) {
    return;
  }

  let sizeAt1AU = 0.005;

  let threeBody = this.planetMap[planet.name].body;
  let cameraDistance = this.camera.position.distanceTo(threeBody.position);
  let size = 2 * cameraDistance * sizeAt1AU;
  let scale = size / planet.constants.radius;

  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, planet) {
  // Redraw the trajectory for this planet
  let trajectory = this.planetMap[planet.name].trajectory;

  let derived = planet.derived;
  let semiMajorAxis = derived.semiMajorAxis;
  let semiMinorAxis = derived.semiMinorAxis;
  let center = this._adjustCoordinates(focus, derived.center);

  // Reset the trajectory to a fresh state to allow for updated coordinates
  let prev = this.prevTrajectory[planet.name];
  trajectory.scale.set(1, 1, 1);
  trajectory.rotateZ(-prev.argumentPerihelion);
  trajectory.rotateX(-prev.I);
  trajectory.rotateZ(-prev.omega);
  trajectory.position.set(0, 0, 0);

  // Now adjust the trajectory to its actual orientation
  trajectory.translateX(center.x);
  trajectory.translateY(center.y);
  trajectory.translateZ(center.z);
  trajectory.rotateZ(derived.omega);
  trajectory.rotateX(derived.I);
  trajectory.rotateZ(derived.argumentPerihelion);
  trajectory.scale.set(semiMajorAxis, semiMinorAxis, 1);

  this.prevTrajectory[planet.name].argumentPerihelion = derived.argumentPerihelion;
  this.prevTrajectory[planet.name].I = derived.I;
  this.prevTrajectory[planet.name].omega = derived.omega;
};

export default OrbitalMapRenderer;
