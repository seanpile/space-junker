import BaseRenderer from './BaseRenderer';
import OrbitControls from './lib/OrbitControls';
import * as THREE from 'three';

function CameraViewRenderer(container, textureLoader, commonState) {

  BaseRenderer.call(this, textureLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.container = container;
  container.appendChild(this.renderer.domElement);

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
      const focus = solarSystem.find(this.state.focus);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('black');

      const skybox = this._createSkyBox(textures);
      this.scene.add(skybox);

      const lightSources = this._setupLightSources(textures);
      this.lightSources = lightSources;

      let width = window.innerWidth;
      let height = window.innerHeight;

      // initialize camera and scene
      this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);
      this.camera.up = new THREE.Vector3(0, 0, 1); // make 'z' be the UP direction

      const recenter = () => {
        let focus = solarSystem.find(this.state.focus);
        this.camera.position.set(0, -5 * focus.constants.radius, 0);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      };

      this.addEventListener('focus', (event) => {
        this.orbitControls.minDistance = solarSystem.find(event.focus);
        recenter();
      });

      this.addEventListener('recenter', (event) => {
        recenter();
      })

      const onWindowResize = this._onWindowResize(height, this.camera.fov);
      this.addEventListener('resize', (event) => {
        onWindowResize();
      });

      /**
       * Setup lifecycle methods for registering/deregistering event listeners
       */

      this.viewWillAppear = () => {
        const focus = solarSystem.find(this.state.focus);
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.minDistance = focus.constants.radius * 1.1;
        this.orbitControls.maxDistance = focus.constants.radius * 100;

        onWindowResize();
        recenter();
      };

      this.viewWillDisappear = () => {
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
  const focus = solarSystem.find(this.state.focus);

  // Update light sources
  const sun = solarSystem.find('sun');
  this.lightSources.forEach((light) => {
    light.position.copy(this._adjustCoordinates(focus, sun.derived.position));
  })

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
    threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), -(planet.constants.axial_tilt || 0) * Math.PI / 180);
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
