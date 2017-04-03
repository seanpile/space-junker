import * as THREE from 'three';
import BaseRenderer from './BaseRenderer';
import {
  AU,
  ELLIPTICAL_TRAJECTORY,
  HYPERBOLIC_TRAJECTORY,
  PARABOLIC_TRAJECTORY,
} from '../Constants';
import HyperbolaCurve from './curves/HyperbolaCurve';
import ParabolaCurve from './curves/ParabolaCurve';

const OrbitControls = require('three-orbit-controls')(THREE);

const PLANET_COLOURS = {
  sun: 'yellow',
  mercury: 'silver',
  venus: 'green',
  earth: 'skyblue',
  moon: 'gray',
  mars: 'red',
  jupiter: 'orange',
  saturn: 'tan',
  uranus: 'skyblue',
  neptune: 'lightblue',
  pluto: 'silver',
};

function OrbitalMapRenderer(solarSystem, resourceLoader, sharedState) {
  BaseRenderer.call(this, solarSystem, resourceLoader, sharedState);
}

Object.assign(OrbitalMapRenderer.prototype, BaseRenderer.prototype);

OrbitalMapRenderer.prototype.viewDidLoad = function () {

  const solarSystem = this.solarSystem;

  return new Promise((resolve, reject) => {
    Promise.all([
      this._loadTextures(),
      this._loadModels(),
      this._loadFonts(),
    ])
        .then(([textures, models, fonts]) => {

          this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
          });
          this.renderer.setPixelRatio(window.devicePixelRatio);
          this.renderer.autoClear = false;
          this.dom = this.renderer.domElement;

          this.bodyMap = new Map();

          this.mouseOverTimeout = null;
          this.mouseOverCallback = null;

          const width = window.innerWidth;
          const height = window.innerHeight;

          this.scene = new THREE.Scene();
          this.scene.background = new THREE.Color('black');

          this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
          this.camera.up = new THREE.Vector3(0, 0, 1);

          const skyBox = this._createSkyBox();
          this.scene.add(skyBox);

          // Setup light
          this.lightSources = this._setupLightSources(textures);

          // Setup navball
          this.navball = this.loadNavball(textures);

          const recenter = this._onRecenter(solarSystem);
          const onWindowResize = this._onWindowResize([this.camera, this.navball.camera],
                                                      height,
                                                      this.camera.fov);

          /**
           * Register to receive events from the simulation
           */
          this.addEventListener('tap', (event) => {
            this._adjustManeuver(event.location);
          });

          this.addEventListener('doubletap', (event) => {
            this._switchFocus(event.location, solarSystem);
          });

          this.addEventListener('mouseover', (event) => {
            this._onMouseover(event.location);
          });

          this.addEventListener('focus', () => {
            recenter();
          });

          this.addEventListener('recenter', () => {
            recenter();
          });

          this.addEventListener('resize', () => {
            onWindowResize();
          });

          const keyBindings = this.createKeyBindings();

          this.viewWillAppear = function () {
            onWindowResize();

            const focus = solarSystem.find(this.sharedState.focus);
            this.orbitControls && this.orbitControls.dispose();
            this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.minDistance = Math.max(1e-5, focus.constants.radius * 2);
            this.orbitControls.maxDistance = 100;
            this.orbitControls.dollySpeed = 4.0;

            keyBindings.bind();
          };

          this.viewWillDisappear = function () {
            keyBindings.unbind();
            this.orbitControls && this.orbitControls.dispose();
            this.orbitControls = null;
          };

          // Maintain a mapping from planet -> THREE object representing the planet
          // This will allow us to update the existing THREE object on each iteration
          // of the render loop.
          solarSystem.bodies.forEach((body) => {
            this.bodyMap.set(body.name, {});

            let threeBody;
            if (body.isPlanet()) {
              threeBody = this._loadPlanet(body, textures);
            } else {
              threeBody = new THREE.Mesh(
                new THREE.SphereBufferGeometry(body.constants.radius, 32, 32),
                new THREE.MeshBasicMaterial({ color: 'gray' }));
            }
            threeBody.name = body.name;

            this.scene.add(threeBody);

            const bodyMap = this.bodyMap.get(body.name);
            bodyMap.body = threeBody;

            if (body.name !== 'sun') {
              const trajectory = this.createTrajectory(body);
              const { periapsis, apoapsis } = this._createApses(fonts);

              this.scene.add(trajectory, periapsis, apoapsis);
              bodyMap.trajectory = trajectory;
              bodyMap.periapsis = periapsis;
              bodyMap.apoapsis = apoapsis;
            }
          });

          recenter();
          resolve();
        })
        .catch((error) => {
          console.error(error);
          reject(error);
        });
  });
};

OrbitalMapRenderer.prototype.viewWillUnload = function () {
  const threeObjects = [...this.bodyMap.values()]
    .map(v => Object.keys(v).map(key => v[key]))
    .reduce((acc, val) => acc.concat(val), []);

  this.scene.remove(...threeObjects);
  this.bodyMap.clear();

  this.renderer.forceContextLoss();
  this.renderer.context = null;
  this.renderer.domElement = null;
  this.renderer = null;
};

OrbitalMapRenderer.prototype.render = function () {

  const solarSystem = this.solarSystem;

  // Find the current user focus
  const focus = solarSystem.find(this.sharedState.focus);

  // Locate primary body, sun
  const sun = solarSystem.find('sun');
  this._adjustLightSource(focus, sun);

  const [visible, hidden] = this._lookupNearbyBodies(
    focus,
    solarSystem.bodies,
    (this.camera.position.length() ** 2));

  hidden.forEach((body) => {
    const bodyMap = this.bodyMap.get(body.name);
    let key;
    for (key of Object.keys(bodyMap)) {
      bodyMap[key].visible = false;
    }
  });

  visible.forEach((body) => {
    const bodyMap = this.bodyMap.get(body.name);
    let key;
    for (key of Object.keys(bodyMap)) {
      const threeObj = bodyMap[key];
      if (body.name === 'sun') {
        threeObj.visible = false;
      } else {
        threeObj.visible = true;
      }
    }

    const threeBody = bodyMap.body;

    // Adjust position to re-center the coordinate system on the focus
    const position = this._adjustCoordinates(focus, body.position);

    threeBody.position.set(position.x, position.y, position.z);

    if (body.isPlanet()) {
      this._applyPlanetaryRotation(threeBody, body);
    }

    if (body.name !== 'sun') {
      this._scaleBody(body);
      this._updateTrajectory(focus, body);
      this._updateApses(focus, body);
    }
  });

  this._updateCamera(focus);
  this.renderer.render(this.scene, this.camera);

  if (focus.isShip()) {
    this.setNavballOrientation(focus, this.navball);

    this.renderer.clearDepth();
    this.renderer.render(this.navball.scene, this.navball.camera);
  }

  return this.renderer.domElement;
};

OrbitalMapRenderer.prototype._setupLightSources = function (textures) {
  const ambientLight = new THREE.AmbientLight(0x606060);
  const pointLight = new THREE.PointLight(0xffffff, 1);
  const lensFlare = new THREE.LensFlare(textures.get('lensflare'), 150, 0.0, THREE.AdditiveBlending, new THREE.Color(0xffffff));

  pointLight.castShadow = true;

  this.scene.add(ambientLight);
  this.scene.add(pointLight);
  this.scene.add(lensFlare);

  return [pointLight, lensFlare];
};

OrbitalMapRenderer.prototype._adjustLightSource = function (focus, sun) {
  this.lightSources.forEach((light) => {
    const lightPosition = this._adjustCoordinates(focus, sun.position);
    light.position.set(lightPosition.x, lightPosition.y, lightPosition.z);
  });
};

/**
 * As the camera zooms in / out, we may need to adjust the camera parameters
 * to ensure things like Raycasting continue to work as expected.
 */
OrbitalMapRenderer.prototype._updateCamera = function () {
  const tol = 1e-8;
  const length = this.camera.position.length();

  // Only do this computation if there has been a change
  if (!this.lastCameraLength || (Math.abs(length - this.lastCameraLength) > tol)) {
    this.camera.near = this.camera.position.length() * 0.01;
    this.camera.updateProjectionMatrix();
  }

  this.lastCameraLength = length;
};

OrbitalMapRenderer.prototype._scaleBody = function (body) {
  const bodyMap = this.bodyMap.get(body.name);
  const threeBody = bodyMap.body;
  const cameraDistance = this.camera.position.distanceTo(threeBody.position);

  const scale = Math.max(0.005 * cameraDistance, body.constants.radius) / body.constants.radius;
  if (body.name === 'apollo 11') {
    console.log(scale);
  }

  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, body) {
  // Redraw the trajectory for this body
  const bodyMap = this.bodyMap.get(body.name);
  const threeBody = bodyMap.body;
  const orbit = body.orbit;

  // Check to see if the trajectory type has changed in the model;
  // If so, we need to reinstantiate a new trajectory
  let trajectory = bodyMap.trajectory;
  const refreshTrajectory =
    (orbit.e <= 1 && trajectory.name !== ELLIPTICAL_TRAJECTORY) ||
    (orbit.e > 1 && trajectory.name !== HYPERBOLIC_TRAJECTORY) ||
    (orbit.e === 1 && trajectory.name !== PARABOLIC_TRAJECTORY);

  if (refreshTrajectory) {
    this.scene.remove(trajectory);
    trajectory = this.createTrajectory(body);
    this.scene.add(trajectory);
    bodyMap.trajectory = trajectory;
  }

  const showTrajectoryTheshold = 0.05;
  let visible = true;
  if (body.name === 'sun') {
    // Don't show the sun's (empty) trajectory
    visible = false;
  } else if (this.camera.position.distanceTo(threeBody.position) < showTrajectoryTheshold) {
    // Don't show the trajectory of our primary body if we are zoomed in, this reduces
    // visual clutter
    if (focus.isPlanet() && body.name === focus.name && focus.primary.name === 'sun') {
      visible = false;
    } else if (focus.primary && focus.primary.name === body.name) {
      visible = false;
    }
  }

  if (!visible) {
    trajectory.visible = false;
    return;
  }

  trajectory.visible = true;

  const stats = body.orbit.stats;
  const semiMajorAxis = stats.semiMajorAxis;
  const semiMinorAxis = stats.semiMinorAxis;
  const center = this._adjustCoordinates(focus, stats.center);

  // Finally, apply scale/rotation/translation to the trajectory to place it
  // into the correct orbit
  trajectory.scale.set(1, 1, 1);
  trajectory.rotation.set(0, 0, 0);
  trajectory.position.set(0, 0, 0);

  // Now adjust the trajectory to its actual orientation
  trajectory.translateX(center.x);
  trajectory.translateY(center.y);
  trajectory.translateZ(center.z);
  trajectory.rotateZ(orbit.omega);
  trajectory.rotateX(orbit.I);
  trajectory.rotateZ(orbit.argumentPerihelion);

  if (trajectory.name === PARABOLIC_TRAJECTORY) {
    trajectory.scale.set(orbit.p, orbit.p, 1);
  } else {
    trajectory.scale.set(semiMajorAxis, semiMinorAxis, 1);
  }
};

OrbitalMapRenderer.prototype.createTrajectory = function (body) {

  const e = body.orbit.e;
  let curve;
  let name;
  if (e >= 0 && e < 1) {
    // Ellipse
    curve = new THREE.EllipseCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false, // aClockwise
        0, // aRotation
      );
    name = ELLIPTICAL_TRAJECTORY;

  } else if (e === 1) {
    // Unit parabola with focus centered on (0, 0), p = 1, q = 1 / 2
    curve = new ParabolaCurve(1 / 2, 0, 1, -10, 10);
    name = PARABOLIC_TRAJECTORY;

  } else if (e >= 1) {
    // Hyperbola
    curve = new HyperbolaCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        -Math.PI, Math.PI,
      );
    name = HYPERBOLIC_TRAJECTORY;
  }

  const NUM_POINTS = 128;

  // Create the trajectory using a strandard ellipse curve that will
  // eventually scale/rotate/translate into the correct orbit path during
  // the render loop.
  const pointsGeometry =
    new THREE.Path(curve.getPoints(NUM_POINTS)).createPointsGeometry(NUM_POINTS);
  const bufferGeometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < pointsGeometry.vertices.length; i += 1) {
    vertices.push(
      pointsGeometry.vertices[i].x,
      pointsGeometry.vertices[i].y,
      pointsGeometry.vertices[i].z,
    );
  }

  bufferGeometry.addAttribute('position',
                              new THREE.BufferAttribute(new Float32Array(vertices), 3));

  const trajectory = new THREE.Line(
    bufferGeometry,
    new THREE.LineBasicMaterial({ color: PLANET_COLOURS[body.name] || 'white' }));

  trajectory.name = name;
  return trajectory;
};

OrbitalMapRenderer.prototype._onMouseover = (function () {
  const raycaster = new THREE.Raycaster();

  return function onMouseOver(location) {

    // If we've already fired off an event, cancel it and start a new one
    if (this.mouseOverTimeout !== null) {
      clearInterval(this.mouseOverTimeout);
    }

    this.mouseOverTimeout = setTimeout(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;

        // Convert to normalized device coordinates
      const target = new THREE.Vector2(
          ((location.x / width) * 2) - 1,
          -((location.y / height) * 2) + 1);

      raycaster.setFromCamera(target, this.camera);

      const bodiesToTest = Array.from(this.bodyMap.entries())
          .map(entry => entry[1].body)
          .filter(body => body.visible);

      const intersection = raycaster.intersectObjects(bodiesToTest);
      if (intersection.length > 0) {
        this.mouseOverCallback({
          name: intersection[0].object.name,
          left: location.x,
          bottom: (height - location.y),
        });
      } else {
        this.mouseOverCallback(null);
      }

    }, 300);
  };
}());

OrbitalMapRenderer.prototype._adjustManeuver = (function () {
  const raycaster = new THREE.Raycaster();

  return function adjustManeuver(location) {

    const focus = this.solarSystem.find(this.sharedState.focus);
    if (!focus.isShip()) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Convert to normalized device coordinates
    const target = new THREE.Vector2(
      ((location.x / width) * 2) - 1,
      -((location.y / height) * 2) + 1);

    raycaster.setFromCamera(target, this.camera);
    const trajectory = this.bodyMap.get(focus.name).trajectory;
    const intersection = raycaster.intersectObject(trajectory);
    if (intersection.length > 0) {
      console.log(intersection[0]);
      // Have periapsis, center, and point on trajectory... calculate
    }
  };
}());

OrbitalMapRenderer.prototype._switchFocus = (function () {
  const raycaster = new THREE.Raycaster();

  return function (location, solarSystem) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Convert to normalized device coordinates
    const target = new THREE.Vector2(
      ((location.x / width) * 2) - 1,
      -((location.y / height) * 2) + 1);

    raycaster.setFromCamera(target, this.camera);

    const bodiesToTest = Array.from(this.bodyMap.entries())
      .map(entry => entry[1].body)
      .filter(body => body.visible);

    const intersection = raycaster.intersectObjects(bodiesToTest);
    let focusChanged = false;
    if (intersection.length > 0) {
      const hitId = intersection[0].object.name;
      focusChanged = this.sharedState.focus !== hitId;
      this.sharedState.focus = hitId;

      const newFocus = solarSystem.find(hitId);
      this.orbitControls.minDistance = Math.max(1e-5, newFocus.constants.radius * 2);
      this.orbitControls.update();
    }

    return focusChanged;
  };
}());

OrbitalMapRenderer.prototype._onRecenter = function (solarSystem) {
  const ORIGIN = new THREE.Vector3();
  const recenter = () => {
    const focus = solarSystem.find(this.sharedState.focus);

    // For all bodies (except sun), use the size of the orbiting radius for
    // the camera position.
    let cameraDistance;
    if (focus.name === 'sun') {
      cameraDistance = 5;
    } else {
      const position = focus.position;
      const primaryPosition = focus.primary.position;
      cameraDistance = primaryPosition.distanceTo(position);
    }

    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(ORIGIN);
  };

  return recenter;
};

OrbitalMapRenderer.prototype._createApses = function (fonts) {

  const periapsis = new THREE.Mesh(
    new THREE.TextGeometry('Pe', { font: fonts.helvetiker, size: 1, height: 0 }),
    new THREE.MeshBasicMaterial());

  const apoapsis = new THREE.Mesh(
    new THREE.TextGeometry('Ap', { font: fonts.helvetiker, size: 1, height: 0 }),
    new THREE.MeshBasicMaterial());

  return { periapsis, apoapsis };
};

OrbitalMapRenderer.prototype._updateApses = function (focus, body) {

  const { body: threeBody, periapsis, apoapsis } = this.bodyMap.get(body.name);

  periapsis.position.copy(this._adjustCoordinates(focus, body.orbit.stats.periapsis));
  apoapsis.position.copy(this._adjustCoordinates(focus, body.orbit.stats.apoapsis));

  const cameraDistance = this.camera.position.distanceTo(threeBody.position);
  const scale = 1e-2 * cameraDistance;
  if (body.name === 'apollo 11') {
    console.log(this.camera.quaternion);
  }

  periapsis.scale.set(scale, scale, scale);
  apoapsis.scale.set(scale, scale, scale);

  periapsis.setRotationFromQuaternion(this.camera.quaternion);
  apoapsis.setRotationFromQuaternion(this.camera.quaternion);
};

export default OrbitalMapRenderer;
