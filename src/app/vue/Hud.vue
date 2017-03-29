
<template>
<div id="hud">
  <warp-overlay :timeWarpIdx="timeWarpIdx" :timeWarpValues="timeWarpValues" :elapsed="elapsed"></warp-overlay>
</div>
</template>

<script>
import WarpOverlay from './WarpOverlay';

export default {

  components: {
    'warp-overlay': WarpOverlay
  },

  props: [
    'timeWarpIdx',
    'timeWarpValues',
    'elapsed',
  ]
}
</script>

<style>

</style>
