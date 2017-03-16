import 'babel-polyfill';
import Stats from 'stats.js';
import './css/styles.css';
import CommonState from './app/CommonState';
import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import ResourceLoader from './app/ResourceLoader';

const solarSystem = new SolarSystem();

const mapViewContainer = document.getElementById('map-view');
const cameraViewContainer = document.getElementById('camera-view');
// const testingViewContainer = document.getElementById('testing-view');

const stats = new Stats();
stats.dom.id = 'stats';
stats.dom.style = '';
document.getElementById('stats-overlay').appendChild(stats.dom);

const defaultFocus = 'apollo 11';
const state = new CommonState(defaultFocus);

const resourceLoader = new ResourceLoader();
const renderers = [
  new OrbitalMapRenderer(mapViewContainer, resourceLoader, state),
  new CameraViewRenderer(cameraViewContainer, resourceLoader, state),
];

const simulation = new Simulation(solarSystem, renderers, state, stats);
simulation.initialize().then(() => {
  simulation.run();
});
