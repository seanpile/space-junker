import moment from 'moment';
import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

const AU_SCALE = 1;

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

  let timeCounter = container.getRootNode()
    .createElement("h3");
  this.timeCounter = timeCounter;
  container.appendChild(timeCounter);

  this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);
  this.camera.position.z = 5;

  this.scene = new THREE.Scene();
  this.planetMap = new Map();
  this.prevTrajectory = Object.create(null);

  const scope = this;
  const onClick = (event) => {
    console.log(event);
    if (event.type === 'keypress') {
      switch (event.keyCode) {
        default: console.log(event.keyCode);
      }
    }
  };

  this.addHandlers = function () {
    scope.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    addEventListener("mousedown", onClick);
  };

  this.removeHandlers = function () {
    scope.orbitControls.dispose();
    removeEventListener("mousedown", onClick);
  };
};

OrbitalMapRenderer.prototype.recenter = function () {
  console.log("Resetting camera");
  this.camera.position.set(0, 0, 5);
  this.camera.lookAt(new THREE.Vector3(0, 0, 0));
};

OrbitalMapRenderer.prototype.initialize = function (solarSystem) {
  console.log("Initializing OrbitalMapRenderer.js");

  // Maintain a mapping from planet -> THREE object representing the planet
  // This will allow us to update the existing THREE object on each iteration
  // of the render loop.
  solarSystem.planets.forEach(function (planet) {

    let threeObjects = this.planetMap[planet.name] || {};
    for (let threeObject of Object.values(threeObjects))
      this.scene.remove(threeObject);

    const threeBody = new THREE.Mesh(new THREE.SphereGeometry(PLANET_SIZES[planet.name] / 100, 32, 32),
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

      const trajectory = new THREE.Line(new THREE.RingGeometry(1, 1, 32),
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
  this.addHandlers();
  return Promise.resolve();
};

OrbitalMapRenderer.prototype.uninitialize = function () {
  this.removeHandlers();
};

OrbitalMapRenderer.prototype._updateTrajectory = function (planet) {
  // Redraw the trajectory for this planet
  let trajectory = this.planetMap[planet.name].trajectory;

  let derived = planet.derived;
  let semiMajorAxis = derived.semiMajorAxis;
  let semiMinorAxis = derived.semiMinorAxis;
  let center = derived.center;

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

OrbitalMapRenderer.prototype.render = function (time, solarSystem) {

  solarSystem.planets.forEach(function updatePositions(planet) {

    if (planet.name === 'sun') {
      return;
    }

    let threeBody = this.planetMap[planet.name].body;
    let threePeriapsis = this.planetMap[planet.name].periapsis;
    let threeApoapsis = this.planetMap[planet.name].apoapsis;

    let derived = planet.derived;
    let position = derived.position;
    let apoapsis = derived.apoapsis;
    let periapsis = derived.periapsis;

    threeBody.position.set(position.x, position.y, position.z);
    threePeriapsis.position.set(periapsis.x, periapsis.y, periapsis.z);
    threeApoapsis.position.set(apoapsis.x, apoapsis.y, apoapsis.z);

    this._updateTrajectory(planet);

  }, this);

  this.timeCounter.innerHTML = `${moment(time).format()}`;
  this.renderer.render(this.scene, this.camera);
};

export default OrbitalMapRenderer;