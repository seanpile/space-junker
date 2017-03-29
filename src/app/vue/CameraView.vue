<template>
<div id="camera-view" v-canvas="renderer">
</div>
</template>

<script>
export default {

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
  },

  destroyed: function() {
    this.renderer.viewWillDisappear();
  }

}
</script>

<style scoped>
</style>
