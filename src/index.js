import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import CameraViewRenderer from './app/CameraViewRenderer';
import OrbitalMapRenderer from './app/OrbitalMapRenderer';
import Stats from 'stats.js';

// Main container that will house the main content
let container = document.createElement('div');
document.body.appendChild(container);

// FPS / Memory stats
let stats = new Stats();
document.body.appendChild(stats.dom);

const solarSystem = new SolarSystem();
const renderer = new OrbitalMapRenderer(container);
const simulation = new Simulation(solarSystem, renderer, stats);
simulation.run();
