import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import SpaceJunker from './app/view/SpaceJunker';
import './css/styles.css';

ReactDOM.render(
  React.createElement(SpaceJunker),
  document.getElementsByTagName('main')[0]);
