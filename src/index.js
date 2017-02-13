import './css/styles.css';
import CommonState from './app/CommonState';
import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import TestingRenderer from './app/TestingRenderer';
import Stats from 'stats.js';
import * as THREE from 'three';

const solarSystem = new SolarSystem();

let mapViewContainer = document.getElementById('map-view');
let cameraViewContainer = document.getElementById('camera-view');
let testingViewContainer = document.getElementById('testing-view');

let stats = new Stats();
stats.dom.id = 'stats';
stats.dom.style = '';

document.body.appendChild(mapViewContainer);
document.body.appendChild(cameraViewContainer);
document.getElementById('stats-overlay').appendChild(stats.dom);

const textureLoader = new THREE.TextureLoader();

const state = new CommonState();
const renderers = [
  new OrbitalMapRenderer(mapViewContainer, textureLoader, state),
  new CameraViewRenderer(cameraViewContainer, textureLoader, state),
];

const simulation = new Simulation(solarSystem, renderers, state, stats);
simulation.initialize()
  .then(() => {
    simulation.run()
  });
