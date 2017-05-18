
<template>
<div id="hud">
  <warp-overlay :timeWarpIdx="timeWarpIdx" :timeWarpValues="timeWarpValues" :elapsed="elapsed"></warp-overlay>

  <orbital-stats :focus="focus"></orbital-stats>

  <ship-stats :focus="focus"></ship-stats>

  <div class="fps-overlay">
    <div class="label">FPS</div>
    <div class="value">{{fps.toFixed(2)}}</div>
  </div>

</div>
</template>

<script>
import WarpOverlay from './WarpOverlay';
import OrbitalStats from './OrbitalStats';
import ShipStats from './ShipStats';
import MainLoop from 'mainloop.js'

export default {

  data: function() {
    return {
      fps: 0
    }
  },

  components: {
    'warp-overlay': WarpOverlay,
    'orbital-stats': OrbitalStats,
    'ship-stats': ShipStats,
  },

  props: [
    'timeWarpIdx',
    'timeWarpValues',
    'elapsed',
    'focus',
  ],

  mounted: function() {
    setInterval(() => {
      this.fps = MainLoop.getFPS()
    }, 500);
  }
}
</script>

<style scoped>
.fps-overlay {
    flex: 0 1 auto;
    opacity: 0.8;
    color: white;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
}

.fps-overlay .label {
    padding-right: 5px;
    margin-bottom: 5px;
}
</style>
