import BaseRenderer from './BaseRenderer';
import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

const DEFAULT_FOCUS = 'earth';

function CameraViewRenderer(container, textureLoader) {

  BaseRenderer.call(this, textureLoader);

  this.width = window.innerWidth;
  this.height = window.innerHeight;
  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  this.renderer.setSize(this.width, this.height);
  this.container = container;
  container.appendChild(this.renderer.domElement);

  this.focus = DEFAULT_FOCUS;
  this.bodyMap = new Map();
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
      this.scene.background = new THREE.Color('black');

      const skybox = this._createSkyBox(textures);
      this.scene.add(skybox);

      const ambientLight = new THREE.AmbientLight(0x404040);
      const pointLight = new THREE.PointLight(0xFFFFFF, 1, 100, 2);
      const lensflare = new THREE.LensFlare(textures.get('lensflare'), 100, 0.0, THREE.AdditiveBlending, new THREE.Color(0xffff00));

      this.lightSource = pointLight;
      this.lightFlare = lensflare;
      this.scene.add(ambientLight);
      this.scene.add(pointLight);
      this.scene.add(lensflare);

      // initialize camera and scene
      this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1e-10, 2);
      this.camera.up = new THREE.Vector3(0, 0, 1); // make 'z' be the UP direction

      // Setup recenter function and immediately call it
      this.recenter = () => {
        let focus = solarSystem.planets.find((planet) => planet.name === this.focus);
        this.camera.position.set(0, -5 * focus.constants.radius, 0);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      };
      this.recenter();

      // Allow user to toggle between planets
      const onTogglePlanets = (event) => {
        if (event.type === 'keypress' && [91, 93].includes(event.keyCode)) {
          let focusIdx = solarSystem.planets.findIndex((p) => p.name === this.focus);

          if (event.keyCode === 91) {
            focusIdx--;
            if (focusIdx < 0)
              focusIdx = solarSystem.planets.length - 1;
          } else {
            focusIdx = (focusIdx + 1) % solarSystem.planets.length;
          }

          this.focus = solarSystem.planets[focusIdx].name;
          console.log(`new focus: ${this.focus}`);
          this.orbitControls.minDistance = solarSystem.planets[focusIdx].constants.radius;
          this.recenter();
        }
      };

      const tanFOV = Math.tan(((Math.PI / 180) * this.camera.fov / 2));
      const onWindowResize = (event) => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / this.height));

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      };

      /**
       * Setup lifecycle methods for registering/deregistering event listeners
       */

      this.viewWillAppear = () => {
        const focus = solarSystem.planets.find((p) => p.name === this.focus);

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.minDistance = focus.constants.radius * 1.1;
        this.orbitControls.maxDistance = focus.constants.radius * 100;
        addEventListener("keypress", onTogglePlanets);
        addEventListener("resize", onWindowResize, false);
      };

      this.viewWillDisappear = () => {
        removeEventListener("resize", onWindowResize, false);
        removeEventListener("keypress", onTogglePlanets);
        this.orbitControls.dispose();
        this.orbitControls = null;
      };

      /**
       * Create THREE objects for each of our bodies and add to the scene
       */
      solarSystem.planets.forEach(planet => {

        if (planet.name === 'sun') {
          return;
        }

        const threeBody = new THREE.Mesh(
          new THREE.SphereGeometry(planet.constants.radius, 32, 32),
          new THREE.MeshStandardMaterial({
            map: textures.get(planet.name),
          }));

        this.scene.add(threeBody);
        this.bodyMap.set(planet.name, threeBody);
      });

      return Promise.resolve();
    });
};

/**
 * Render the given solar system
 */
CameraViewRenderer.prototype.render = function (solarSystem) {

  // Find the body we are focusing on
  const focus = solarSystem.planets.find((planet) => planet.name === this.focus);

  // Update light sources
  const sun = solarSystem.planets.find((planet) => planet.name === 'sun');
  this.lightSource.position.copy(this._adjustCoordinates(focus, sun.derived.position));
  this.lightFlare.position.copy(this._adjustCoordinates(focus, sun.derived.position));

  // Update the positions of all of our bodies
  solarSystem.planets.forEach((planet) => {

    if (planet.name === 'sun') {
      return;
    }

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
