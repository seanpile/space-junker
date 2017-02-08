import moment from 'moment';

const numToRun = 100000;

function Simulation(solarSystem, renderers, stats, container) {
  this.solarSystem = solarSystem;
  this.renderers = renderers;
  this.rendererIdx = 0;
  this.renderer = renderers[this.rendererIdx];
  this.stats = stats;
  this.isStopped = true;
  this.time = Date.now();
  this.timeWarpValues = [1, 5, 10, 50, 100, 10e2, 10e3, 10e4, 10e5, 10e6, 10e7, 10e8];
  this.timeWarpIdx = 6;

  this.metaContainer = document.getElementById('meta');
  this.metaContainer.appendChild(stats.dom);

  this.timeCounter = document.createElement('h4');
  this.metaContainer.appendChild(this.timeCounter);

  /**
   * Handle window event listeners
   */
  const sim = this;
  const pause = (event) => {
    sim.pause();
  };

  const keypresses = (event) => {
    const keyCodes = {
      32: sim.toggleRun,
      44: sim.slowDown,
      46: sim.speedUp,
      99: sim.recenter,
      122: sim.toggleView,
    };

    if (event.type === "keypress" && keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this);
      event.preventDefault();
    }
  };

  window.addEventListener("blur", pause);
  window.addEventListener("unload", pause);
  window.addEventListener("keypress", keypresses);
};

Simulation.prototype.toggleView = function () {

  this.rendererIdx = (this.rendererIdx + 1) % this.renderers.length;
  const oldRenderer = this.renderer;
  const newRenderer = this.renderers[this.rendererIdx];

  newRenderer.initialize(this.solarSystem)
    .then(() => {
      newRenderer.render(this.solarSystem);
    });

  this.renderer = newRenderer;

  oldRenderer.container.style = 'display: none;';
  newRenderer.container.style = '';

  oldRenderer.uninitialize();
}

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

  this.renderer.recenter();
};

Simulation.prototype.initialize = function () {
  this.solarSystem.update(this.time, 0);
  this.renderer.initialize(this.solarSystem)
    .then(() => {
      this.renderer.render(this.solarSystem);
    });
};

Simulation.prototype.uninitialize = function () {
  this.renderer.uninitialize();
};

Simulation.prototype.run = function () {

  if (this.isRunning()) {
    return;
  }

  this.isStopped = false;
  let numTimes = 0;

  this.initialize();

  runAnimation(function (dt) {

    if (this.isStopped) {
      this.uninitialize();
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
      this.uninitialize();
      return false;
    }

    this.timeCounter.innerHTML = `${moment(this.time).format()}`;

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
