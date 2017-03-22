import * as THREE from 'three';
import moment from 'moment';
import Hammer from 'hammerjs';
import Mousetrap from 'mousetrap';
import React from 'react';
import Stats from 'stats.js';

import CommonState from './CommonState';
import LoadingView from './LoadingView';
import HudOverlay from './HudOverlay';
import HelpOverlay from './HelpOverlay';
import OrbitalMapView from './OrbitalMapView';
import CameraView from './CameraView';
import SolarSystem from '../model/SolarSystem';

import ResourceLoader from '../renderers/ResourceLoader';
import CameraViewRenderer from '../renderers/CameraViewRenderer';
import OrbitalMapRenderer from '../renderers/OrbitalMapRenderer';

class SpaceJunker extends React.Component {

  constructor(props) {
    super(props);

    const now = Date.now();
    const solarSystem = new SolarSystem();

    const resourceLoader = new ResourceLoader();
    const stats = new Stats();
    const commonState = new CommonState('apollo 11');

    this.solarSystem = solarSystem;
    this.commonState = commonState;
    this.stats = stats;
    this.frameId = null;
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
      10e6,
    ];

    this.time = now;
    this.startingTime = now;

    const orbitalMapRenderer = new OrbitalMapRenderer(solarSystem, resourceLoader, commonState);
    const cameraViewRenderer = new CameraViewRenderer(solarSystem, resourceLoader, commonState);

    this.renderers = [orbitalMapRenderer, cameraViewRenderer];
    this.views = [OrbitalMapView, CameraView];

    this.state = {
      paused: false,
      initialized: false,
      viewIdx: 0,
      timeWarpIdx: 0,
    };
  }

  componentDidMount() {

    // Initial Seeding
    this.solarSystem.update(this.time, 0);

    // Initialize Renderers
    Promise.all(this.renderers.map(renderer => renderer.viewDidLoad())).then(() => {
      this.setState({
        initialized: true,
      });

      this.run();
    });

    // Slow Down
    Mousetrap.bind(',', () => {
      this.setState(prevState => ({
        timeWarpIdx: Math.max(0, prevState.timeWarpIdx - 1),
      }));
    });

    // Speed Up
    Mousetrap.bind('.', () => {
      this.setState(prevState => ({
        timeWarpIdx: Math.min(this.timeWarpValues.length - 1, prevState.timeWarpIdx + 1),
      }));
    });

    // Toggle Pause/Run Game
    Mousetrap.bind('space', () => {
      if (this.isRunning()) {
        this.pause();
      } else {
        this.run();
      }
    });

    Mousetrap.bind('c', () => {
      this.activeRenderer().dispatchEvent({
        type: 'recenter',
      });
    });

    // Toggle Focus backwards between bodies
    Mousetrap.bind('[', () => {
      const solarSystem = this.solarSystem;
      let focusIdx = solarSystem.bodies.findIndex(p => p.name === this.commonState.focus);

      focusIdx -= 1;
      if (focusIdx < 0) {
        focusIdx = solarSystem.bodies.length - 1;
      }

      const newFocus = solarSystem.bodies[focusIdx].name;
      this.commonState.focus = newFocus;

      this.activeRenderer().dispatchEvent({
        type: 'focus', focus: newFocus,
      });
    });

    // Toggle Focus forward between bodies
    Mousetrap.bind(']', () => {
      const solarSystem = this.solarSystem;
      let focusIdx = solarSystem.bodies.findIndex(p => p.name === this.commonState.focus);

      focusIdx = (focusIdx + 1) % solarSystem.bodies.length;

      const newFocus = solarSystem.bodies[focusIdx].name;
      this.commonState.focus = newFocus;

      this.activeRenderer().dispatchEvent({
        type: 'focus', focus: newFocus,
      });
    });

    Mousetrap.bind('m', () => {
      this.setState(prevState => ({
        viewIdx: (prevState.viewIdx + 1) % this.views.length,
      }));
    });

    window.addEventListener('resize', () => {
      this.activeRenderer().dispatchEvent({
        type: 'resize',
      });
    }, true);


    window.addEventListener('mousemove', (event) => {
      const target = new THREE.Vector2(event.clientX, event.clientY);

      if (this.isRunning()) {
        this.activeRenderer().dispatchEvent({
          type: 'mouseover', location: target,
        });
      }
    }, false);

    const hammer = new Hammer.Manager(window);
    const singleTap = new Hammer.Tap({
      event: 'singletap',
    });
    const doubleTap = new Hammer.Tap({
      event: 'doubletap', taps: 2,
    });
    hammer.add([doubleTap, singleTap]);
    doubleTap.recognizeWith(singleTap);
    singleTap.requireFailure([doubleTap]);

    hammer.on('singletap', (event) => {
      const target = new THREE.Vector2(event.center.x, event.center.y);

      if (this.isRunning()) {
        this.activeRenderer().dispatchEvent({
          type: 'tap', location: target,
        });
      }
    });

    hammer.on('doubletap', (event) => {
      const target = new THREE.Vector2(event.center.x, event.center.y);

      if (this.isRunning()) {
        this.activeRenderer().dispatchEvent({
          type: 'doubletap', location: target,
        });
      }
    });
  }

  activeRenderer() {
    return this.renderers[this.state.viewIdx];
  }

  isRunning() {
    return this.frameId !== null;
  }

  pause() {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;

      this.setState({
        paused: true,
      });
    }
  }

  run() {

    if (this.isRunning()) {
      return;
    }

    const solarSystem = this.solarSystem;

    let accumulator = 0.0;
    const dt = 10;

    this.setState({
      paused: false,
    });

    this.animationFrame((frameTime) => {

      accumulator += frameTime;

      while (accumulator >= dt) {
        const t = this.time;
        const scaledDt = this.timeWarpValues[this.state.timeWarpIdx] * dt;

        // Update physics
        solarSystem.update(t, scaledDt);

        accumulator -= dt;
        this.time += scaledDt;
      }

      this.setState({
        time: this.time,
      });
    });
  }

  animationFrame(frameFunc) {
    let lastTime = null;

    const frame = (time) => {
      let stop = false;
      if (lastTime != null) {
        const timeStep = (time - lastTime);
        stop = frameFunc(timeStep) === false;
      }
      lastTime = time;
      if (!stop) {
        this.frameId = requestAnimationFrame(frame);
      }
    };

    this.frameId = requestAnimationFrame(frame);
  }

  render() {

    const isPaused = !this.isRunning();
    const isInitialized = this.state.initialized;
    const focus = this.solarSystem.find(this.commonState.focus);

    if (!isInitialized) {
      return (
        <div id="space-junker">
          <LoadingView />
        </div>);
    }

    const viewIdx = this.state.viewIdx;
    const activeView = React.createElement(
      this.views[viewIdx],
      {
        renderer: this.renderers[viewIdx],
      });


    return (
      <div id="space-junker">

        <div id="content" className={isPaused ? 'paused' : null}>

          {activeView}

          <HudOverlay
            timeWarpValues={this.timeWarpValues}
            timeWarpIdx={this.state.timeWarpIdx}
            elapsed={moment.duration(this.time - this.startingTime)}
            stats={this.stats}
            focus={focus}
          />

          <HelpOverlay />

        </div>

        {(isPaused && this.state.initialized && (
          <div id="paused-overlay" className="hud-overlay">
            <h3 className="title">Game Paused</h3>
            <p>Press <em>[space]</em> to continue.</p>
          </div>
        ))}
      </div>
    );
  }

}

export default SpaceJunker;
