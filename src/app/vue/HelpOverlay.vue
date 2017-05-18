<template>
<div id="help">
  <button class="help-button" v-on:click="toggleHelp">?</button>

  <div v-if="isDisplayed" id="help-overlay">
    <button class="close-button" v-on:click="toggleHelp">X</button>
    <h3 class="title">Help</h3>

    <div class="key-entry">
      <div class="keys">
        <div class="key">[</div>
        <div class="key">]</div>
      </div>
      <div class="description">Toggle between Planets</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">,</div>
        <div class="key">.</div>
      </div>
      <div class="description">Slow down / Speed up</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">c</div>
      </div>
      <div class="description">Reset the camera</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">h</div>
      </div>
      <div class="description">Toggle Hud</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">m</div>
      </div>
      <div class="description">Toggle View</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">space</div>
      </div>
      <div class="description">Pause</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">-</div>
        <div class="key">=</div>
      </div>
      <div class="description">Decrease / Increase Thrust</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">w</div>
        <div class="key">s</div>
      </div>
      <div class="description">Pitch Up / Down</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">a</div>
        <div class="key">d</div>
      </div>
      <div class="description">Yaw Left / Right</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">q</div>
        <div class="key">e</div>
      </div>
      <div class="description">Roll Left / Right</div>
    </div>
    <div class="key-entry">
      <div class="keys">
        <div class="key">t</div>
      </div>
      <div class="description">Toggle Stability Assist</div>
    </div>
  </div>

</div>
</template>

<script>
export default {
  data: function() {
    return {
      isDisplayed: false,
    }
  },
  methods: {
    toggleHelp: function(event) {
      this.isDisplayed = !this.isDisplayed;
    }
  }
}
</script>

<style scoped>
.help-button {
    position: absolute;
    right: 10px;
    top: 10px;
    -webkit-border-radius: 60;
    -moz-border-radius: 60;
    border-radius: 60px;
    border-style: double;
    opacity: 0.8;
    font-family: Arial;
    color: #ffffff;
    font-size: 30px;
    background: #3498db;
    padding: 8px 15px 8px 15px;
    text-decoration: none;
    outline: none;
}

#help-overlay {
    position: absolute;
    width: 30%;
    top: 25%;
    left: 35%;
    display: flex;
    flex-direction: column;
    background-color: lightgray;
    opacity: 0.9;
    padding-top: 5px;
    padding-bottom: 5px;
    padding-left: 10px;
    padding-right: 10px;
}

#help-overlay .close-button {
    position: absolute;
    top: 5px;
    right: 5px;
    padding-left: 3px;
    padding-right: 3px;
    padding-top: 5px;
    padding-bottom: 5px;
    border-radius: 5px;
    border-style: double;
    outline: none;
}

#help-overlay .title {
    flex: 1 1 auto;
    text-align: center;
}

.key-entry {
    flex: 0 1 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

.key-entry .keys {
    flex: 0 1 auto;
    display: flex;
    flex-direction: row;
}

.keys .key {
    flex: 0 1 auto;
    margin-top: 2px;
    margin-bottom: 2px;
    border: black;
    border-width: 3px;
    border-style: outset;
    border-color: lightgrey;
    background-color: white;
    padding-right: 3px;
    padding-left: 3px;
    font-size: x-large;
}

.keys .key+.key {
    margin-left: 5px;
}

.key-entry .description {
    flex: 0 1 auto;
    padding-left: 5px;
}
</style>
