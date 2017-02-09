import BaseRenderer from './BaseRenderer';
import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

const DEFAULT_FOCUS = 'earth';

const PLANET_COLOURS = {
  "mercury": "silver",
  "mars": "red",
  "earth": "skyblue",
  "moon": "gray",
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

function CameraViewRenderer(container, backgroundImage) {

  BaseRenderer.call(this);

  this.width = window.innerWidth;
  this.height = window.innerHeight;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width, this.height);
  this.container = container;
  container.appendChild(this.renderer.domElement);
};

CameraViewRenderer.prototype.recenter = function () {};

/**
 * Use this lifeycle method to add event listeners
 */
CameraViewRenderer.prototype.viewDidLoad = function (solarSystem) {

  return Promise.all([
      this._loadTextures(),
    ])
    .then(([textures]) => {

      this.scene = new THREE.Scene();

      const skybox = this._createSkyBox(textures);
      this.scene.add(skybox);

      this.focus = DEFAULT_FOCUS;

      const ambientLight = new THREE.AmbientLight(0x333333);
      const pointLight = new THREE.PointLight(0xFFFFFF, 1, 100, 2);

      this.lightSource = pointLight;
      this.scene.add(ambientLight);
      this.scene.add(pointLight);

      this.bodyMap = new Map();

      // initialize camera and scene
      this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1e-10, 2);
      this.camera.position.z = 0.0005;

      solarSystem.planets.forEach(planet => {
        let material;
        if (textures.has(planet.name)) {
          material = new THREE.MeshStandardMaterial({
            map: textures.get(planet.name),
          });
        } else {
          material = new THREE.MeshBasicMaterial({
            color: PLANET_COLOURS[planet.name]
          });
        }

        const threeBody = new THREE.Mesh(
          new THREE.SphereGeometry(planet.constants.radius, 32, 32),
          material);

        this.scene.add(threeBody);
        this.bodyMap.set(planet.name, threeBody);

      });

      return Promise.resolve();
    });
};

/**
 * Indicates that this view will be added to the UI.
 */
CameraViewRenderer.prototype.viewWillAppear = function () {
  this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
  this.orbitControls.maxDistance = 50;
};

/**
 * Indicates that this view will be removed from the UI.
 */
CameraViewRenderer.prototype.viewWillDisappear = function () {
  this.orbitControls.dispose();
  this.orbitControls = null;
};

/**
 * Render the given solar system
 */
CameraViewRenderer.prototype.render = function (solarSystem) {

  // Find the body we are focusing on
  const focus = solarSystem.planets.find((planet) => planet.name === this.focus);

  // Update light source
  const sun = solarSystem.planets.find((planet) => planet.name === 'sun');
  this.lightSource.position.copy(this._adjustCoordinates(focus, sun.derived.position));

  // Update the positions of all of our bodies
  solarSystem.planets.forEach((planet) => {

    let threeBody = this.bodyMap.get(planet.name);
    let derived = planet.derived;

    // Adjust position to re-center the coordinate system on the focus
    let position = this._adjustCoordinates(focus, derived.position);
    threeBody.position.set(position.x, position.y, position.z);
  });

  let radial = new THREE.Vector3()
    .subVectors(focus.derived.position, focus.primary.derived.position);
  radial.multiplyScalar(1 + 10 * focus.constants.radius / radial.length());
  radial.add(focus.primary.derived.position);

  radial = this._adjustCoordinates(focus, radial);

  let spherical = new THREE.Spherical()
    .setFromVector3(radial);
  spherical.phi += Math.PI / 16;
  spherical.makeSafe();
  radial = new THREE.Vector3()
    .setFromSpherical(spherical);

  //this.camera.position.set(radial.x, radial.y, radial.z);
  //this.camera.lookAt(this._adjustCoordinates(focus, focus.primary.derived.position));
  //this.camera.lookAt(focus.derived.position);
  this.renderer.render(this.scene, this.camera);
};

/**
 * Recenter the coordinate system on the focus being the 'center'.
 */
CameraViewRenderer.prototype._adjustCoordinates = function (focus, position) {

  if (!focus)
    return position.clone();

  let coordinates = position.clone()
    .sub(focus.derived.position);

  return coordinates;
};

// Inherit from BaseRenderer
Object.assign(CameraViewRenderer.prototype, BaseRenderer.prototype);

export default CameraViewRenderer;
