<template>
<div id="space-junker">

  <loading v-if="!initialized"></loading>

  <div v-else>

    <div id="content" v-bind:class="{ paused }">

      <component :is="activeView" :renderer="activeRenderer" :key="activeRendererId"></component>

      <hud :elapsed="elapsed" :timeWarpIdx="timeWarpIdx" :timeWarpValues="timeWarpValues" :focus="focus" :stats="stats"></hud>

      <help-overlay />

    </div>

    <div v-if="(paused && initialized)" id="paused-overlay" class="hud-overlay">
      <h3 class="title">Game Paused</h3>
      <p>Press
        <em>[space]</em> to continue.</p>
    </div>

  </div>

</div>
</template>

<script>
import * as THREE from 'three';
import moment from 'moment';
import Hammer from 'hammerjs';
import Mousetrap from 'mousetrap';
import Stats from 'stats.js';

import SpaceJunkerAPI from '../api/SpaceJunkerAPI';
import SharedState from '../SharedState';
import ResourceLoader from '../renderers/ResourceLoader';
import CameraViewRenderer from '../renderers/CameraViewRenderer';
import OrbitalMapRenderer from '../renderers/OrbitalMapRenderer';
import SolarSystem from '../model/SolarSystem';

import HelpOverlay from './HelpOverlay';
import Loading from './Loading';
import Hud from './Hud';
import OrbitalMap from './OrbitalMap';
import CameraView from './CameraView';

let rendererId = 0;

export default {

  props: ['loader'],

  components: {
    'help-overlay': HelpOverlay,
    'map-view': OrbitalMap,
    'camera-view': CameraView,
    'loading': Loading,
    'hud': Hud,
  },

  // Initial Data
  data: function() {

    const stats = new Stats();
    const now = Date.now();
    const solarSystem = new SolarSystem();
    const resourceLoader = this.loader;
    const sharedState = new SharedState('apollo 11');

    return {
      stats,
      solarSystem,
      resourceLoader,
      sharedState,
      focus: solarSystem.find(sharedState.focus),
      renderers: {
        'map-view': {
          id: rendererId++,
          renderer: new OrbitalMapRenderer(solarSystem,
            resourceLoader, sharedState)
        },
        'camera-view': {
          id: rendererId++,
          renderer: new CameraViewRenderer(solarSystem,
            resourceLoader, sharedState)
        },
      },
      viewIdx: 0,
      views: [
        // Maps to component names
        'map-view',
        'camera-view',
      ],

      // Animation / Time Management
      frameId: null,
      paused: false,
      initialized: false,
      elapsed: moment.duration(0),
      time: now,
      timeWarpIdx: 0,
      timeWarpValues: [
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
      ],
    }
  },

  watch: {
    sharedState: {
      deep: true,
      handler: function(val, oldVal) {
        this.focus = this.solarSystem.find(this.sharedState.focus);
      }
    },
  },

  computed: {
    activeView: function() {
      return this.views[this.viewIdx];
    },

    activeRenderer: function() {
      return this.renderers[this.activeView].renderer;
    },

    activeRendererId: function() {
      return this.renderers[this.activeView].id;
    }
  },

  methods: {

    isRunning: function() {
      return this.frameId !== null;
    },

    pause: function() {
      if (this.frameId) {
        window.cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.paused = true;
      }
    },

    run: function() {

      if (this.isRunning()) {
        return;
      }

      this.paused = false;

      const solarSystem = this.solarSystem;
      this.animationFrame((frameTime) => {

        this.stats.begin();

        const t = this.time;
        const scaledDt = this.timeWarpValues[this.timeWarpIdx] *
          frameTime;

        // Update physics
        solarSystem.update(t, scaledDt);

        this.api.onUpdate(this);

        // Repaint canvas
        this.activeRenderer.render();

        this.time += scaledDt;
        this.elapsed.add(scaledDt);
        this.stats.end();

        return this.api.onRender(this);
      });
    },

    animationFrame(frameFunc) {
      let lastTime = null;

      const frame = (time) => {
        let stop = false;
        if (lastTime != null) {
          const timeStep = (time - lastTime);
          stop = frameFunc(timeStep) === true;
        }
        lastTime = time;
        if (!stop) {
          this.frameId = requestAnimationFrame(frame);
        } else {
          this.frameId = null;
        }
      };

      this.frameId = requestAnimationFrame(frame);
    }
  },

  mounted: function() {

    // Initial Seeding
    this.solarSystem.update(this.time, 0);

    const api = new SpaceJunkerAPI();
    window.SpaceJunkerAPI = api;
    this.api = api;

    // Initialize Renderers
    Promise.all(this.views.map(v => this.renderers[v].renderer.viewDidLoad()))
      .then(() => {

        this.initialized = true;

        // Slow Down
        Mousetrap.bind(',', () => {
          this.timeWarpIdx = Math.max(0, this.timeWarpIdx - 1);
        });

        // Speed Up
        Mousetrap.bind('.', () => {
          this.timeWarpIdx = Math.min(this.timeWarpValues.length - 1,
            this.timeWarpIdx + 1);
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
          this.activeRenderer.dispatchEvent({
            type: 'recenter',
          });
        });

        // Toggle Focus backwards between bodies
        Mousetrap.bind('[', () => {
          const solarSystem = this.solarSystem;
          let focusIdx = solarSystem.bodies.findIndex(p => p.name ===
            this.sharedState.focus);

          focusIdx -= 1;
          if (focusIdx < 0) {
            focusIdx = solarSystem.bodies.length - 1;
          }

          const newFocus = solarSystem.bodies[focusIdx].name;
          this.sharedState.focus = newFocus;

          this.activeRenderer.dispatchEvent({
            type: 'focus',
            focus: newFocus,
          });
        });

        // Toggle Focus forward between bodies
        Mousetrap.bind(']', () => {
          const solarSystem = this.solarSystem;
          let focusIdx = solarSystem.bodies.findIndex(p => p.name ===
            this.sharedState.focus);

          focusIdx = (focusIdx + 1) % solarSystem.bodies.length;

          const newFocus = solarSystem.bodies[focusIdx].name;
          this.sharedState.focus = newFocus;

          this.activeRenderer.dispatchEvent({
            type: 'focus',
            focus: newFocus,
          });
        });

        Mousetrap.bind('m', () => {
          this.viewIdx = (this.viewIdx + 1) % this.views.length;
        });

        window.addEventListener('resize', () => {
          this.activeRenderer.dispatchEvent({
            type: 'resize',
          });
        }, true);

        window.addEventListener('mousemove', (event) => {
          const width = window.innerWidth;
          const height = window.innerHeight;

          const location = new THREE.Vector2(event.clientX, event.clientY);

          if (this.isRunning()) {
            this.activeRenderer.dispatchEvent({
              type: 'mouseover',
              location
            });
          }
        }, false);

        const hammer = new Hammer.Manager(window);
        const singleTap = new Hammer.Tap({
          event: 'singletap',
        });
        const doubleTap = new Hammer.Tap({
          event: 'doubletap',
          taps: 2,
        });
        hammer.add([doubleTap, singleTap]);
        doubleTap.recognizeWith(singleTap);
        singleTap.requireFailure([doubleTap]);

        hammer.on('singletap', (event) => {
          const width = window.innerWidth;
          const height = window.innerHeight;

          const location = new THREE.Vector2(event.center.x, event.center.y);
          if (this.isRunning()) {
            this.activeRenderer.dispatchEvent({
              type: 'tap',
              location: location,
            });
          }
        });

        hammer.on('doubletap', (event) => {
          const width = window.innerWidth;
          const height = window.innerHeight;

          const location = new THREE.Vector2(event.center.x, event.center.y);
          if (this.isRunning()) {
            this.activeRenderer.dispatchEvent({
              type: 'doubletap',
              location: location,
            });
          }
        });

        this.initialized = true;
        this.run();

      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    /**
     * If Hot Module Replacement is enabled, setup callbacks to reload the rendering (canvas) layer.
     * If a renderer is modified, we want to re-initialize the renderer instead of reloading
     * the entire application.
     *
     * To accomplish this, we'll listen to two specific endpoints:
     *  - ../renderers/OrbitalMapRenderer
     *  - ../renderers/CameraViewRenderer
     *
     * If the HMR system notices a change in these modules, we will get notified and attempt to
     * re-initialize the renderer and swap it into the Vue Component.
     *
     * We could simply reload the entire app, but this method allows us to maintain the existing
     * state of the game.
     */
    if (module.hot) {

      const solarSystem = this.solarSystem;
      const resourceLoader = this.loader;
      const sharedState = this.sharedState;
      const scope = this;

      function reloadRenderer(Renderer, view) {

        const staleRenderer = scope.renderers[view].renderer;
        const newRenderer = new Renderer(
          solarSystem,
          resourceLoader,
          sharedState);

        newRenderer.viewDidLoad()
          .then(() => {

            // By increasing the id, we will force Vue to update the component with the new
            // renderer
            scope.renderers[view].id = rendererId++;
            scope.renderers[view].renderer = newRenderer;

            staleRenderer.viewWillDisappear();
            staleRenderer.viewWillUnload();
          });
      }

      module.hot.accept(`../renderers/OrbitalMapRenderer`, () => {
        reloadRenderer(OrbitalMapRenderer, 'map-view');
      });
      module.hot.accept(`../renderers/CameraViewRenderer`, () => {
        reloadRenderer(CameraViewRenderer, 'camera-view');
      });
    }
  },

  destroyed: function() {
    this.pause();
    this.views.forEach(v => {
      const renderer = this.renderers[v].renderer;
      renderer.viewWillDisappear();
      renderer.viewWillUnload();
    });
  }

};
</script>

<style>
* {
    margin: 0;
    padding: 0;
}

html,
body {
    width: 100%;
    height: 100%;
    background-color: black;
}

.three-canvas {
    display: block;
}

.paused {
    -webkit-filter: blur(20px);
    -moz-filter: blur(20px);
    -o-filter: blur(20px);
    -ms-filter: blur(20px);
    filter: blur(20px);
    opacity: 0.8;
}

#paused-overlay {
    position: absolute;
    top: 30%;
    width: 30%;
    left: 35%;
    opacity: 0.6;
}

#paused-overlay p {
    width: 100%;
    text-align: center;
}

#hud {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    opacity: 0.6;
    z-index: 100;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.hud-overlay {
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    border-style: ridge;
    background-color: lightgray;
    padding-top: 5px;
    padding-bottom: 5px;
    padding-left: 10px;
    padding-right: 10px;
}

.hud-overlay .title {
    flex: 1 1 auto;
    text-align: center;
}

.hud-overlay-entry {
    flex: 0 1 auto;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.hud-overlay-entry .label {
    flex: 0 1 auto;
    padding-right: 10px;
}

.hud-overlay-entry .value {
    flex: 0 1 auto;
}
</style>
