import BaseRenderer from './BaseRenderer';
import * as THREE from 'three';
import {
  AU,
  SHIP_TYPE,
  PLANET_TYPE
} from './Bodies';

const OrbitControls = require('three-orbit-controls')(THREE);
const SHOW_HELPERS = false;

// rad / second
const MOTION_STEP = Math.PI / 8;

function CameraViewRenderer(container, resourceLoader, commonState) {

  BaseRenderer.call(this, resourceLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
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
        this.camera.up = new THREE.Vector3(0, 0, 1);

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
  const [neighbours, outliers] = this._lookupNearbyBodies(focus, solarSystem.bodies, 0.05);

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

    if (body.type === SHIP_TYPE) {
      threeBody.setRotationFromQuaternion(body.motion.rotation);
    } else if (body.type === PLANET_TYPE) {
      this._applyPlanetaryRotation(threeBody, body);
    }
  });

  this.renderer.clear();
  this.renderer.render(this.scene, this.camera);

  if (focus.type === SHIP_TYPE) {
    this.setNavballOrientation(focus);

    this.renderer.clearDepth();
    this.renderer.render(this.navballScene, this.navballCamera, this.renderer.getCurrentRenderTarget(), false);
  }
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
    // this.camera.up = new THREE.Vector3()
    //   .copy(focus.derived.velocity)
    //   .applyAxisAngle(primary_position.normalize(), Math.PI / 2)
    //   .normalize();

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
    const body = solarSystem.find(this.state.focus);
    const motion = body.motion;

    switch (event.keyCode) {
    case 116:
      // t
      motion.sas = !motion.sas;
      break;
    case 113:
      // q
      motion.roll += -MOTION_STEP;
      break;
    case 101:
      // e
      motion.roll += MOTION_STEP;
      break;
    case 119:
      // w
      motion.pitch += MOTION_STEP;
      break;
    case 115:
      // s
      motion.pitch += -MOTION_STEP;
      break;
    case 97:
      // a
      motion.yaw += MOTION_STEP;
      break;
    case 100:
      // d
      motion.yaw += -MOTION_STEP;
      break;
    default:
    }
  });
};

CameraViewRenderer.prototype.setNavballOrientation = function () {

  const orientation = new THREE.Vector3();
  const primaryOrientation = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const ORIGIN = new THREE.Vector3();
  const up = new THREE.Vector3();
  const up0 = new THREE.Vector3(0, 0, 1);

  return function (focus) {

    let derived = focus.derived;
    let primary = focus.primary;
    let motion = focus.motion;
    let velocity = derived.velocity.clone();
    let primaryBody = this.bodyCache.get(primary.name);

    orientation.copy(motion.heading0);
    orientation.applyQuaternion(motion.rotation);
    orientation.normalize();

    up.copy(up0);
    up.applyQuaternion(motion.rotation);
    up.normalize();

    primaryOrientation.copy(primaryBody.position);
    primaryOrientation.normalize();

    /**
     * Helpers to visualize velocity, orientation, position
     */
    if (SHOW_HELPERS) {
      this.velocityHelper && this.scene.remove(this.velocityHelper);
      this.velocityHelper = new THREE.ArrowHelper(velocity.clone()
        .normalize(), ORIGIN, 1000 / AU, 'yellow');
      this.scene.add(this.velocityHelper);

      this.orientationHelper && this.scene.remove(this.orientationHelper);
      this.orientationHelper = new THREE.ArrowHelper(orientation, ORIGIN, 1000 / AU, 'blue');
      this.scene.add(this.orientationHelper);

      this.positionHelper && this.scene.remove(this.positionHelper);
      this.positionHelper = new THREE.ArrowHelper(primaryOrientation, ORIGIN, 1000 / AU, 'red');
      this.scene.add(this.positionHelper);
    }

    /**
     * Rotate the camera, reproducing the pitch/yaw/rotation on the
     * foucs.
     */
    offset.copy(orientation);
    offset.normalize()
      .negate()
      .multiplyScalar(5);

    this.navballCamera.position.copy(offset);
    this.navballLight.position.copy(offset);

    this.navballCamera.up.copy(up);
    this.navballCamera.lookAt(ORIGIN);

    // Set the border to always face the camera
    this.navballBorder.setRotationFromQuaternion(motion.rotation);
    this.navballBorder.rotateX(Math.PI / 2);

    let radial = primaryBody.position;
    let angle = radial.angleTo(motion.heading0);
    offset.crossVectors(radial, motion.heading0)
      .normalize();

    this.navball.rotation.set(0, 0, 0);
    this.navball.rotateOnAxis(offset, -angle);

    let verticalAngle = -(primary.constants.axial_tilt || 0) * Math.PI / 180;
    this.navball.rotateY(Math.PI / 2);
    this.navball.rotateY(-verticalAngle);

    /**
     * Adjust Navball Markers (Prograde, Retrograde, etc...)
     */

    let markers = [
      [this.navballPrograde, velocity.clone()
        .normalize()
        .negate()
        .multiplyScalar(0.41)
      ],
      [this.navballRetrograde, velocity.clone()
        .normalize()
        .multiplyScalar(0.41)
      ],
      [this.navballRadialIn,
        primaryOrientation.clone()
        .negate()
        .multiplyScalar(0.41)
      ],
      [this.navballRadialOut,
        primaryOrientation.clone()
        .multiplyScalar(0.41)
      ],
      [this.navballLevel,
        this.navballCamera.position.clone()
        .normalize()
        .multiplyScalar(0.45)
      ],
    ];

    markers.forEach(([marker, position]) => {
      marker.position.copy(position);
      marker.setRotationFromQuaternion(motion.rotation);
      marker.up.copy(up);
      marker.lookAt(ORIGIN);
      marker.rotateX(Math.PI);
      marker.rotateZ(Math.PI);
    });
  }

}();

CameraViewRenderer.prototype.loadThreeBody = function (body, textures, models) {
  if (body.name === 'apollo') {
    return this._loadModelBody(body, models);
  } else {
    const planet = this._loadPlanet(body, textures);
    this.scene.add(planet);
    this.bodyCache.set(body.name, planet);
    return
  }
};

CameraViewRenderer.prototype._loadModelBody = function (body, models) {

  const modelObj = models.get(body.name);
  const scale = 1 / AU;
  const threeObj = modelObj.scene;

  threeObj.scale.set(scale, scale, scale);
  this.scene.add(threeObj);

  if (SHOW_HELPERS) {
    let box = new THREE.BoxHelper(threeObj, 0xffff00);
    this.scene.add(box);
  }

  this.bodyCache.set(body.name, threeObj);
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

// Inherit from BaseRenderer
Object.assign(CameraViewRenderer.prototype, BaseRenderer.prototype);

export default CameraViewRenderer;
