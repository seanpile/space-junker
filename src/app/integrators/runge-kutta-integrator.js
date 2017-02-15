import {
  Vector3
} from 'three';

export default function RungeKuttaIntegrator() {}

function Derivitives() {
  this.dx = new Vector3(0, 0, 0);
  this.dv = new Vector3(0, 0, 0);
};

RungeKuttaIntegrator.prototype._acceleration =
  function (position, attractor, state, t) {

    const r = new Vector3()
      .subVectors(position, attractor.derived.position);
    const distanceSq = r.lengthSq();

    return r.normalize()
      .negate()
      .multiplyScalar(attractor.constants.u / distanceSq);
  };

RungeKuttaIntegrator.prototype._evaluate =
  function (position, velocity, attractor, t, dt, derivitive) {

    let newPosition = new Vector3(
      position.x + derivitive.dx.x * dt,
      position.y + derivitive.dx.y * dt,
      position.z + derivitive.dx.z * dt
    );
    let newVelocity = new Vector3(
      velocity.x + derivitive.dv.x * dt,
      velocity.y + derivitive.dv.y * dt,
      velocity.z + derivitive.dv.z * dt
    );

    const output = new Derivitives();
    output.dx = newVelocity;
    output.dv = this._acceleration(newPosition, attractor, t + dt);
    return output;
  };

RungeKuttaIntegrator.prototype.integrate =
  function (position, velocity, attractor, t, dt) {

    if (!attractor) {
      return;
    }

    let a, b, c, d;

    a = this._evaluate(position, velocity, attractor, t, 0.0, new Derivitives());
    b = this._evaluate(position, velocity, attractor, t, dt * 0.5, a);
    c = this._evaluate(position, velocity, attractor, t, dt * 0.5, b);
    d = this._evaluate(position, velocity, attractor, t, dt, c);

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

    position.add(dxdt.multiplyScalar(dt));
    velocity.add(dvdt.multiplyScalar(dt));
  };
