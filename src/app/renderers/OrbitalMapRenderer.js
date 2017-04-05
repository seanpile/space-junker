import * as THREE from 'three';
import BaseRenderer from './BaseRenderer';
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
          this.fonts = fonts;

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
          const focus = solarSystem.find(this.sharedState.focus);
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
              this.refreshTrajectory(body);
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
  threeBody.scale.set(scale, scale, scale);
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, body) {

  // Check to see if the trajectory type has changed in the model;
  // If so, we need to reinstantiate a new trajectory

  const bodyMap = this.bodyMap.get(body.name);
  const threeBody = bodyMap.body;
  const orbit = body.orbit;

  let trajectory = bodyMap.trajectory;
  const trajectoryId = `${orbit.hashCode()}`;
  if (trajectory.name !== trajectoryId) {
    trajectory = this.refreshTrajectory(body);
  }

  // Determine if we should hide or show the trajectory (to de-clutter the UI)

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

  const center = this._adjustCoordinates(focus, body.orbit.stats.center);
  trajectory.position.set(center.x, center.y, center.z);
};

OrbitalMapRenderer.prototype.refreshTrajectory = function (body) {

  // Cleanup existing objects if they exist
  const bodyMap = this.bodyMap.get(body.name);
  bodyMap.trajectory && this.scene.remove(bodyMap.trajectory);
  bodyMap.periapsis && this.scene.remove(bodyMap.periapsis);
  bodyMap.apoapsis && this.scene.remove(bodyMap.apoapsis);

  const e = body.orbit.e;
  const apses = this._createApses();
  let curve, periapsis, apoapsis;
  if (e >= 0 && e < 1) {
    // Ellipse
    curve = new THREE.EllipseCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        0, 2 * Math.PI, // aStartAngle, aEndAngle
        false, // aClockwise
        0, // aRotation
      );
    periapsis = apses.periapsis;
    apoapsis = apses.apoapsis;

  } else if (e === 1) {
    // Unit parabola with focus centered on (0, 0), p = 1, q = 1 / 2
    curve = new ParabolaCurve(1 / 2, 0, 1, -10, 10);
    periapsis = apses.periapsis;

  } else if (e >= 1) {
    // Hyperbola
    curve = new HyperbolaCurve(
        0, 0, // ax, aY
        1, 1, // xRadius, yRadius
        -Math.PI, Math.PI,
      );
    periapsis = apses.periapsis;
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

  // Save the orbit's hashcode as the name so that we can easily detect if the orbit
  // changes.
  trajectory.name = `${body.orbit.hashCode()}`;

  const stats = body.orbit.stats;
  const semiMajorAxis = stats.semiMajorAxis;
  const semiMinorAxis = stats.semiMinorAxis;

  // Apply rotation and scaling to the trajectory to match the plane of the body

  trajectory.scale.set(1, 1, 1);
  trajectory.rotation.set(0, 0, 0);
  trajectory.position.set(0, 0, 0);
  trajectory.rotateZ(body.orbit.omega);
  trajectory.rotateX(body.orbit.I);
  trajectory.rotateZ(body.orbit.argumentPerihelion);

  if (e === 1) {
    trajectory.scale.set(body.orbit.p, body.orbit.p, 1);
  } else {
    trajectory.scale.set(semiMajorAxis, semiMinorAxis, 1);
  }

  this.scene.add(trajectory);
  bodyMap.trajectory = trajectory;

  if (body.isShip()) {
    this.scene.add(periapsis);
    bodyMap.periapsis = periapsis;

    if (apoapsis) {
      bodyMap.apoapsis = apoapsis;
      this.scene.add(apoapsis);
    } else {
      delete bodyMap.apoapsis;
    }
  }

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
    this.orbitControls && this.orbitControls.reset();
  };

  return recenter;
};

OrbitalMapRenderer.prototype._createApses = function () {

  const apses = ['Pe', 'Ap'].map((text) => {
    const textGeometry = new THREE.TextGeometry(
      text,
      { font: this.fonts.helvetiker, size: 1, height: 0 });
    textGeometry.computeBoundingBox();
    const textSize = textGeometry.boundingBox.getSize();

    const padding = 0.25;
    const boxshape = new THREE.Shape();
    boxshape.moveTo(-padding, -padding);
    boxshape.lineTo(-padding, textSize.y + padding);
    boxshape.lineTo(padding + textSize.x, textSize.y + padding);
    boxshape.lineTo(padding + textSize.x, -padding);
    boxshape.lineTo(textSize.x / 2, -((textSize.y / 2) + padding));
    boxshape.lineTo(-padding, -padding);

    const textObject = new THREE.Mesh(
      textGeometry,
      new THREE.MeshBasicMaterial(
        { depthFunc: THREE.AlwaysDepth },
      ));

    const boxObject = new THREE.Mesh(
      new THREE.ShapeBufferGeometry(boxshape),
      new THREE.MeshBasicMaterial({
        color: 'aqua',
        transparent: true,
        opacity: 0.5,
        depthFunc: THREE.AlwaysDepth,
      }),
    );

    const boxGeometry = new THREE.ShapeBufferGeometry(boxshape);
    boxGeometry.computeBoundingBox();
    const boxSize = boxGeometry.boundingBox.getSize();
    textObject.translateY(boxSize.y / 2);
    textObject.translateX(-boxSize.x / 2);
    boxObject.translateY(boxSize.y / 2);
    boxObject.translateX(-boxSize.x / 2);

    const apsis = new THREE.Group();
    apsis.add(boxObject);
    apsis.add(textObject);

    return apsis;
  });

  return { periapsis: apses[0], apoapsis: apses[1] };
};

OrbitalMapRenderer.prototype._updateApses = function (focus, body) {

  // Only calculate Apses for ships
  if (!body.isShip()) {
    return;
  }

  const maxScale = 2e-4;
  const { body: threeBody, periapsis, apoapsis } = this.bodyMap.get(body.name);
  const cameraDistance = this.camera.position.distanceTo(threeBody.position);
  const scale = Math.min(maxScale, 8e-3 * cameraDistance);

  if (periapsis) {
    periapsis.position.copy(this._adjustCoordinates(focus, body.orbit.stats.periapsis));
    periapsis.scale.set(scale, scale, scale);
    periapsis.setRotationFromQuaternion(this.camera.quaternion);
  }

  if (apoapsis) {
    apoapsis.position.copy(this._adjustCoordinates(focus, body.orbit.stats.apoapsis));
    apoapsis.scale.set(scale, scale, scale);
    apoapsis.setRotationFromQuaternion(this.camera.quaternion);
  }
};

OrbitalMapRenderer.prototype._adjustManeuver = (function () {
  const raycaster = new THREE.Raycaster();
  raycaster.linePrecision = 1e-4;

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
      const closest = intersection[0];
      const worldCoordinates = new THREE.Vector3().addVectors(closest.point, focus.position);
      focus.orbit.project(worldCoordinates);
    }
  };
}());

export default OrbitalMapRenderer;
