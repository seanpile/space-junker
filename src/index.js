import SolarSystem from './app/SolarSystem';
import Simulation from './app/Simulation';
import ThreeRenderer from './app/ThreeRenderer';
import Stats from 'stats.js';

// Main container that will house the main content
let container = document.createElement('div');
document.body.appendChild(container);

// FPS / Memory stats
let stats = new Stats();
document.body.appendChild(stats.dom);

const solarSystem = new SolarSystem();
const renderer = new ThreeRenderer(container);
const simulation = new Simulation(solarSystem, renderer, stats);
simulation.initialize();
simulation.run();
