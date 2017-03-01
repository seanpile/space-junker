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

  const borderShape = new THREE.Shape();
  borderShape.moveTo(-10, 10);
  borderShape.lineTo(10, 10);
  borderShape.lineTo(10, -10);
  borderShape.lineTo(-10, -10);
  borderShape.lineTo(-10, 10);

  const border = new THREE.Mesh(
    //new THREE.TorusGeometry(0.425, 0.04, 80, 60),
    new THREE.ExtrudeGeometry(borderShape, {
      amount: 16,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 4,
      bevelSize: 2,
      bevelThickness: 2
    }),
    new THREE.MeshBasicMaterial({
      color: 'white',
      depthFunc: THREE.AlwaysDepth,
    }));

  border.scale.set(0.5, 0.5, 0.5);

  this.threeBody = border;
  this.scene.add(this.threeBody);

  return Promise.resolve();
};

TestingRenderer.prototype.viewWillAppear = function () {};
TestingRenderer.prototype.viewWillDisappear = function () {};

TestingRenderer.prototype.render = function (solarSystem) {
  this.renderer.render(this.scene, this.camera);
};

export default TestingRenderer;
