import * as THREE from 'three';
import Maneuver from '../model/Maneuver';
import BaseRenderer from './BaseRenderer';
import UIPlanet from './three/UIPlanet';
import UIShip from './three/UIShip';
import UIManeuver from './three/UIManeuver';
import { hitTest } from './RenderUtils';

const OrbitControls = require('three-orbit-controls')(THREE);

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
          this.resources = { textures, models, fonts };

          this.mouseOverTimeout = null;
          this.mouseOverCallback = null;
          this.maneuverCallback = null;

          this.tapLocation = null;
          this.doubleTapLocation = null;

          const width = window.innerWidth;
          const height = window.innerHeight;

          this.scene = new THREE.Scene();
          this.scene.background = new THREE.Color('black');

          this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
          this.camera.up = new THREE.Vector3(0, 0, 1);

          const skyBox = this._createSkyBox();
          this.scene.add(skyBox);

          // Setup light
          this.lightSources = this._setupLightSources(textures);

          // Setup navball
          this.navball = this.loadNavball(textures);

          const recenter = this._onRecenter();
          const onWindowResize = this._onWindowResize([this.camera, this.navball.camera],
                                                      height,
                                                      this.camera.fov);

          /**
           * Register to receive events from the simulation
           */
          this.addEventListener('tap', (event) => {
            this.tapLocation = event.location.clone();
          });

          this.addEventListener('doubletap', (event) => {
            this.doubleTapLocation = event.location.clone();
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
            this.orbitControls.minDistance = Math.max(5e-5, focus.constants.radius * 2);
            this.orbitControls.maxDistance = 100;
            this.orbitControls.minPolarAngle = 0.1;
            this.orbitControls.maxPolarAngle = Math.PI - 0.1;
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
          const isMapView = true;
          solarSystem.bodies.filter(b => b.name !== 'sun').forEach((body) => {

            let threeBody;
            if (body.isPlanet()) {
              threeBody = UIPlanet.createPlanet(body, this.resources, isMapView);
            } else if (body.isShip()) {
              threeBody = UIShip.createShip(body, this.resources, isMapView);
            }

            this.scene.add(threeBody);
            this.bodyMap.set(body.name, threeBody);
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
  this.scene.remove(...this.bodyMap.values());
  this.bodyMap.clear();
  this.resources = null;

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
    const threeBody = this.bodyMap.get(body.name);
    threeBody.visible = false;
  });

  visible.forEach((body) => {

    const threeBody = this.bodyMap.get(body.name);
    threeBody.visible = true;

    // Adjust position to re-center the coordinate system on the focus
    threeBody.updatePosition(this._adjustCoordinates(focus, body.position));

    if (body.isPlanet()) {
      threeBody.applyPlanetaryRotation();
    }

    this._scaleBody(body);
    this._updateTrajectory(focus, body);
  });

  this._handleUserEvents();
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
OrbitalMapRenderer.prototype._updateCamera = function (focus) {
  const tol = 1e-8;
  const length = this.camera.position.length();

  // Only do this computation if there has been a change
  if (!this.lastCameraLength || (Math.abs(length - this.lastCameraLength) > tol)) {
    this.camera.near = this.camera.position.length() * 1e-6;
    this.camera.updateProjectionMatrix();
  }

  this.lastCameraLength = length;
};

OrbitalMapRenderer.prototype._scaleBody = function (body) {
  const threeBody = this.bodyMap.get(body.name);
  const cameraDistance = this.camera.position.distanceTo(threeBody.position);

  if (body.isPlanet()) {
    const scale = Math.max(0.005 * cameraDistance, body.constants.radius) / body.constants.radius;
    threeBody.sphere.scale.set(scale, scale, scale);
  } else {
    const scale = 2 * Math.max(0.005 * cameraDistance, body.constants.radius) / body.constants.radius;
    threeBody.sphere.scale.set(scale, scale, scale);
  }
};

OrbitalMapRenderer.prototype._updateTrajectory = function (focus, body) {

  // Check to see if the trajectory type has changed in the model;
  // If so, we need to reinstantiate a new trajectory

  const threeBody = this.bodyMap.get(body.name);
  const orbitId = `${body.orbit.hashCode()}`;
  let orbit = threeBody.orbit;

  if (orbit.name !== orbitId) {
    orbit = UIOrbit.createOrbit(body, this.resources.fonts);
    threeBody.refreshOrbit(orbit);
  }

  // Determine if we should hide or show the trajectory (to de-clutter the UI)

  const showTrajectoryTheshold = 0.05;
  let visible = true;
  if (this.camera.position.distanceTo(threeBody.position) < showTrajectoryTheshold) {
    // Don't show the trajectory of our primary body if we are zoomed in
    if (focus.isPlanet() && body.name === focus.name && focus.primary.name === 'sun') {
      visible = false;
    // Don't show the trajectory of our primary's orbit
    } else if (focus.primary && focus.primary.name === body.name) {
      visible = false;
    }
  }

  if (!visible) {
    orbit.visible = false;
    return;
  }

  orbit.visible = true;
  orbit.update(focus, this.camera);

  if (body.isShip()) {
    if (focus === body) {
      orbit.setColor('skyblue');
      orbit.showApses();
    } else {
      orbit.setColor('white');
      orbit.hideApses();
    }
  }
};

OrbitalMapRenderer.prototype._onRecenter = function () {
  const recenter = () => {
    const focus = this.solarSystem.find(this.sharedState.focus);

    // For all bodies (except sun), use the size of the orbiting radius for
    // the camera position.
    let cameraDistance;
    if (focus.name === 'sun') {
      cameraDistance = 5;
    } else {
      const position = focus.position;
      const primaryPosition = focus.primary.position;
      cameraDistance = 1.5 * primaryPosition.distanceTo(position);
    }

    this.orbitControls && this.orbitControls.reset();
    this.camera.position.set(0, -1e-8, cameraDistance);
  };

  return recenter;
};

OrbitalMapRenderer.prototype._onMouseover = (function () {
  const raycaster = new THREE.Raycaster();
  return function onMouseover(location) {

    // If we've already fired off an event, cancel it and start a new one
    if (this.mouseOverTimeout !== null) {
      clearInterval(this.mouseOverTimeout);
    }

    this.mouseOverTimeout = setTimeout(() => {

      const height = window.innerHeight;
      const bodiesToTest = [];
      bodiesToTest.push(
        ...Array.from(this.bodyMap.values())
          .filter(body => body.visible)
          .map(threeBody => threeBody.sphere));

      hitTest(
        raycaster,
        this.camera,
        location,
        bodiesToTest,
        (intersection) => {
          if (intersection.length > 0) {

            const closest = intersection[0];
            const callbackData = {
              type: 'planet',
              name: closest.object.name,
              location: new THREE.Vector2(location.x, height - location.y),
            };

            this.mouseOverCallback(callbackData);

          } else {
            this.mouseOverCallback(null);
          }
        });
    }, 200);
  };
}());

OrbitalMapRenderer.prototype._switchFocus = (function () {

  const raycaster = new THREE.Raycaster();
  return function (location) {

    let focusChanged = false;
    hitTest(
      raycaster,
      this.camera,
      location,
      Array.from(this.bodyMap.values())
          .filter(body => body.visible)
          .map(threeBody => threeBody.sphere),
      (intersection) => {
        if (intersection.length > 0) {
          const hitId = intersection[0].object.name;
          focusChanged = this.sharedState.focus !== hitId;
          this.sharedState.focus = hitId;

          const newFocus = this.solarSystem.find(hitId);
          this.orbitControls.minDistance = Math.max(1e-4, newFocus.constants.radius * 2);
          this.orbitControls.update();
        }
      });

    return focusChanged;
  };
}());


OrbitalMapRenderer.prototype._adjustManeuver = (function () {
  const raycaster = new THREE.Raycaster();

  return function (location) {

    const focus = this.solarSystem.find(this.sharedState.focus);
    if (!focus.isShip()) {
      return;
    }

    raycaster.linePrecision = this.camera.position.length() * 0.1;

    const orbit = this.bodyMap.get(focus.name).orbit;
    const objectsToTest = [orbit.trajectory].concat(orbit.maneuvers);

    hitTest(
      raycaster,
      this.camera,
      location,
      objectsToTest,
      (intersection) => {
        if (intersection.length > 0) {
          const closest = intersection[0];
          if (closest.object instanceof UIManeuver) {

            const maneuver = closest.object.maneuver;
            const time = this.solarSystem.time + (focus.orbit.delta(maneuver.orbit.M) * 1000);
            this.mouseClickCallback({
              type: 'maneuver',
              location: new THREE.Vector2(location.x, window.innerHeight - location.y),
              time,
            });

          } else {

            const worldCoordinates = new THREE.Vector3().addVectors(closest.point, focus.position);
            const projectedOrbit = focus.orbit.project(worldCoordinates);
            const time = this.solarSystem.time + (focus.orbit.delta(projectedOrbit.M) * 1000);

            // Add maneuver to model
            const maneuver = new Maneuver({ orbit: projectedOrbit, deltaV: new THREE.Vector3() });
            focus.addManeuver(maneuver);

            // Create a UI element to represent this maneuver
            orbit.addManeuver(UIManeuver.createManeuver(maneuver));

            this.mouseClickCallback({
              type: 'add-maneuver',
              location: new THREE.Vector2(location.x, window.innerHeight - location.y),
              time,
            });
          }
        } else {
          // Nothing clicked on
          this.mouseClickCallback(null);
        }
      },
    );
  };
}());

OrbitalMapRenderer.prototype._handleUserEvents = function handleUserEvents() {

  if (this.tapLocation) {
    this._adjustManeuver(this.tapLocation);
    this.tapLocation = null;
  }

  if (this.doubleTapLocation) {
    this._switchFocus(this.doubleTapLocation);
    this.doubleTapLocation = null;
  }
};

export default OrbitalMapRenderer;
