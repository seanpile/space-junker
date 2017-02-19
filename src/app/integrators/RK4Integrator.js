import {
  Vector3
} from 'three';
import {
  FIXED_TYPE
} from '../Bodies';

import Integrator from 'ode45-cash-karp';

function RK4Integrator(bodies, attractors, t, dt, position_fn) {

  const state = [];
  const idxMap = {};
  bodies.forEach((body) => {
    /**
     * Setup the state vector for the integration step.
     */
    idxMap[body.name] = state.length;
    state.push(
      body.derived.position.x,
      body.derived.position.y,
      body.derived.position.z,
      body.derived.velocity.x,
      body.derived.velocity.y,
      body.derived.velocity.z);
  });

  this.bodies = bodies;
  this.attractors = attractors;
  this.idxMap = idxMap;
  this.integrator = new Integrator(state, function apply_step(dydt, y, t) {

    /**
     */
    bodies.forEach((body) => {
      const offset = idxMap[body.name];
      dydt[offset + 0] = y[offset + 3];
      dydt[offset + 1] = y[offset + 4];
      dydt[offset + 2] = y[offset + 5];
    });

    /**
     * Now calculate the acceleration experienced by each object, and set that as the
     * change in velocity
     */
    bodies.forEach((body, idx, array) => {

      /**
       * Calculate the sum of forces acting on this object (a = F / m = - GM / r^2)
       */
      const offset = idxMap[body.name];
      const position = new Vector3(
        y[offset + 0],
        y[offset + 1],
        y[offset + 2],
      );
      const acceleration = new Vector3();

      attractors.forEach((attractor) => {
        const attractorPosition = position_fn(attractor, t)
          .position;

        const r = new Vector3()
          .subVectors(position, attractorPosition);
        const distance = r.lengthSq();
        acceleration.add(r.normalize()
          .negate()
          .multiplyScalar(attractor.constants.u / distance));
      });

      dydt[offset + 3] = acceleration.x;
      dydt[offset + 4] = acceleration.y;
      dydt[offset + 5] = acceleration.z;
    });
  }, t, dt);
};

RK4Integrator.prototype.step = function () {
  this.integrator.step();
  this.bodies.forEach((body) => {
    if (body.type !== FIXED_TYPE) {
      const offset = this.idxMap[body.name];
      const position = new Vector3(
        this.integrator.y[offset + 0],
        this.integrator.y[offset + 1],
        this.integrator.y[offset + 2],
      );
      const velocity = new Vector3(
        this.integrator.y[offset + 3],
        this.integrator.y[offset + 4],
        this.integrator.y[offset + 5],
      );

      body.derived.position = position;
      body.derived.velocity = velocity;
    }
  });
};

export default RK4Integrator;
