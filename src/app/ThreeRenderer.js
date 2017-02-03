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
  "earth": 6.3,
  "pluto": 6,
  "mars": 3.5,
  "jupiter": 10,
  "uranus": 7,
  "neptune": 7,
  "saturn": 8,
  "sun": 15,
}

function ThreeRenderer(container, backgroundImage) {

  let width = 1024;
  let height = 680;

  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(width, height);
  container.appendChild(this.renderer.domElement);

  let timeCounter = container.getRootNode()
    .createElement("h3");
  this.timeCounter = timeCounter;
  container.appendChild(timeCounter);

  this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  this.camera.position.z = 5
  this.camera.lookAt(new THREE.Vector3(0, 0, 0));

  let orbitControls = new OrbitControls(this.camera, container);
  this.orbitControls = orbitControls;

  this.scene = new THREE.Scene();
  this.bodyMap = new Map();

  addEventListener("keypress", function (event) {
    if (event.keyCode === 99) {
      this.recenter();
    }
  }.bind(this));
};

ThreeRenderer.prototype.recenter = function () {
  this.orbitControls.reset();
};

ThreeRenderer.prototype.initialize = function (solarSystem) {

  // Maintain a mapping from planet -> THREE object representing the planet
  // This will allow us to update the existing THREE object on each iteration
  // of the render loop.

  // Removing all existing bodies from the scene
  for (obj in this.bodyMap.values()) {
    this.scene.remove(threeObject);
  }
  this.bodyMap.clear();

  return new Promise((resolve, reject) => {
    solarSystem.bodies.forEach(function (body) {

      const threeBody = new THREE.Mesh(new THREE.SphereGeometry((PLANET_SIZES[body.id] || 5) / 100, 32, 32),
        new THREE.MeshBasicMaterial({
          color: PLANET_COLOURS[body.id] || 'skyblue'
        }));

      this.scene.add(threeBody);
      this.bodyMap.set(body.id, threeBody);

    }, this);

    this.scene.background = new THREE.Color('black');
    resolve();
  });

};

ThreeRenderer.prototype.render = function (time, solarSystem) {

  solarSystem.bodies.forEach(function updatePositions(body) {

    const threeBody = this.bodyMap.get(body.id);
    let position = body.position.multiplyScalar(AU_SCALE);
    threeBody.position.set(position.x, position.y, position.z);

  }, this);

  this.timeCounter.innerHTML = `${moment(time).format()}`;
  this.renderer.render(this.scene, this.camera);
};

export default ThreeRenderer;
