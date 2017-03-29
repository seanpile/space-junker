
<template>
<div class="hud-overlay" id="warp-overlay">
  <div id="warp">
    <div id="warp-values">
      <div v-for="(item, i) in timeWarpValues" :class="{ 'warp-enabled': (i <= timeWarpIdx) }">
      </div>
    </div>
    <div id="warp-description">Warp</div>
  </div>
  <div id="time-section">
    <div id="time">{{missionClock}}</div>
    <div id="time-description">Mission Clock</div>
  </div>
</div>
</template>

<script>
const pad = (string, prefix, len) => {
  let padding = prefix;
  while (padding.length < len) {
    padding += padding;
  }
  return padding.substr(0, len - string.length) + string;
};

export default {

  props: [
    'timeWarpIdx',
    'timeWarpValues',
    'elapsed',
  ],

  computed: {
    missionClock: function() {

      const elapsed = this.elapsed;
      const years = elapsed.years();
      const months = elapsed.months();
      const days = elapsed.days() + (months * 30);
      const hours = elapsed.hours();
      const minutes = elapsed.minutes();
      const seconds = elapsed.seconds();

      const values = [];

      if (years > 0) {
        values.push(`${years}Y`);
      }

      if (days > 0) {
        values.push(`${days}d`);
      }

      values.push(pad(hours.toString(), '0', 2));
      values.push(pad(minutes.toString(), '0', 2));
      values.push(pad(seconds.toString(), '0', 2));

      return `+T ${values.join(':')}`;
    }
  }
}
</script>

<style scoped>
#warp {
    display: flex;
    flex-direction: row;
    margin-bottom: 3px;
    justify-content: space-between;
}

#warp-values {
    display: flex;
    flex-direction: row;
    flex: 0 1 auto;
}

#warp-description {
    flex: 0 1 auto;
    padding-left: 10px;
}

#time-section {
    flex: 0 1 auto;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

#time {
    flex: 0 1 auto;
}

#time-description {
    padding-left: 10px;
}

#warp-values div {
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 12.124px solid white;
    margin-right: 3px;
}

#warp-values div.warp-enabled {
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 12.124px solid green;
    margin-right: 3px;
}

.warp-disabled {}
</style>
