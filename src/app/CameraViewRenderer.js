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

function CameraViewRenderer(container, backgroundImage) {

  BaseRenderer.call(this);

  this.width = window.innerWidth;
  this.height = window.innerHeight;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width, this.height);
  this.container = container;
  container.appendChild(this.renderer.domElement);

  this.focus = DEFAULT_FOCUS;
};

/**
 * Use this lifeycle method to add event listeners
 */
CameraViewRenderer.prototype.viewDidLoad = function (solarSystem) {

  return Promise.all([
      this._loadTextures(),
    ])
    .then(([textures]) => {

      // Find the body we are focusing on
      const focus = solarSystem.planets.find((planet) => planet.name === this.focus);

      this.scene = new THREE.Scene();

      const skybox = this._createSkyBox(textures);
      this.scene.add(skybox);

      const ambientLight = new THREE.AmbientLight(0x333333);
      const pointLight = new THREE.PointLight(0xFFFFFF, 1, 100, 2);

      this.lightSource = pointLight;
      this.scene.add(ambientLight);
      this.scene.add(pointLight);

      this.bodyMap = new Map();

      // initialize camera and scene
      this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1e-10, 2);
      this.camera.up = new THREE.Vector3(0, 0, 1); // make 'z' be the UP direction

      // Setup recenter function and immediately call it
      this.recenter = () => {
        this.camera.position.set(0, -5 * focus.constants.radius, 0);
      };
      this.recenter();

      this._togglePlanets = (event) => {
        if (event.type === 'keypress' && [91, 93].includes(event.keyCode)) {
          let focusIdx = solarSystem.planets.findIndex((p) => p.name === this.focus);

          if (event.keyCode === 91) {
            focusIdx--;
            if (focusIdx < 0)
              focusIdx = solarSystem.planets.length - 1;
          } else {
            focusIdx = (focusIdx + 1) % solarSystem.planets.length;
          }

          console.log(focusIdx);
          this.focus = solarSystem.planets[focusIdx].name;
        }
      };

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
  addEventListener("keypress", this._togglePlanets);
};

/**
 * Indicates that this view will be removed from the UI.
 */
CameraViewRenderer.prototype.viewWillDisappear = function () {
  addEventListener("keypress", this._togglePlanets);
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

    // Adjust orbital tilt and rotation.  First, rotate the body using the same
    // set of transforms we use to transform to ecliptic.  Then, apply the axial tilt,
    // and the accumulated rotation around the axis ('derived.rotation');
    threeBody.rotation.set(0, 0, 0);
    threeBody.rotateZ(derived.omega);
    threeBody.rotateX(derived.I);
    threeBody.rotateZ(derived.argumentPerihelion);
    threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), -planet.constants.axial_tilt * Math.PI / 180);
    threeBody.rotateY(derived.rotation);
  });

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
