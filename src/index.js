import React from 'react';
import ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import SpaceJunker from './app/view/SpaceJunker';
import './css/styles.css';

const render = (Component) => {
  ReactDOM.render(
    <AppContainer>
      <Component />
    </AppContainer>,
    document.getElementsByTagName('main')[0]);
};

render(SpaceJunker);

/* Hot Module Support */
if (module.hot) {
  module.hot.accept('./app/view/SpaceJunker', () => {
    render(SpaceJunker);
  });
}
