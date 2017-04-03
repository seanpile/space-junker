<template>
<div class="hud-overlay">
  <h3 class="title">Orbital Statistics</h3>
  <div v-for="stat in stats" class="hud-overlay-entry">
    <div class="label">{{stat[0]}}</div>
    <div class="value" v-bind:style="stat.length >= 2 && stat[2]">{{stat[1]}}</div>
  </div>
</div>
</template>

<script>
import { AU, } from '../Constants';

export default {
  props: ['focus'],
  computed: {

    stats: function() {

      const focus = this.focus;
      const velocity = focus.velocity.length() * AU;
      const eccentricity = focus.orbit.e || 0;
      const semiMajorAxis = (focus.orbit.stats.semiMajorAxis * AU) / 1000;
      const semiMinorAxis = (focus.orbit.stats.semiMinorAxis * AU) / 1000;
      const orbitalPeriod = (focus.orbit.stats.orbitalPeriod || 0) / 86400;
      const rotationPeriod = focus.constants.rotation_period || 0;
      const axialTilt = focus.constants.axial_tilt || 0;

      let distance = 0;
      let periapsis = 0;
      let apoapsis = 0;
      if (focus.primary) {
        const r = focus.position.clone()
          .sub(focus.primary.position);
        distance = ((r.length() - focus.primary.constants.radius) * AU) /
          1000;
        periapsis = ((focus.orbit.stats.periapsis.clone()
          .sub(focus.primary.position)
          .length() -
          focus.primary.constants.radius) * AU) / 1000;

        if (focus.orbit.stats.apoapsis) {
          apoapsis = ((focus.orbit.stats.apoapsis.clone()
            .sub(focus.primary.position)
            .length() -
            focus.primary.constants.radius) * AU) / 1000;
        } else {
          apoapsis = NaN;
        }
      }

      const stats = [
      [
        'Name', focus.name, {'text-transform': 'capitalize'},
      ],
      [
        'Orbiting', focus.primary
            ?
        focus.primary.name
            :
        '', {'text-transform': 'capitalize'},
      ],
      [
        'Speed', `${velocity.toFixed(2)} m/s`,
      ],
      [
        'Orbit Distance', `${distance.toFixed(2)} km`,
      ],
      [
        'Periapsis', `${periapsis.toFixed(2)} km`,
      ],
      [
        'Apoapsis',
        `${isNaN(apoapsis) ? 'Undefined' : `${apoapsis.toFixed(2)} km`}`,
      ],
      [
        'Eccentricity', `${eccentricity.toFixed(4)}`,
      ],
      [
        'Semi-Major Axis', `${semiMajorAxis.toFixed(2)} km`,
      ],
      [
        'Semi-Minor Axis', `${semiMinorAxis.toFixed(2)} km`,
      ],
      ['Orbital Period',
        `${orbitalPeriod === Infinity ? `${orbitalPeriod}` : `${orbitalPeriod.toFixed(4)} days`}`
        ],
      ];

      if (focus.isPlanet()) {
        stats.push(['Rotation Period', `${rotationPeriod.toFixed(4)} days`]);
        stats.push(['Axial Tilt', `${axialTilt.toFixed(2)}°`]);
      }

      return stats
    }
  }
}
</script>


<style scoped>

</style>
