<template>
<div id="map-view" v-canvas="renderer">

  <div id="map-mouse-overlay" v-if="this.mouseOverTarget" v-bind:style="{
      bottom: `${this.mouseOverTarget.bottom}px`,
      left: `${this.mouseOverTarget.left}px`,
    }">
    <h5 class="body-name">{{this.mouseOverTarget.name}}</h5>
</div>
</div>
</template>

<script>
export default {

  data: function() {
    return {
      mouseOverTarget: null,
    }
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
  },

  destroyed: function() {
    this.renderer.viewWillDisappear();
  }

}
</script>

<style scoped>
#map-mouse-overlay {
    position: absolute;
    display: flex;
    background-color: lightgray;
    margin-bottom: 10px;
    border-radius: 10px;
    border-style: ridge;
    padding-top: 5px;
    padding-bottom: 5px;
    padding-left: 10px;
    padding-right: 10px;
    opacity: 0.8;
}

#map-mouse-overlay .body-name {
    text-transform: capitalize;
}
</style>
