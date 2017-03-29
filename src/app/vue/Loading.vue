<template>
<div>
  Loading on warp speed... this may take a moment</div>
</template>

<script>
import { Splash } from 'splash-screen';
import 'splash/splash.min.css';

export default {

  mounted: function() {
    Splash.enable('spinner-section-far');
  },

  destroyed: function() {
    Splash.destroy();
  }
}
</script>

<style scoped>
div {
    position: absolute;
    color: white;
    top: 40%;
    left: 0;
    width: 100%;
    text-align: center;
    filter: none;
}
</style>
