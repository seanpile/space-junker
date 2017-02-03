import {
  Vector3
} from 'three';

export default function Body(id, u, primary, position, velocity) {
  this.id = id;
  this.u = u;
  this.primary = primary;

  if (!position) {
    position = new Vector3(0, 0, 0);
  }

  if (!velocity) {
    velocity = new Vector3(0, 0, 0);
  }

  this.position = position;
  this.velocity = velocity;
}
