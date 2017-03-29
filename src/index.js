import Vue from 'vue';
import SpaceJunker from './app/vue/SpaceJunker';

const render = (Component) => {
  const app = new Vue({
    el: '#app',
    components: {
      'space-junker': Component,
    },
  });
};

render(SpaceJunker);

/* Hot Module Support */
if (module.hot) {
  module.hot.accept('./app/vue/SpaceJunker', () => {
    render(SpaceJunker);
  });
}
