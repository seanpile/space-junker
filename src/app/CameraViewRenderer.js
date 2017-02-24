import BaseRenderer from './BaseRenderer';
import * as THREE from 'three';
import {
  AU
} from './Bodies';

const OrbitControls = require('three-orbit-controls')(THREE);

function CameraViewRenderer(container, resourceLoader, commonState) {

  BaseRenderer.call(this, resourceLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  this.renderer.autoClear = false;
  this.container = container;
  container.appendChild(this.renderer.domElement);

  this.bodyCache = new Map();
};

/**
 * Use this lifeycle method to add event listeners
 */
CameraViewRenderer.prototype.viewDidLoad = function (solarSystem) {

  return new Promise((resolve, reject) => {
    Promise.all([
        this._loadTextures(),
        this._loadModels(),
      ])
      .then(([textures, models]) => {

        let width = window.innerWidth;
        let height = window.innerHeight;

        // initialize camera and scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('black');
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1e-10, 2);

        this.loadNavball(textures);

        // Background stars
        const skybox = this._createSkyBox();
        this.scene.add(skybox);

        // Setup light
        this.lightSource = this._setupLightSources();

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
        const onWindowResize = this._onWindowResize([this.camera, this.navballCamera],
          height, this.camera.fov);

        /**
         * Handle user input
         */
        const onKeyPress = this._onKeyPress(solarSystem);

        /**
         * Register to listen for events
         */
        this.addEventListener('focus', (event) => {
          let focus = solarSystem.find(event.focus);
          onFocus(focus);
        });

        this.addEventListener('recenter', (event) => {
          onRecenter();
        })

        this.addEventListener('resize', (event) => {
          onWindowResize();
        });

        this.addEventListener('keypress', (event) => {
          onKeyPress(event.key);
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
CameraViewRenderer.prototype.render = function (solarSystem) {

  // Find the body we are focusing on
  const focus = solarSystem.find(this.state.focus);
  const sun = solarSystem.find('sun');

  // Track the light source
  this._adjustLightSource(focus, sun);

  // Find all of the bodies that are we are concerned about in our render loop
  const [neighbours, outliers] = this._lookupNearbyBodies(focus, solarSystem.bodies);

  // Make objects outside of our current sphere invisible (to save resources)
  outliers.forEach((body) => {
    const cached = this.bodyCache.get(body.name);
    if (cached)
      cached.visible = false;
  });

  // Update the positions of all of our bodies
  neighbours.forEach((body) => {

    let threeBody = this.bodyCache.get(body.name);
    let derived = body.derived;

    threeBody.visible = true;

    // Adjust position to re-center the coordinate system on the focus
    let position = this._adjustCoordinates(focus, derived.position);
    threeBody.position.set(position.x, position.y, position.z);

    // Adjust orbital tilt and rotation.  First, rotate the body using the same
    // set of transforms we use to transform to ecliptic.  Then, apply the axial tilt,
    // and the accumulated rotation around the axis ('derived.rotation');

    if (body.name !== 'apollo') {
      threeBody.rotation.set(0, 0, 0);
      threeBody.rotateZ(derived.omega);
      threeBody.rotateX(derived.I);
      threeBody.rotateZ(derived.argumentPerihelion);
      threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      threeBody.rotateOnAxis(new THREE.Vector3(1, 0, 0), -(body.constants.axial_tilt || 0) * Math.PI / 180);
      threeBody.rotateY(derived.rotation);
    }
  });

  this.renderer.clear();
  this.renderer.render(this.scene, this.camera);
  this.renderer.clearDepth();
  this.renderer.render(this.navballScene, this.navballCamera, this.renderer.getCurrentRenderTarget(), false);
  this.navball.rotateY(Math.PI / 128);
};

CameraViewRenderer.prototype._onCenter = function (solarSystem) {
  /**
   * Callback to recenter the camera
   */
  const recenter = () => {
    let focus = solarSystem.find(this.state.focus);

    if (focus.name === 'sun') {
      this.camera.up = new THREE.Vector3(0, 0, 1);
      this.camera.position.set(0, -5 * focus.constants.radius, 0);
      this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      return;
    }

    // Set camera behind in the opposite direction of the velocity vector
    let camera_position = focus.derived.velocity.clone()
      .normalize()
      .negate()
      .multiplyScalar(5 * focus.constants.radius);

    let primary_position = new THREE.Vector3()
      .sub(this._adjustCoordinates(focus, focus.primary.derived.position));

    // Base the camera UP direction off of the velocity vector, rotated 90 degrees up.
    this.camera.up = new THREE.Vector3()
      .copy(focus.derived.velocity)
      .applyAxisAngle(primary_position.normalize(), Math.PI / 2)
      .normalize();

    this.camera.position.set(camera_position.x, camera_position.y, camera_position.z);
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

CameraViewRenderer.prototype._onKeyPress = function (solarSystem) {

  return ((key) => {

    // Find the body we are focusing on
    const threeObj = this.bodyCache.get(this.state.focus);

    switch (event.keyCode) {
    case 113:
      // q
      threeObj.rotateZ(Math.PI / 32);
      break;
    case 101:
      // e
      threeObj.rotateZ(-Math.PI / 32);
      break;
    case 119:
      // w
      threeObj.rotateX(Math.PI / 32);
      break;
    case 97:
      // a
      threeObj.rotateY(Math.PI / 32);
      break;
    case 115:
      // s
      threeObj.rotateX(-Math.PI / 32);
      break;
    case 100:
      // d
      threeObj.rotateY(-Math.PI / 32);
      break;
    default:
    }
  });
};

CameraViewRenderer.prototype.loadNavball = function (textures) {

  const lightSource = new THREE.DirectionalLight(0xffffff, 1);

  this.navballScene = new THREE.Scene();
  this.navballCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

  const navball = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 128, 128),
    new THREE.MeshPhongMaterial({
      map: textures.get('navball'),
      shininess: 10
    }));

  const border = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.05, 80, 60),
    new THREE.MeshPhongMaterial({
      color: 'gray'
    }));

  border.rotateY(Math.PI / 2);

  this.navball = navball;

  this.navballScene.add(navball);
  this.navballScene.add(border);
  this.navballScene.add(lightSource);

  this.navballCamera.up = new THREE.Vector3(0, 1, 0);
  this.navballCamera.position.set(5, 0, 0);
  this.navballCamera.lookAt(new THREE.Vector3(0, 0, 0));

  lightSource.position.set(5, 0, 0);

  this.navballCamera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    0, -0.40 * window.innerHeight,
    window.innerWidth,
    window.innerHeight);
};

CameraViewRenderer.prototype.loadThreeBody = function (body, textures, models) {
  if (body.name === 'apollo') {
    return this._loadModelBody(body, models);
  } else {
    return this._loadTextureBody(body, textures);
  }
};

CameraViewRenderer.prototype._loadModelBody = function (body, models) {

  const modelObj = models.get(body.name);
  const scale = 1 / AU;
  const threeObj = modelObj.scene;

  threeObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  threeObj.scale.set(scale, scale, scale);

  this.scene.add(threeObj);
  this.bodyCache.set(body.name, threeObj);
};

CameraViewRenderer.prototype._loadTextureBody = function (body, textures) {

  let material;
  if (body.name === 'sun') {
    material = new THREE.MeshBasicMaterial({
      color: 'yellow'
    });
  } else {
    material = new THREE.MeshPhongMaterial();
    if (textures.has(body.name + 'bump')) {
      material.bumpMap = textures.get(body.name + 'bump');
      material.bumpScale = 100000 / AU;
    }

    if (textures.has(body.name + 'spec')) {
      material.specularMap = textures.get(body.name + 'spec');
      material.specular = new THREE.Color('grey');
    }

    if (textures.has(body.name)) {
      // Reduce harsh glare effect of the light source (default 30 -> 1);
      material.map = textures.get(body.name);
      material.shininess = 1;
    }
  }

  const threeBody = new THREE.Mesh(
    new THREE.SphereGeometry(body.constants.radius, 128, 128),
    material);

  threeBody.receiveShadow = true;
  threeBody.castShadow = true;

  this.scene.add(threeBody);
  this.bodyCache.set(body.name, threeBody);
};

CameraViewRenderer.prototype._adjustLightSource = function (focus, sun) {

  const light = this.lightSource;
  const lightPosition = this._adjustCoordinates(focus, sun.derived.position);

  light.position.set(lightPosition.x, lightPosition.y, lightPosition.z);

  // Frame the shadow box appropriately
  if (focus.primary && focus.primary.name !== 'sun') {
    let lightBoxLength = focus.primary.constants.radius;
    light.shadow.camera.near = 0.99 * focus.primary.derived.position.length();
    light.shadow.camera.far = 1.01 * focus.primary.derived.position.length();
    light.shadow.camera.left = -lightBoxLength;
    light.shadow.camera.right = lightBoxLength;
    light.shadow.camera.top = lightBoxLength;
    light.shadow.camera.bottom = -lightBoxLength;
  }
};

CameraViewRenderer.prototype._lookupNearbyBodies = function (focus, bodies) {

  const nearbyThreshold = 0.05;
  const partitioned = bodies.map((body) => {
      const distance = new THREE.Vector3()
        .subVectors(focus.derived.position, body.derived.position);
      return [body, distance.lengthSq()];
    })
    .reduce((acc, [body, distance]) => {
      if (distance < nearbyThreshold || body.name === 'sun') {
        acc[0].push(body);
      } else {
        acc[1].push(body);
      }
      return acc;
    }, [
      [],
      []
    ]);

  const neighbours = partitioned[0];
  const outliers = partitioned[1];
  return [neighbours, outliers];
}

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
