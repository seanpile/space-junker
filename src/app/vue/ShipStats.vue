<template>
<div v-if="isShip" class="hud-overlay">
  <h3 class="title">Ship</h3>
  <div v-for="stat in stats" class="hud-overlay-entry">
    <div class="label">{{stat[0]}}</div>
    <div class="value">{{stat[1]}}</div>
  </div>
</div>
</template>

<script>
import { AU, } from '../Constants';

export default {

  props: ['focus'],
  computed: {
    isShip: function() {
      return this.focus.isShip();
    },
    stats: function() {

      const focus = this.focus;
      if (!focus.isShip()) {
        return null;
      }

      const propellant = focus.stages[0].propellant;
      const maxThrust = focus.stages[0].thrust / 1000;
      const specificImpulse = focus.stages[0].isp;
      const thrustLevel = focus.motion.thrust;

      const stats = [
        ['Propellant', `${propellant.toFixed(2)} kg`],
        ['Thrust',
          `${(thrustLevel * maxThrust).toFixed(2)} / ${maxThrust.toFixed(2)} kN`
          ],
        ['Specific Impulse', `${specificImpulse} s`],
      ];

      return stats;
    }
  }
}
</script>

<style>

</style>
