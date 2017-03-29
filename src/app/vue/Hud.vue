
<template>
<div id="hud">
  <warp-overlay :timeWarpIdx="timeWarpIdx" :timeWarpValues="timeWarpValues" :elapsed="elapsed"></warp-overlay>

  <orbital-stats :focus="focus"></orbital-stats>

  <ship-stats :focus="focus"></ship-stats>

  <div class="hud-overlay" id="stats-overlay" v-canvas="stats">
  </div>

</div>
</template>

<script>
import WarpOverlay from './WarpOverlay';
import OrbitalStats from './OrbitalStats';
import ShipStats from './ShipStats';

export default {

  directives: {
    canvas: {
      bind: function(el, binding) {
        const stats = binding.value;
        stats.dom.id = 'stats';
        stats.dom.style.cssText = '';
        el.appendChild(stats.dom);
      }
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
    'stats',
  ]
}
</script>

<style scoped>
#stats-overlay {
    flex: 0 1 auto;
    border-radius: 0;
    border-style: none;
    background-color: inherit;
    opacity: 1.0;
}
</style>
