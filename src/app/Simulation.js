import moment from 'moment';
import * as THREE from 'three'
import {
  AU
} from './Bodies';
import StringExtensions from './util/StringExtensions';

import {
  Splash
} from 'splash-screen';
import 'SplashCss';

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
  this.timeWarpValues = [1, 5, 10, 50, 100, 10e2, 10e3, 10e4, 10e5, 10e6];
  this.timeWarpIdx = 0;
  this.frameId = null;
  this.initialized = false;

  this.hud = document.getElementById('hud');
  this.loadingScreen = document.getElementById('loading');
  this.timeCounter = document.getElementById('time');
  this.timeStatus = document.getElementById('time-status');
  this.warpValues = document.getElementById('warp-values');
  this.timeWarpValues.forEach((value, idx) => {
    const arrow = document.createElement('div');
    this.warpValues.appendChild(arrow);
  });

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
      122: this.toggleView,
    };

    if (keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this, event);
      event.preventDefault();
    } else {
      this.renderer.dispatchEvent({
        type: 'keypress',
        key: event.keyCode
      });
    }
  };

  window.addEventListener("keypress", keypresses, false);
  window.addEventListener("resize", (event) => {
    this.renderer.dispatchEvent({
      type: "resize"
    });
  }, true);

  window.addEventListener("mousemove", (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;

    let target = new THREE.Vector2(event.clientX, event.clientY);

    if (this.isRunning()) {
      this.renderer.dispatchEvent({
        type: 'mouseover',
        location: target
      });
    }
  }, false);

  window.addEventListener("mousedown", (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;

    let target = new THREE.Vector2(event.clientX, event.clientY);

    if (this.isRunning()) {
      this.renderer.dispatchEvent({
        type: 'click',
        location: target
      });
    }
  }, false);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      this.pause();
    } else {
      this.run();
    }
  });
};

Simulation.prototype.speedUp = function () {
  if (!this.isRunning()) {
    return;
  }

  this.timeWarpIdx = Math.min(this.timeWarpValues.length - 1, this.timeWarpIdx + 1);
};

Simulation.prototype.slowDown = function () {
  if (!this.isRunning()) {
    return;
  }

  this.timeWarpIdx = Math.max(0, this.timeWarpIdx - 1);
};

Simulation.prototype.pause = function () {
  if (this.frameId) {
    window.cancelAnimationFrame(this.frameId);
    this.frameId = null;

    this.updateTimeDisplay();
  }
};

Simulation.prototype.isRunning = function () {
  return this.frameId !== null;
};

Simulation.prototype.toggleRun = function () {
  if (this.isRunning()) {
    this.pause();
  } else {
    this.run();
  }
};

Simulation.prototype.recenter = function () {
  if (!this.isRunning()) {
    return;
  }

  this.renderer.dispatchEvent({
    type: 'recenter'
  });
};

Simulation.prototype.toggleFocus = function (event) {

  let solarSystem = this.solarSystem;
  let focusIdx = solarSystem.bodies.findIndex((p) => p.name === this.state.focus);

  if (event.keyCode === 91) {
    focusIdx--;
    if (focusIdx < 0)
      focusIdx = solarSystem.bodies.length - 1;
  } else {
    focusIdx = (focusIdx + 1) % solarSystem.bodies.length;
  }

  this.state.focus = solarSystem.bodies[focusIdx].name;
  this.renderer.dispatchEvent({
    type: 'focus',
    focus: this.state.focus
  });
};

Simulation.prototype.initialize = function () {

  Splash.enable('spinner-section-far');

  // Ensure the solar system is fully 'seeded' before we attempt to render
  this.solarSystem.update(this.time, 0);

  this.renderers.forEach((renderer) => {
    renderer.container.style = 'display: none;';
  });

  // Bring up the appropriate view and hide the others
  console.log(`Loading ${this.renderer.constructor.name}`);
  return this.renderer.viewDidLoad(this.solarSystem)
    .then(() => {
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

Simulation.prototype.toggleView = function () {
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

    promise = newRenderer.viewDidLoad(this.solarSystem)
      .then(() => {
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

Simulation.prototype.run = function () {

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

Simulation.prototype.updateOrbitalDisplay = function () {

  const focus = this.solarSystem.find(this.state.focus);
  const name = focus.name;
  const velocity = focus.derived.velocity.length() * AU;
  const eccentricity = focus.derived.e || 0;
  const semiMajorAxis = focus.derived.semiMajorAxis * AU;
  const semiMinorAxis = focus.derived.semiMinorAxis * AU;
  const rotation_period = focus.constants.rotation_period || 0;
  const axial_tilt = focus.constants.axial_tilt || 0;
  const orbital_period = (focus.derived.orbital_period || 0) / 86400;

  document.getElementById('orbital-name')
    .innerHTML = name.escapeHtml();
  document.getElementById('orbital-primary')
    .innerHTML = (focus.primary ? focus.primary.name : '')
    .escapeHtml();
  document.getElementById('orbital-speed')
    .innerHTML = `${velocity.toFixed(2)} m/s`.escapeHtml();
  document.getElementById('orbital-eccentricity')
    .innerHTML = `${eccentricity.toFixed(4)}`.escapeHtml();
  document.getElementById('orbital-semiMajorAxis')
    .innerHTML = `${semiMajorAxis.toExponential(4)} m`.escapeHtml();
  document.getElementById('orbital-semiMinorAxis')
    .innerHTML = `${semiMinorAxis.toExponential(4)} m`.escapeHtml();
  document.getElementById('orbital-period')
    .innerHTML = `${orbital_period.toFixed(4)} days`.escapeHtml();
  document.getElementById('orbital-rotation-period')
    .innerHTML = `${rotation_period.toFixed(4)} days`.escapeHtml();
  document.getElementById('orbital-axial-tilt')
    .innerHTML = `${axial_tilt.toFixed(2)}°`.escapeHtml();
};

Simulation.prototype.updateTimeDisplay = function () {
  const elapsed = moment.duration(this.time - this.startingTime);
  const years = elapsed.years();
  const months = elapsed.months();
  const days = elapsed.days() + months * 30;
  const hours = elapsed.hours();
  const minutes = elapsed.minutes();
  const seconds = elapsed.seconds();

  const values = [];

  if (years > 0)
    values.push(`${years}Y`);

  if (days > 0)
    values.push(`${days}d`);

  values.push(
    hours.toString()
    .paddingLeft('00'),
    minutes.toString()
    .paddingLeft('00'),
    seconds.toString()
    .paddingLeft('00')
  )

  Array.from(this.warpValues.children)
    .forEach((value, idx) => {
      if (idx <= this.timeWarpIdx) {
        value.className = 'warp-enabled';
      } else {
        value.className = 'warp-disabled';
      }
    });
  this.timeCounter.innerHTML = `+T ${values.join(':')}`.escapeHtml();
  this.timeStatus.innerHTML = (this.isRunning() ? 'Active Mission' : 'Game Paused')
    .escapeHtml()
  this.timeStatus.className = (this.isRunning() ? 'status-running' : 'status-paused');

}

Simulation.prototype._runAnimation = function (frameFunc) {
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
