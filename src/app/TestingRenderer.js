import BaseRenderer from './BaseRenderer';
import {
  AU
} from './Bodies';
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
  this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.5, AU * 100);
  this.camera.position.z = 10;
  this.camera.lookAt(new THREE.Vector3());

  this.scene.background = new THREE.Color('gray');

  const size = 1;

  const object1 = new THREE.Mesh(
    new THREE.SphereBufferGeometry(size, 32),
    new THREE.MeshBasicMaterial({
      color: 'white',
    }));

  const object2 = new THREE.Mesh(
    new THREE.SphereBufferGeometry(size, 32),
    new THREE.MeshBasicMaterial({
      color: 'red',
    }));

  object1.name = 'object1';
  object2.name = 'object2';
  object2.position.set(0, 5, 0);

  this.scene.add(object1);
  this.scene.add(object2);

  this.mouse = null;

  this.addEventListener('click', (event) => {
    this.mouse = event.location.clone();
  });

  return Promise.resolve();
};

TestingRenderer.prototype.viewWillAppear = function () {};
TestingRenderer.prototype.viewWillDisappear = function () {};

TestingRenderer.prototype.render = function (solarSystem) {

  this.camera.position.set(0, 0, 100);
  this.camera.lookAt(this.scene.position);
  this.camera.updateMatrixWorld();
  this.camera.updateProjectionMatrix();

  if (this.mouse) {

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this.mouse, this.camera);
    raycaster.params.Points.threshold = 5;

    let target = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
    target.unproject(this.camera);

    console.log(target);

    target.sub(this.camera.position);
    target.normalize();
    console.log(target);

    raycaster = new THREE.Raycaster(this.camera.position.clone(),
      target
    );

    this.arrowHelper && this.scene.remove(this.arrowHelper);
    this.arrowHelper = new THREE.ArrowHelper(raycaster.ray.direction.clone()
      .normalize(), raycaster.ray.origin.clone(), 1);
    this.scene.add(this.arrowHelper);

    let intersection = raycaster.intersectObjects(this.scene.children, false);
    if (intersection.length > 0) {
      console.log(intersection[0].object.name);
    }

    this.mouse = null;
  }

  this.renderer.render(this.scene, this.camera);
};

Object.assign(TestingRenderer.prototype, BaseRenderer.prototype);

export default TestingRenderer;
