import './css/styles.css';
import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import Stats from 'stats.js';
import * as THREE from 'three';

const solarSystem = new SolarSystem();

let mapViewContainer = document.getElementById('map-view');
let cameraViewContainer = document.getElementById('camera-view');

let stats = new Stats();
stats.dom.id = 'stats';
stats.dom.style = '';

document.body.appendChild(mapViewContainer);
document.body.appendChild(cameraViewContainer);
document.body.appendChild(stats.dom);

const textureLoader = new THREE.TextureLoader();

const renderers = [
  new OrbitalMapRenderer(mapViewContainer, textureLoader),
  new CameraViewRenderer(cameraViewContainer, textureLoader),
];

const simulation = new Simulation(solarSystem, renderers, stats);
simulation.initialize()
  .then(() => {
    simulation.run()
  });

// Attach some useful pieces of data for debugging
window.solarSystem = solarSystem;
window.THREE = THREE;
