import './css/styles.css';
import CommonState from './app/CommonState';
import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import TestingRenderer from './app/TestingRenderer';
import Stats from 'stats.js';
import ResourceLoader from './app/ResourceLoader';

const solarSystem = new SolarSystem();

let mapViewContainer = document.getElementById('map-view');
let cameraViewContainer = document.getElementById('camera-view');
let testingViewContainer = document.getElementById('testing-view');

let stats = new Stats();
stats.dom.id = 'stats';
stats.dom.style = '';

document.body.appendChild(mapViewContainer);
document.body.appendChild(cameraViewContainer);
document.getElementById('stats-overlay')
  .appendChild(stats.dom);

const resourceLoader = new ResourceLoader();
const state = new CommonState();
const renderers = [
  new OrbitalMapRenderer(mapViewContainer, resourceLoader, state),
  new CameraViewRenderer(cameraViewContainer, resourceLoader, state),
];

const simulation = new Simulation(solarSystem, renderers, state, stats);
simulation.initialize()
  .then(() => {
    simulation.run()
  });
