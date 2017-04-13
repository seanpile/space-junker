<template>
<div id="map-view" v-canvas="renderer">

  <div class="hud-overlay" id="planet-overlay" v-if="mouseOverTarget" v-bind:style="{
    bottom: `${this.mouseOverTarget.location.y}px`,
    left: `${this.mouseOverTarget.location.x}px`
  }">
    <h5 class="title">{{this.mouseOverTarget.name}}</h5>
  </div>

  <div class="hud-overlay" id="maneuver-overlay" v-if="mouseClickTarget" v-bind:style="{
    left: `${this.mouseClickTarget.location.x}px`,
    bottom: `${this.mouseClickTarget.location.y + 25}px`
  }">
    <h5 class="title">Maneuver</h5>
    <span class="hud-overlay-entry">{{delta(mouseClickTarget.time)}}</span>
  </div>

  </div>

  </div>
</template>

<script>
const moment = require('moment');
require('moment-duration-format');

export default {

  data: function() {
    return {
      time: this.renderer.solarSystem.time,
      mouseOverTarget: null,
      mouseClickTarget: null,
    }
  },
  methods: {
    delta: function(toTime) {
      const currentTime = this.time;
      const futureTime = toTime;
      const delta = moment.duration(futureTime - currentTime);
      return delta.format('d [ days], h[ hours], m[ minutes], s[ seconds]');
    },
  },

  props: ['renderer'],
  directives: {
    canvas: {
      bind: function(el, binding) {
        const renderer = binding.value;
        const domElement = renderer.dom;
        domElement.className = 'three-canvas';
        el.appendChild(domElement);
      }
    }
  },

  mounted: function() {
    this.renderer.viewWillAppear();
    this.renderer.mouseOverCallback = (mouseOverTarget) => {
      this.mouseOverTarget = mouseOverTarget;
    }

    this.renderer.mouseClickCallback = (mouseClickTarget) => {
      console.log(mouseClickTarget);
      this.mouseClickTarget = mouseClickTarget;
    };

    // Update my time to keep durations ticking in the UI
    this.timerId = setInterval(() => {
      this.time = this.renderer.solarSystem.time;
    }, 200);
  },

  destroyed: function() {
    this.renderer.viewWillDisappear();
    clearInterval(this.timerId);
  }

}
</script>

<style scoped>
#planet-overlay {
    position: absolute;
}

#maneuver-overlay {
    position: absolute;
}

.title {
    text-transform: capitalize;
    flex: 1 1 auto;
    text-align: center;
}

.span {
    flex: 0 1 auto;
    text-align: center;
}

.button {
    flex: 1 1 auto;
    text-align: center;
}
</style>
