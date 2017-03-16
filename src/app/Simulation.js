import moment from 'moment';
import Hammer from 'hammerjs';
import * as THREE from 'three'

import {Splash} from 'splash-screen';
import 'SplashCss';

import React from 'react';
import ReactDOM from 'react-dom';
import WarpView from './view/WarpView.jsx';
import OrbitalStats from './view/OrbitalStats.jsx';

function Simulation(solarSystem, renderers, state, stats) {
  this.solarSystem = solarSystem;
  this.renderers = renderers;
  this.rendererIdx = 0;
  this.renderer = renderers[this.rendererIdx];
  this.loaded = new Set();
  this.state = state;
  this.stats = stats;
  this.time = Date.now();
  this.startingTime = this.time;
  this.timeWarpValues = [
    1,
    5,
    10,
    50,
    100,
    10e2,
    10e3,
    10e4,
    10e5,
    10e6
  ];
  this.timeWarpIdx = 0;

  this.frameId = null;
  this.initialized = false;

  this.hud = document.getElementById('hud');
  this.loadingScreen = document.getElementById('loading');
  this.warpViewElement = document.getElementById('warp-overlay');
  this.orbitalStatsElement = document.getElementById('orbital-overlay');

  /**
   * Handle window event listeners
   */
  const keypresses = (event) => {
    const keyCodes = {
      32: this.toggleRun,
      44: this.slowDown,
      46: this.speedUp,
      99: this.recenter,
      91: this.toggleFocus,
      93: this.toggleFocus,
      109: this.toggleView
    };

    if (keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this, event);
      event.preventDefault();
    } else {
      this.renderer.dispatchEvent({type: 'keypress', key: event.keyCode});
    }
  };

  window.addEventListener("keypress", keypresses, false);
  window.addEventListener("resize", (event) => {
    this.renderer.dispatchEvent({type: "resize"});
  }, true);

  window.addEventListener("mousemove", (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;

    let target = new THREE.Vector2(event.clientX, event.clientY);

    if (this.isRunning()) {
      this.renderer.dispatchEvent({type: 'mouseover', location: target});
    }
  }, false);

  const hammer = new Hammer.Manager(window);
  const singleTap = new Hammer.Tap({event: 'singletap'});
  const doubleTap = new Hammer.Tap({event: 'doubletap', taps: 2});
  hammer.add([doubleTap, singleTap]);
  doubleTap.recognizeWith(singleTap);
  singleTap.requireFailure([doubleTap]);

  hammer.on('singletap', (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;

    let target = new THREE.Vector2(event.center.x, event.center.y);

    if (this.isRunning()) {
      this.renderer.dispatchEvent({type: 'tap', location: target});
    }
  });

  hammer.on('doubletap', (event) => {

    let width = window.innerWidth;
    let height = window.innerHeight;

    let target = new THREE.Vector2(event.center.x, event.center.y);

    if (this.isRunning()) {
      this.renderer.dispatchEvent({type: 'doubletap', location: target});
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      this.pause();
    } else {
      this.run();
    }
  });
};

Simulation.prototype.speedUp = function() {
  if (!this.isRunning()) {
    return;
  }

  this.timeWarpIdx = Math.min(this.timeWarpValues.length - 1, this.timeWarpIdx + 1);
};

Simulation.prototype.slowDown = function() {
  if (!this.isRunning()) {
    return;
  }

  this.timeWarpIdx = Math.max(0, this.timeWarpIdx - 1);
};

Simulation.prototype.pause = function() {
  if (this.frameId) {
    window.cancelAnimationFrame(this.frameId);
    this.frameId = null;

    this.updateTimeDisplay();
  }
};

Simulation.prototype.isRunning = function() {
  return this.frameId !== null;
};

Simulation.prototype.toggleRun = function() {
  if (this.isRunning()) {
    this.pause();
  } else {
    this.run();
  }
};

Simulation.prototype.recenter = function() {
  if (!this.isRunning()) {
    return;
  }

  this.renderer.dispatchEvent({type: 'recenter'});
};

Simulation.prototype.toggleFocus = function(event) {

  let solarSystem = this.solarSystem;
  let focusIdx = solarSystem.bodies.findIndex((p) => p.name === this.state.focus);

  if (event.keyCode === 91) {
    focusIdx--;
    if (focusIdx < 0)
      focusIdx = solarSystem.bodies.length - 1;
    }
  else {
    focusIdx = (focusIdx + 1) % solarSystem.bodies.length;
  }

  this.state.focus = solarSystem.bodies[focusIdx].name;
  this.renderer.dispatchEvent({type: 'focus', focus: this.state.focus});
};

Simulation.prototype.initialize = function() {

  Splash.enable('spinner-section-far');

  // Ensure the solar system is fully 'seeded' before we attempt to render
  this.solarSystem.update(this.time, 0);

  this.renderers.forEach((renderer) => {
    renderer.container.style = 'display: none;';
  });

  // Bring up the appropriate view and hide the others
  console.log(`Loading ${this.renderer.constructor.name}`);
  return this.renderer.viewDidLoad(this.solarSystem).then(() => {
    // Once the views are loaded, we can be prepare to surface this view
    this.renderer.viewWillAppear();
    this.renderer.container.style = '';
    this.loaded.add(this.renderer);

    Splash.destroy();
    this.hud.style = '';
    this.loadingScreen.style = 'display: none;';
    this.initialized = true;
  });
};

Simulation.prototype.toggleView = function() {
  this.rendererIdx = (this.rendererIdx + 1) % this.renderers.length;
  const oldRenderer = this.renderer;

  oldRenderer.viewWillDisappear();
  oldRenderer.container.style = 'display: none;';

  const newRenderer = this.renderers[this.rendererIdx];

  let promise;
  if (!this.loaded.has(newRenderer)) {
    console.log(`Loading ${newRenderer.constructor.name}`);
    Splash.enable('spinner-section-far');
    this.loadingScreen.style = '';

    promise = newRenderer.viewDidLoad(this.solarSystem).then(() => {
      this.loaded.add(newRenderer);
      Splash.destroy();
      this.loadingScreen.style = 'display: none;';
      return Promise.resolve();
    })
  } else {
    promise = Promise.resolve();
  }

  promise.then(() => {
    newRenderer.viewWillAppear();
    newRenderer.container.style = '';
    this.renderer = newRenderer;
  });
}

Simulation.prototype.run = function() {

  if (this.isRunning() || !this.initialized) {
    return;
  }

  let accumulator = 0.0;
  let dt = 10; // ms

  this._runAnimation((frameTime) => {

    this.stats.begin();

    accumulator += frameTime;

    let numTimes = 0;
    while (accumulator >= dt) {
      let t = this.time;
      let scaledDt = this.timeWarpValues[this.timeWarpIdx] * dt;

      // Update physics
      this.solarSystem.update(t, scaledDt);

      accumulator -= dt;
      this.time += scaledDt;
      numTimes++;
    }

    this.renderer.render(this.solarSystem);

    this.updateOrbitalDisplay();
    this.updateTimeDisplay();
    this.stats.end();
    return true;

  });
};

Simulation.prototype.updateOrbitalDisplay = function() {

  const focus = this.solarSystem.find(this.state.focus);
  //
  //   // Ship-only Data
  //   document.querySelector('#ship-propellant div.value').innerHTML = `${focus.stages[0].propellant.toFixed(2)} kg`.escapeHtml();
  //   document.querySelector('#ship-specific-impulse div.value').innerHTML = `${focus.stages[0].isp} s`.escapeHtml();
  //
  //   const maxThrust = focus.stages[0].thrust / 1000;
  //   const thrustLevel = focus.motion.thrust;
  //   document.querySelector('#ship-thrust div.value').innerHTML = `${ (thrustLevel * maxThrust).toFixed(2)} / ${maxThrust.toFixed(2)} kN`.escapeHtml();
  //

  ReactDOM.render(
    <OrbitalStats focus={focus}/>, document.getElementById('orbital-overlay'));
};

Simulation.prototype.updateTimeDisplay = function() {

  const elapsed = moment.duration(this.time - this.startingTime);
  const props = {
    idx: this.timeWarpIdx,
    values: this.timeWarpValues,
    elapsed: elapsed,
    isRunning: this.isRunning()
  }

  ReactDOM.render(
    <WarpView {...props}/>, document.getElementById('warp-overlay'));
}

Simulation.prototype._runAnimation = function(frameFunc) {
  var lastTime = null;

  const frame = (time) => {
    var stop = false;
    if (lastTime != null) {
      var timeStep = (time - lastTime);
      stop = frameFunc(timeStep) === false;
    }
    lastTime = time;
    if (!stop)
      this.frameId = requestAnimationFrame(frame);
    };

  this.frameId = requestAnimationFrame(frame);
};

export default Simulation;
