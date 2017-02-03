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
  this.viewDeltaX = 0;
  this.viewDeltaY = 0;

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

Simulation.prototype.zoomIn = function (x, y) {
  if (this.isStopped) {
    return;
  }

  this.renderer.zoomIn(x, y);
};

Simulation.prototype.zoomOut = function (x, y) {
  if (this.isStopped) {
    return;
  }

  this.renderer.zoomOut(x, y);
};

Simulation.prototype.recenter = function () {
  if (this.isStopped) {
    return;
  }

  this.renderer.recenter();
};

Simulation.prototype.moveViewBy = function (deltaX, deltaY) {
  if (this.isStopped) {
    return;
  }

  this.renderer.moveViewBy(deltaX, deltaY);
};

Simulation.prototype.isRunning = function () {
  return !this.isStopped;
}

Simulation.prototype.toggleRun = function () {
  if (this.isRunning()) {
    this.pause();
  } else {
    this.run();
  }
}

Simulation.prototype.initialize = function () {
  this.solarSystem.update(this.time, 0);
  this.renderer.initialize(this.solarSystem)
    .then(() => {
      this.renderer.render(this, this.solarSystem);
    });

  window.addEventListener("blur", this.pause);
  window.addEventListener("unload", this.pause);

  const keyCodes = {
    32: this.toggleRun,
    44: this.slowDown,
    46: this.speedUp,
  };

  addEventListener("keypress", (event) => {
    if (event.type === "keypress" && keyCodes.hasOwnProperty(event.keyCode)) {
      keyCodes[event.keyCode].call(this);
      event.preventDefault();
    }
  });
};

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
    this.renderer.render(this.time, this.solarSystem);

    numTimes++;
    if (numTimes >= numToRun) {
      console.log('All done!');
      this.isStopped = true;
      return false;
    }

    this.time += dt;
    this.stats.end();

  }.bind(this));
};

export default Simulation;
