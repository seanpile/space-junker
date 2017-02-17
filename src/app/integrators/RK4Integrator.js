import {
  Vector3
} from 'three';
import ODERK4Integrator from 'ode-rk4';
import ODECashKarpIntegrator from 'ode45-cash-karp';
const Integrator = ODERK4Integrator;

function RK4Integrator(bodies, attractors, t, dt, position_fn) {

  const state = [];
  bodies.forEach((body) => {
    /**
     * Setup the state vector for the integration step.
     */
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
  this.position_fn = position_fn;
  this.initialTime = t;
  this.integrator = new Integrator(state, function applyStep(dydt, y, t) {
    this._apply(dydt, y, t);
  }.bind(this), t, dt);
};

RK4Integrator.prototype.step = function () {
  this.integrator.step();
  this.bodies.forEach((body, idx) => {
    const offset = idx * 6;
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
  });
};

RK4Integrator.prototype._apply = function (dydt, y, t) {

  // Set change in position = velocity
  this.bodies.forEach((body, idx, array) => {
    const offset = idx * 6;
    dydt[offset + 0] = y[offset + 3];
    dydt[offset + 1] = y[offset + 4];
    dydt[offset + 2] = y[offset + 5];

    if (body.primary && body.primary.name !== 'sun') {
      /**
       * For every body, add its primary's change in position to account
       * for rotating around a body that is also rotating around another
       * body.
       */
      const primaryInitial = this.position_fn(body.primary, t - this.initialTime);
      const primaryStep = this.position_fn(body.primary, t);
      let diff;
      if (t === this.initialTime) {
        diff = primaryStep.sub(primaryInitial)
          .divideScalar(t - this.initialTime);
      } else {
        diff = new Vector3(0, 0, 0);
      }

      // Include the change in position of the primary
      dydt[offset + 0] += diff.x;
      dydt[offset + 1] += diff.y;
      dydt[offset + 2] += diff.z;
    }
  });

  this.bodies.forEach((body, idx, array) => {

    /**
     * Calculate the sum of forces acting on this object (a = F / m = - GM / r^2)
     */
    const offset = idx * 6;
    const position = new Vector3(
      y[offset + 0],
      y[offset + 1],
      y[offset + 2],
    );
    const acceleration = new Vector3();

    this.attractors.forEach((attractor, aIdx) => {

      const attractor_position = this.position_fn(attractor, t);
      const r = new Vector3()
        .subVectors(position, attractor_position);
      const distance = r.lengthSq();
      acceleration.add(r.normalize()
        .negate()
        .multiplyScalar(attractor.constants.u / distance));
    });

    dydt[offset + 3] = acceleration.x;
    dydt[offset + 4] = acceleration.y;
    dydt[offset + 5] = acceleration.z;
  });
}

export default RK4Integrator;
