import {
  Vector3
} from 'three';

export default function RungeKuttaIntegrator() {}

function Derivitives() {
  this.dx = new Vector3(0, 0, 0);
  this.dv = new Vector3(0, 0, 0);
};

RungeKuttaIntegrator.prototype._acceleration =
  function (primary, state, t) {

    // Simplified two-body problem; only force that can influence this body
    // is from its 'primary' body .

    const r = state.position.clone()
      .sub(primary.position);
    const distance = state.position.distanceToSquared(primary.position);
    return r.negate()
      .multiplyScalar(primary.u / distance);

  };

RungeKuttaIntegrator.prototype._evaluate =
  function (body, t, dt, derivitive) {

    const state = {
      position: body.position.clone(),
      velocity: body.velocity.clone()
    };

    state.position.add(derivitive.dx.clone()
      .multiplyScalar(dt));
    state.velocity.add(derivitive.dv.clone()
      .multiplyScalar(dt));

    const output = new Derivitives();
    output.dx = state.velocity.clone();
    output.dv = this._acceleration(body.primary, state, t + dt);
    return output;
  };

RungeKuttaIntegrator.prototype.integrate =
  function (bodies, t, dt) {
    bodies.forEach((body) => {

      if (body.id === 'sun')
        return;

      let a, b, c, d;

      a = this._evaluate(body, t, 0.0, new Derivitives());
      b = this._evaluate(body, t, dt * 0.5, a);
      c = this._evaluate(body, t, dt * 0.5, b);
      d = this._evaluate(body, t, dt, c);

      let dxdt = b.dx.add(c.dx)
        .multiplyScalar(2.0)
        .add(a.dx)
        .add(d.dx)
        .multiplyScalar(1.0 / 6.0);
      let dvdt = b.dv.add(c.dv)
        .multiplyScalar(2.0)
        .add(a.dv)
        .add(d.dv)
        .multiplyScalar(1.0 / 6.0);

      body.position.add(dxdt.multiplyScalar(dt));
      body.velocity.add(dvdt.multiplyScalar(dt));
    });
  };
