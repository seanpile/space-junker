import moment from 'moment';

const numToRun = 1000;

function Simulation(solarSystem, renderer, stats) {
  this.solarSystem = solarSystem;
  this.renderer = renderer;
  this.stats = stats;
  this.isStopped = true;
  this.time = Date.now();
  this.timeWarpValues = [1, 5, 10, 50, 100, 10e2, 10e3, 10e4, 10e5, 10e6, 10e7, 10e8];
  this.timeWarpIdx = 6;

  /**
   * Handle window event listeners
   */
  const sim = this;
  const pause = (event) => {
    sim.pause();
  };
  const toggleRun = (event) => {
    if (sim.isRunning()) {
      sim.pause();
    } else {
      sim.run();
    }
  };
  const slowDown = (event) => {
    sim.slowDown();
  };
  const speedUp = (event) => {
    sim.speedUp();
  };
  const keypresses = (event) => {
    const keyCodes = {
      32: sim.toggleRun,
      44: sim.slowDown,
      46: sim.speedUp,
      99: sim.recenter,
    };

    if (event.type === "keypress" && keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this);
      event.preventDefault();
    }
  };

  console.log("Adding event listeners for simulation");
  window.addEventListener("blur", pause);
  window.addEventListener("unload", pause);
  window.addEventListener("keypress", keypresses);
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

Simulation.prototype.speedUp = function () {
  if (this.isStopped) {
    return;
  }

  this.timeWarpIdx = Math.min(this.timeWarpValues.length - 1, this.timeWarpIdx + 1);
};

Simulation.prototype.slowDown = function () {
  if (this.isStopped) {
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
  this.renderer.recenter();
};

Simulation.prototype.initialize = function () {
  this.solarSystem.update(this.time, 0);
  this.renderer.initialize(this.solarSystem)
    .then(() => {
      this.renderer.render(this, this.solarSystem);
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
    this.renderer.render(this.time, this.solarSystem);

    numTimes++;
    if (numTimes >= numToRun) {
      console.log('All done!');
      this.isStopped = true;
      this.uninitialize();
      return false;
    }

    this.time += dt;
    this.stats.end();

  }.bind(this));
};

export default Simulation;
