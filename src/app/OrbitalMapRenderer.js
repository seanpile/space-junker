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
  this.cameraChanged = true;
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
          scope.cameraChanged = true;
        }
      };

      const onChangeOrbit = (event) => {
        scope.cameraChanged = true;
      };

      const onWindowResize = this._onWindowResize(height, this.camera.fov);

      this.viewWillAppear = function () {
        scope.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        scope.orbitControls.maxDistance = 100;
        scope.orbitControls.dollySpeed = 2.0;
        scope.orbitControls.addEventListener("change", onChangeOrbit);
        addEventListener("mousedown", onClick);
        addEventListener("resize", onWindowResize, false);

        onWindowResize();
      };

      this.viewWillDisappear = function () {
        removeEventListener("resize", onWindowResize, false);
        removeEventListener("mousedown", onClick);
        scope.orbitControls.removeEventListener("change", onChangeOrbit);
        scope.orbitControls.dispose();
      };

      // Maintain a mapping from planet -> THREE object representing the planet
      // This will allow us to update the existing THREE object on each iteration
      // of the render loop.
      solarSystem.planets.forEach(function (planet) {

        const threeBody = new THREE.Mesh(new THREE.SphereGeometry(planet.constants.radius, 32, 32),
          new THREE.MeshBasicMaterial({
            color: PLANET_COLOURS[planet.name]
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

          const trajectory = new THREE.Line(new THREE.RingGeometry(1, 1, 1024),
            new THREE.LineBasicMaterial({
              color: PLANET_COLOURS[planet.name]
            }));

          //this.scene.add(periapsis);
          //this.scene.add(apoapsis);
          this.scene.add(trajectory);

          this.bodyMap[planet.name].periapsis = periapsis;
          this.bodyMap[planet.name].apoapsis = apoapsis;
          this.bodyMap[planet.name].trajectory = trajectory;
        }

      }, this);

      this.cameraChanged = true;
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

  let threeBody = this.bodyMap[planet.name].body;
  let cameraDistance = this.camera.position.distanceTo(threeBody.position);
  let size = 2 * cameraDistance * sizeAt1AU;
  let scale = size / planet.constants.radius;

  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, planet) {
  // Redraw the trajectory for this planet
  let trajectory = this.bodyMap[planet.name].trajectory;

  let derived = planet.derived;
  let semiMajorAxis = derived.semiMajorAxis;
  let semiMinorAxis = derived.semiMinorAxis;
  let center = this._adjustCoordinates(focus, derived.center);

  // Reset the trajectory to a fresh state to allow for updated coordinates
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
