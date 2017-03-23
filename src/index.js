import React from 'react';
import ReactDOM from 'react-dom';
import AsyncComponent from './AsyncComponent';
import LoadingView from './app/view/LoadingView';
import './css/styles.css';

ReactDOM.render(
  React.createElement(AsyncComponent, {
    loader: () => import('./app/view/SpaceJunker'),
    Placeholder: React.createElement(LoadingView),
  }),
  document.getElementsByTagName('main')[0]);
