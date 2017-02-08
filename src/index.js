import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import Stats from 'stats.js';
import * as THREE from 'three';

const solarSystem = new SolarSystem();

let mapViewContainer = document.createElement('div');
mapViewContainer.id = 'map-view';

let cameraViewContainer = document.createElement('div');
cameraViewContainer.id = 'camera-view';
cameraViewContainer.style = 'display: none;';

document.body.appendChild(mapViewContainer);
document.body.appendChild(cameraViewContainer);

let meta = document.createElement('div');
meta.id = 'meta';
document.body.appendChild(meta);

const renderers = [
  new OrbitalMapRenderer(mapViewContainer),
  new CameraViewRenderer(cameraViewContainer)
];

const simulation = new Simulation(solarSystem, renderers, new Stats());
simulation.run();

// Attach some useful pieces of data for debugging
window.solarSystem = solarSystem;
window.THREE = THREE;
window.camera = renderers[0].camera;
window.planetMap = renderers[0].planetMap;
