import moment from 'moment';

const numToRun = 10000;

function Simulation(solarSystem, renderers, state, stats) {
  this.solarSystem = solarSystem;
  this.renderers = renderers;
  this.rendererIdx = 0;
  this.renderer = renderers[this.rendererIdx];
  this.loaded = new Set();
  this.state = state;
  this.stats = stats;
  this.isStopped = true;
  this.time = Date.now();
  this.timeWarpValues = [1, 5, 10, 50, 100, 10e2, 10e3, 10e4, 10e5, 10e6, 10e7, 10e8];
  this.timeWarpIdx = 6;

  this.hud = document.getElementById('hud');
  this.timeCounter = document.getElementById('time');

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

    if (event.type === "keypress" && keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this, event);
      event.preventDefault();
    }
  };

  window.addEventListener("keypress", keypresses);
  window.addEventListener("resize", (event) => {
    this.renderers.forEach((renderer) => {
      renderer.dispatchEvent({
        type: "resize"
      });
    });
  });

  window.addEventListener("mousedown", (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    let pixelMultiplier = window.devicePixelRatio;

    let target = new THREE.Vector2(
      (event.clientX - width / 2) * pixelMultiplier,
      (height / 2 - event.clientY) * pixelMultiplier);

    this.renderer.dispatchEvent({
      type: 'click',
      location: target
    });
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
  this.isStopped = true;
};

Simulation.prototype.isRunning = function () {
  return !this.isStopped;
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
  let focusIdx = solarSystem.planets.findIndex((p) => p.name === this.state.focus);

  if (event.keyCode === 91) {
    focusIdx--;
    if (focusIdx < 0)
      focusIdx = solarSystem.planets.length - 1;
  } else {
    focusIdx = (focusIdx + 1) % solarSystem.planets.length;
  }

  this.state.focus = solarSystem.planets[focusIdx].name;
  this.renderer.dispatchEvent({
    type: 'focus',
    focus: this.state.focus
  });
};

Simulation.prototype.initialize = function () {

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
      return Promise.resolve();
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
    promise = newRenderer.viewDidLoad(this.solarSystem)
      .then(() => {
        this.loaded.add(newRenderer);
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

  if (this.isRunning()) {
    return;
  }

  this.isStopped = false;
  let numTimes = 0;

  runAnimation(function (dt) {

    if (this.isStopped) {
      return false;
    }

    this.stats.begin();

    let t = this.time;
    let timeScale = this.timeWarpValues[this.timeWarpIdx];
    dt *= timeScale;

    // Update physics
    this.solarSystem.update(t, dt);
    this.renderer.render(this.solarSystem);

    numTimes++;
    if (numTimes >= numToRun) {
      console.log('All done!');
      this.isStopped = true;
      return false;
    }

    this.timeCounter.innerHTML = `${moment(this.time).format('MMMM D, YYYY - HH:mm:ss')}`;

    this.time += dt;
    this.stats.end();

  }.bind(this));
};

function runAnimation(frameFunc) {
  var lastTime = null;

  function frame(time) {
    var stop = false;
    if (lastTime != null) {
      var timeStep = (time - lastTime);
      stop = frameFunc(timeStep) === false;
    }
    lastTime = time;
    if (!stop)
      requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

export default Simulation;
