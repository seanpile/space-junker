import * as THREE from 'three';
const OrbitControls = require('three-orbit-controls')(THREE);

const POINTS = 8;

function TestingRenderer(container) {

  this.width = window.innerWidth;
  this.height = window.innerHeight;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width, this.height);

  this.container = container;
  container.appendChild(this.renderer.domElement);

  this.scene = new THREE.Scene();
};

TestingRenderer.prototype.recenter = function () {};

TestingRenderer.prototype.viewDidLoad = function (solarSystem) {

  // initialize camera and scene
  this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.01, 1000)
  this.camera.position.z = 50;
  this.scene.background = new THREE.Color('gray');

  this.threeBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 'black'
    }));

  const curve = new THREE.EllipseCurve(
    0, 0, // ax, aY
    1, 1, // xRadius, yRadius
    0, 2 * Math.PI, // aStartAngle, aEndAngle
    false, // aClockwise
    0 // aRotation
  );

  const pointsGeometry = new THREE.Path(curve.getPoints(POINTS))
    .createPointsGeometry(POINTS);

  //Create the final object to add to the scene
  const bufferGeometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < pointsGeometry.vertices.length; i++) {
    vertices.push(
      pointsGeometry.vertices[i].x,
      pointsGeometry.vertices[i].y,
      pointsGeometry.vertices[i].z
    );
  }

  this.originalVertices = Array.from(vertices);
  bufferGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));

  const ellipse = new THREE.Line(
    bufferGeometry,
    new THREE.LineBasicMaterial({
      color: 0xff0000
    }));

  //
  // const ellipse = new THREE.Line(new THREE.RingGeometry(1, 1, 8),
  //   new THREE.LineBasicMaterial({
  //     color: 'red'
  //   }));

  this.ellipse = ellipse;
  this.ellipse.scale.set(10, 5, 1);
  // this.ellipse.matrix.setPosition(new THREE.Vector3(0, 0, 0));
  // this.ellipse.matrix.scale(new THREE.Vector3(10, 5, 1));
  // this.ellipse.matrixAutoUpdate = false;

  this.angle = 0;

  this.scene.add(this.threeBody);
  this.scene.add(this.ellipse);
  this.renderer.render(this.scene, this.camera);
  this.orbitControls = new OrbitControls(this.camera, this.scene.domElement);

  return Promise.resolve();
};

TestingRenderer.prototype.viewWillAppear = function () {};
TestingRenderer.prototype.viewWillDisappear = function () {};

TestingRenderer.prototype.render = function (solarSystem) {

  let threeBody = this.threeBody;
  threeBody.position.set(10 * Math.cos(this.angle), 5 * Math.sin(this.angle), 0);

  let scaledPosition = new THREE.Vector3()
    .copy(threeBody.position)
    .multiply(new THREE.Vector3(1 / 10, 1 / 5, 1));

  // let newVertices = [];
  // let angle = this.angle;
  // for (let i = 0; i < 9; i++) {
  //
  //   let vertex = new THREE.Vector3(10 * Math.cos(angle), 5 * Math.sin(angle), 0);
  //   newVertices.push(vertex);
  //   angle += 2 * Math.PI / 8;
  // }
  //
  //

  const geometry = this.ellipse.geometry;
  const positions = geometry.attributes.position.array;
  const range = Math.floor(positions.length / 3 / 2);
  const verticesToTest = [];

  for (let i = 0; i < range; i++) {
    const offset = (i * 2 + 1) * 3;
    verticesToTest.push(new THREE.Vector3(this.originalVertices[offset],
      this.originalVertices[offset + 1], this.originalVertices[offset + 2]));
  };

  const sorted = verticesToTest.map((vertex, idx) => [vertex.distanceTo(scaledPosition), vertex, idx])
    .sort((left, right) => {
      return left[0] - right[0];
    });

  sorted.forEach((element, idx) => {
    let vertex = element[1];
    let offset = (element[2] * 2 + 1) * 3;
    if (idx == 0) {
      positions[offset] = scaledPosition.x;
      positions[offset + 1] = scaledPosition.y
      positions[offset + 2] = scaledPosition.z;
    } else {
      positions[offset] = this.originalVertices[offset];
      positions[offset + 1] = this.originalVertices[offset + 1];
      positions[offset + 2] = this.originalVertices[offset + 2];
    }
  });

  geometry.attributes.position.needsUpdate = true;

  //this.ellipse.updateMatrix();
  //this.ellipse.geometry.setDrawRange(0, vertices.length)

  // const angle = Math.atan2(threeBody.position.y, threeBody.position.x) - Math.atan2(closest.y, closest.x);
  //this.ringBody.scale.set(10, 5, 1);
  //this.ringBody.rotation.set(0, 0, 0);
  //this.ringBody.rotateZ(angle);
  this.angle += Math.PI / 256;
  this.renderer.render(this.scene, this.camera);
};

export default TestingRenderer;
