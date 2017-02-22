import BaseRenderer from './BaseRenderer';
import * as THREE from 'three';
import {
  AU
} from './Bodies';

const OrbitControls = require('three-orbit-controls')(THREE);

function CameraViewRenderer(container, textureLoader, modelLoader, commonState) {

  BaseRenderer.call(this, textureLoader, modelLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
      this._loadModels(),
    ])
    .then(([textures, models]) => {

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

      /**
       * Callback to recenter the camera
       */
      const recenter = () => {
        let focus = solarSystem.find(this.state.focus);
        let camera_position = focus.derived.velocity.clone()
          .normalize()
          .negate()
          .multiplyScalar(5 * focus.constants.radius);

        let primary_position = new THREE.Vector3()
          .sub(this._adjustCoordinates(focus, focus.primary.derived.position));

        this.camera.up = new THREE.Vector3()
          .copy(focus.derived.velocity)
          .applyAxisAngle(primary_position.normalize(), Math.PI / 2)
          .normalize();

        this.camera.position.set(camera_position.x, camera_position.y, camera_position.z);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

      };

      /**
       * Callback for when we change the body focus
       */
      const onFocus = (focus) => {
        this.orbitControls && this.orbitControls.dispose();

        recenter();

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.minDistance = focus.constants.radius * 1.5;
        this.orbitControls.maxDistance = focus.constants.radius * 100;
      };

      this.addEventListener('focus', (event) => {
        let focus = solarSystem.find(event.focus);
        onFocus(focus);
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
        onFocus(focus);
        onWindowResize();
      };

      this.viewWillDisappear = () => {
        this.orbitControls.dispose();
        this.orbitControls = null;
      };

      /**
       * Create THREE objects for each of our bodies and add to the scene
       */
      solarSystem.bodies.forEach(body => {

        if (body.name === 'sun') {
          return;
        }

        const material = new THREE.MeshPhongMaterial();
        const threeBody = new THREE.Mesh(
          new THREE.SphereGeometry(body.constants.radius, 128, 128),
          material);

        if (body.name === 'earth') {
          material.bumpMap = textures.get(body.name + 'bump');
          material.bumpScale = 100000 / AU;

          material.specularMap = textures.get(body.name + 'spec');
          material.specular = new THREE.Color('grey');
        }

        // Reduce harsh glare effect of the light source (default 30 -> 1);
        material.map = textures.get(body.name) || textures.get('moon');
        material.shininess = 1;

        threeBody.receiveShadow = true;
        threeBody.castShadow = true;

        this.scene.add(threeBody);
        this.bodyMap.set(body.name, threeBody);
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
    const lightPosition = this._adjustCoordinates(focus, sun.derived.position);
    light.position.set(lightPosition.x, lightPosition.y, lightPosition.z);

    if (light.shadow && focus.primary && focus.primary.name !== 'sun') {
      let lightBoxLength = focus.primary.constants.radius;
      light.shadow.camera.near = 0.99 * focus.primary.derived.position.length();
      light.shadow.camera.far = 1.01 * focus.primary.derived.position.length();
      light.shadow.camera.left = -lightBoxLength;
      light.shadow.camera.right = lightBoxLength;
      light.shadow.camera.top = lightBoxLength;
      light.shadow.camera.bottom = -lightBoxLength;
    }

  });

  // Update the positions of all of our bodies
  solarSystem.bodies.forEach((body) => {

    if (body.name === 'sun') {
      return;
    }

    let threeBody = this.bodyMap.get(body.name);
    let derived = body.derived;

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
    threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), -(body.constants.axial_tilt || 0) * Math.PI / 180);
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
