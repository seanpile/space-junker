import Vue from 'vue';
import SpaceJunker from './app/vue/SpaceJunker';
import ResourceLoader from './app/renderers/ResourceLoader';

let app;
const loader = new ResourceLoader();
const render = (Component) => {
  app = new Vue({
    el: '#app',
    data() {
      return {
        loader,
      };
    },
    components: {
      'space-junker': Component,
    },
  });
};

render(SpaceJunker);

/* Hot Module Support */
if (module.hot) {
  module.hot.accept('./app/vue/SpaceJunker', () => {
    app.$destroy();
    render(SpaceJunker);
  });
}
