import * as THREE from 'three';

import BaseRenderer from './BaseRenderer';
import { AU, SHIP_TYPE, PLANET_TYPE } from '../Constants';

const OrbitControls = require('three-orbit-controls')(THREE);

const SHOW_HELPERS = false;

function CameraViewRenderer(solarSystem, resourceLoader, commonState) {
  BaseRenderer.call(this, solarSystem, resourceLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  this.renderer.autoClear = false;

  this.bodyCache = new Map();
  this.showHelpers = SHOW_HELPERS;
}

// Inherit from BaseRenderer
Object.assign(CameraViewRenderer.prototype, BaseRenderer.prototype);

/**
 * Use this lifeycle method to add event listeners
 */

CameraViewRenderer.prototype.viewDidLoad = function () {

  const solarSystem = this.solarSystem;

  return new Promise((resolve) => {
    Promise.all([
      this._loadTextures(),
      this._loadModels(),
    ])
      .then(([textures, models]) => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // initialize camera and scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('black');
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);
        this.camera.up = new THREE.Vector3(0, 0, 1);

        this.navball = this.loadNavball(textures);

        // Background stars
        const skybox = this._createSkyBox();
        this.scene.add(skybox);

        // Setup light
        this.lightSources = this._setupLightSources(textures);

        /**
         * Callback to recenter the camera
         */
        const onRecenter = this._onCenter(solarSystem);

        /**
         * Callback for when we change the body focus
         */
        const onFocus = this._onFocus(onRecenter);

        /**
         * Callback for when the window resizes
         */
        const onWindowResize = this._onWindowResize([this.camera, this.navball.camera],
          height, this.camera.fov);

        /**
         * Register to listen for events
         */
        this.addEventListener('focus', (event) => {
          const focus = solarSystem.find(event.focus);
          onFocus(focus);
        });

        this.addEventListener('recenter', () => {
          onRecenter();
        });

        this.addEventListener('resize', () => {
          onWindowResize();
        });

        const keyBindings = this.createKeyBindings();

        /**
         * Setup lifecycle methods for registering/deregistering event listeners
         */
        this.viewWillAppear = () => {
          const focus = solarSystem.find(this.state.focus);
          onFocus(focus);
          onWindowResize();

          keyBindings.bind();
        };

        this.viewWillDisappear = () => {
          keyBindings.unbind();

          this.orbitControls.dispose();
          this.orbitControls = null;
        };

        solarSystem.bodies.forEach((body) => {
          this.loadThreeBody(body, textures, models);
        });

        resolve();
      });
  });
};

/**
 * Render the given solar system
 */
CameraViewRenderer.prototype.render = function render() {

  const solarSystem = this.solarSystem;

  // Find the body we are focusing on
  const focus = solarSystem.find(this.state.focus);
  const sun = solarSystem.find('sun');

  // Track the light source
  this._adjustLightSource(focus, sun);

  // Find all of the bodies that are we are concerned about in our render loop
  const [neighbours, outliers] = this._lookupNearbyBodies(focus, solarSystem.bodies, 0.05);

  // Make objects outside of our current sphere invisible (to save resources)
  outliers.forEach((body) => {
    const cached = this.bodyCache.get(body.name);
    if (cached) {
      cached.visible = false;
    }
  });

  // Update the positions of all of our bodies
  neighbours.forEach((body) => {
    const threeBody = this.bodyCache.get(body.name);
    const derived = body.derived;

    threeBody.visible = body.name !== 'sun';

    // Adjust position to re-center the coordinate system on the focus
    const position = this._adjustCoordinates(focus, derived.position);
    threeBody.position.set(position.x, position.y, position.z);

    // Adjust orbital tilt and rotation.  First, rotate the body using the same
    // set of transforms we use to transform to ecliptic.  Then, apply the axial tilt,
    // and the accumulated rotation around the axis ('derived.rotation');

    if (body.type === SHIP_TYPE) {
      threeBody.setRotationFromQuaternion(body.motion.rotation);
    } else if (body.type === PLANET_TYPE) {
      this._applyPlanetaryRotation(threeBody, body);
    }
  });

  this.renderer.clear();
  this.renderer.render(this.scene, this.camera);

  if (focus.type === SHIP_TYPE) {
    this.setNavballOrientation(focus, this.navball);

    this.renderer.clearDepth();
    this.renderer.render(this.navball.scene, this.navball.camera);
  }

  return this.renderer.domElement;
};

CameraViewRenderer.prototype._onCenter = function (solarSystem) {
  /**
   * Callback to recenter the camera
   */
  const recenter = () => {
    const focus = solarSystem.find(this.state.focus);

    if (focus.name === 'sun') {
      this.camera.up = new THREE.Vector3(0, 0, 1);
      this.camera.position.set(0, -5 * focus.constants.radius, 0);
      this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      return;
    }

    // Set camera behind in the opposite direction of the velocity vector
    const cameraPosition = focus.derived.velocity.clone()
      .normalize()
      .negate()
      .multiplyScalar(5 * focus.constants.radius);

    this.camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
  };

  return recenter;
};

CameraViewRenderer.prototype._onFocus = function (recenter) {
  const onFocus = (focus) => {
    // First dispose of existing orbit controls if they exist.
    this.orbitControls && this.orbitControls.dispose();

    recenter();

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.minDistance = focus.constants.radius * 1.5;
    this.orbitControls.maxDistance = focus.constants.radius * 100;
  };

  return onFocus;
};

CameraViewRenderer.prototype.loadThreeBody = function (body, textures, models) {
  let threeBody;
  if (body.type === SHIP_TYPE) {
    threeBody = this._loadModelBody(body, models);
  } else {
    threeBody = this._loadPlanet(body, textures);
  }

  this.scene.add(threeBody);
  this.bodyCache.set(body.name, threeBody);

  return threeBody;
};

CameraViewRenderer.prototype._loadModelBody = (function () {
  const childrenOf = (threeObj) => {
    if (!threeObj.children || threeObj.children.length === 0) {
      return [];
    }

    const descendants = [];
    threeObj.children.forEach((obj) => {
      descendants.push(obj);
      descendants.push(...childrenOf(obj));
    });

    return descendants;
  };

  return function (body, models) {
    const modelObj = models.get(body.name);
    const scale = 1 / AU;
    const threeObj = modelObj.scene;

    threeObj.scale.set(scale, scale, scale);
    threeObj.receiveShadow = true;
    threeObj.castShadow = true;
    childrenOf(threeObj)
      .forEach((obj) => {
        obj.receiveShadow = true;
        obj.castShadow = true;
      });

    if (this.showHelpers) {
      const box = new THREE.BoxHelper(threeObj, 0xffff00);
      this.scene.add(box);
    }

    return threeObj;
  };
}());

CameraViewRenderer.prototype._setupLightSources = function (textures) {
  const ambientLight = new THREE.AmbientLight(0x202020);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  const lensFlare = new THREE.LensFlare(textures.get('lensflare'), 150, 0.0, THREE.AdditiveBlending, new THREE.Color(0xffffff));

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.up = new THREE.Vector3(0, 0, 1);
  directionalLight.name = 'primary-light';
  lensFlare.name = 'lensflare';

  this.scene.add(ambientLight);
  this.scene.add(directionalLight);
  this.scene.add(lensFlare);

  return [directionalLight, lensFlare];
};

CameraViewRenderer.prototype._adjustLightSource = function (focus, sun) {
  this.lightSources.forEach((light) => {
    const lightPosition = this._adjustCoordinates(focus, sun.derived.position);
    light.position.set(lightPosition.x, lightPosition.y, lightPosition.z);

    // Frame the shadow box appropriately
    if (light.name === 'primary-light' && focus.primary && focus.primary.name !== 'sun') {
      const lightBoxLength = focus.primary.constants.radius;
      light.shadow.camera.near = 0.99 * focus.primary.derived.position.length();
      light.shadow.camera.far = 1.01 * focus.primary.derived.position.length();
      light.shadow.camera.left = -lightBoxLength;
      light.shadow.camera.right = lightBoxLength;
      light.shadow.camera.top = lightBoxLength;
      light.shadow.camera.bottom = -lightBoxLength;

      if (this.showHelpers) {
        this.lightShadowHelper && this.scene.remove(this.lightShadowHelper);
        this.lightShadowHelper = new THREE.CameraHelper(light.shadow.camera);
        this.scene.add(this.lightShadowHelper);
      }
    }

    if (light.name === 'lensflare') {
      // Bug Fix: LensFlare is showing both in front of the scene and behind;
      // Hide the lensflare if we are not pointing the camera toward the sun
      const cameraOrientation = this.camera.position.clone()
        .negate();
      light.visible = cameraOrientation.angleTo(lightPosition) <= Math.PI / 2;
    }
  });
};

export default CameraViewRenderer;
