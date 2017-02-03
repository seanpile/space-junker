import moment from 'moment';
import Body from './Body';
import RungeKuttaIntegrator from './integrators/runge-kutta-integrator';
import {
  Vector3
} from 'three';

// Scale all distance units by the AU to reduce magnitude of numbers
const AU = 149.6e9;
const SUN_GM = 1.32712438e20 / Math.pow(AU, 3);
const EARTH_GM = 3.986005e14 / Math.pow(AU, 3);

export default function SolarSystem() {
  const sun = new Body('sun', SUN_GM);
  const earth = new Body('earth', EARTH_GM, sun,
    // Position
    new Vector3(0, 1, 0),
    // Velocity (circular orbit)
    new Vector3(-Math.sqrt(SUN_GM / 1), 0, 0));


  this.bodies = [sun, earth];
  this.integrator = new RungeKuttaIntegrator();
}

SolarSystem.prototype.update = function (t, dt) {
  this.integrator.integrate(this.bodies, t, dt);
};
