import * as THREE from 'three';
import BaseRenderer from './BaseRenderer';
import {
  SHIP_TYPE,
  PLANET_TYPE,
} from '../Constants';

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

function OrbitalMapRenderer(solarSystem, resourceLoader, commonState) {
  BaseRenderer.call(this, solarSystem, resourceLoader, commonState);

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.autoClear = false;

  this.scene = new THREE.Scene();
  this.bodyMap = new Map();
}

Object.assign(OrbitalMapRenderer.prototype, BaseRenderer.prototype);

OrbitalMapRenderer.prototype.viewDidLoad = function () {

  const solarSystem = this.solarSystem;

  return new Promise((resolve, reject) => {
    Promise.all([
      this._loadTextures(),
      this._loadModels(),
    ])
      .then(([textures]) => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
        this.camera.up = new THREE.Vector3(0, 0, 1);

        const skyBox = this._createSkyBox();
        this.scene.add(skyBox);

        // Setup light
        this.lightSources = this._setupLightSources(textures);

        // Setup navball
        this.navball = this.loadNavball(textures);

        const recenter = this._onRecenter(solarSystem);
        const onWindowResize = this._onWindowResize(
          [this.camera, this.navball.camera],
          height,
          this.camera.fov);

        /**
         * Register to receive events from the simulation
         */
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
          recenter();
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
          if (body.type === PLANET_TYPE) {
            threeBody = this._loadPlanet(body, textures);
          } else {
            threeBody = new THREE.Mesh(
              new THREE.SphereBufferGeometry(body.constants.radius, 32, 32),
              new THREE.MeshBasicMaterial({
                color: 'gray',
              }));
          }

          const periapsis = new THREE.Mesh(new THREE.SphereBufferGeometry(0.01, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 'purple',
            }));

          const apoapsis = new THREE.Mesh(new THREE.SphereBufferGeometry(0.01, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 'aqua',
            }));

          const trajectory = new THREE.Line(
            this._createTrajectoryGeometry(),
            new THREE.LineBasicMaterial({
              color: PLANET_COLOURS[body.name] || 'white',
            }));

          this.scene.add(threeBody);
          this.scene.add(trajectory);
          // this.scene.add(periapsis);
          // this.scene.add(apoapsis);

          threeBody.name = body.name;

          Object.assign(this.bodyMap.get(body.name), {
            body: threeBody,
            trajectory,
            periapsis,
            apoapsis,
          });
        });

        resolve();
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });
};

OrbitalMapRenderer.prototype.render = function () {

  const solarSystem = this.solarSystem;

  // Find the current user focus
  const focus = solarSystem.find(this.state.focus);

  // Locate primary body, sun
  const sun = solarSystem.find('sun');
  this._adjustLightSource(focus, sun);

  const [visible, hidden] = this._lookupNearbyBodies(
    focus,
    solarSystem.bodies,
    (this.camera.position.length() ** 2));

  hidden.forEach((body) => {
    const bodyMap = this.bodyMap.get(body.name);
    Object.values(bodyMap)
      .forEach((threeObj) => {
        threeObj.visible = false;
      });
  });

  visible.forEach((body) => {
    const bodyMap = this.bodyMap.get(body.name);
    Object.values(bodyMap)
      .forEach((threeObj) => {
        if (body.name === 'sun') {
          threeObj.visible = false;
        } else {
          threeObj.visible = true;
        }
      });

    const threeBody = bodyMap.body;
    const threePeriapsis = bodyMap.periapsis;
    const threeApoapsis = bodyMap.apoapsis;
    const derived = body.derived;

    // Adjust position to re-center the coordinate system on the focus
    const position = this._adjustCoordinates(focus, derived.position);
    const apoapsis = this._adjustCoordinates(focus, derived.apoapsis);
    const periapsis = this._adjustCoordinates(focus, derived.periapsis);

    threeBody.position.set(position.x, position.y, position.z);
    threePeriapsis.position.set(periapsis.x, periapsis.y, periapsis.z);
    threeApoapsis.position.set(apoapsis.x, apoapsis.y, apoapsis.z);

    if (body.type === PLANET_TYPE) {
      this._applyPlanetaryRotation(threeBody, body);
    }

    this._scaleBody(body);
    this._updateTrajectory(focus, body);
  });

  this._updateCamera(focus);
  this.renderer.render(this.scene, this.camera);

  if (focus.type === SHIP_TYPE) {
    this.setNavballOrientation(focus, this.navball);

    this.renderer.clearDepth();
    this.renderer.render(this.navball.scene, this.navball.camera);
  }

  return this.renderer.domElement;
};

OrbitalMapRenderer.prototype._setupLightSources = function (textures) {
  const ambientLight = new THREE.AmbientLight(0x202020);
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
    const lightPosition = this._adjustCoordinates(focus, sun.derived.position);
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
  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, body) {
  // Redraw the trajectory for this body
  const bodyMap = this.bodyMap.get(body.name);
  const threeBody = bodyMap.body;
  const trajectory = bodyMap.trajectory;

  const showTrajectoryTheshold = 0.05;
  let visible = true;
  if (body.name === 'sun') {
    // Don't show the sun's (empty) trajectory
    visible = false;
  } else if (this.camera.position.distanceTo(threeBody.position) < showTrajectoryTheshold) {
    // Don't show the trajectory of our primary body if we are zoomed in, this reduces
    // visual clutter
    if (focus.type === PLANET_TYPE && body.name === focus.name && focus.primary.name === 'sun') {
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

  const derived = body.derived;
  const semiMajorAxis = derived.semiMajorAxis;
  const semiMinorAxis = derived.semiMinorAxis;
  const center = this._adjustCoordinates(focus, derived.center);

  // Finally, apply scale/rotation/translation to the trajectory to place it
  // into the correct orbit
  trajectory.scale.set(1, 1, 1);
  trajectory.rotation.set(0, 0, 0);
  trajectory.position.set(0, 0, 0);

  // Now adjust the trajectory to its actual orientation
  trajectory.translateX(center.x);
  trajectory.translateY(center.y);
  trajectory.translateZ(center.z);
  trajectory.rotateZ(derived.omega);
  trajectory.rotateX(derived.I);
  trajectory.rotateZ(derived.argumentPerihelion);
  trajectory.scale.set(semiMajorAxis, semiMinorAxis, 1);
};

OrbitalMapRenderer.prototype._createTrajectoryGeometry = function () {
  const NUM_POINTS = 256;

  // Create the trajectory using a strandard ellipse curve that will
  // eventually scale/rotate/translate into the correct orbit path during
  // the render loop.
  const pointsGeometry = new THREE.Path(new THREE.EllipseCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false, // aClockwise
        0, // aRotation
      )
      .getPoints(NUM_POINTS))
    .createPointsGeometry(NUM_POINTS);
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

  return bufferGeometry;
};

OrbitalMapRenderer.prototype._onMouseover = (function () {
  const raycaster = new THREE.Raycaster();

  return function onMouseOver(location) {
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
      focusChanged = this.state.focus !== hitId;
      this.state.focus = hitId;

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
    const focus = solarSystem.find(this.state.focus);

    // For all bodies (except sun), use the size of the orbiting radius for
    // the camera position.
    let cameraDistance;
    if (focus.name === 'sun') {
      cameraDistance = 5;
    } else {
      const position = focus.derived.position;
      const primaryPosition = focus.primary.derived.position;
      cameraDistance = primaryPosition.distanceTo(position);
    }

    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(ORIGIN);

    this.orbitControls && this.orbitControls.dispose();
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.minDistance = Math.max(1e-5, focus.constants.radius * 2);
    this.orbitControls.maxDistance = 100;
    this.orbitControls.dollySpeed = 2.0;
  };

  return recenter;
};

export default OrbitalMapRenderer;