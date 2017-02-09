import './css/styles.css';
import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import TestingRenderer from './app/TestingRenderer';
import Stats from 'stats.js';
import * as THREE from 'three';

const solarSystem = new SolarSystem();

let mapViewContainer = document.createElement('div');
mapViewContainer.id = 'map-view';
mapViewContainer.style = 'display: none;';

let cameraViewContainer = document.createElement('div');
cameraViewContainer.id = 'camera-view';
cameraViewContainer.style = 'display: none;';

let testingViewContainer = document.createElement('div');
cameraViewContainer.id = 'testing-view';
cameraViewContainer.style = 'display: none;';

document.body.appendChild(mapViewContainer);
document.body.appendChild(cameraViewContainer);
document.body.appendChild(testingViewContainer);

let meta = document.createElement('div');
meta.id = 'meta';
document.body.appendChild(meta);

const renderers = [
  new OrbitalMapRenderer(mapViewContainer),
  new CameraViewRenderer(cameraViewContainer),
  //new TestingRenderer(testingViewContainer)
];

const simulation = new Simulation(solarSystem, renderers, new Stats());
simulation.initialize()
  .then(() => {
    simulation.run()
  });

// Attach some useful pieces of data for debugging
window.solarSystem = solarSystem;
window.THREE = THREE;
