import * as THREE from 'three';
import BaseRenderer from './BaseRenderer';

export default function TestingRenderer(solarSystem, resourceLoader, commonState) {
  BaseRenderer.call(this, solarSystem, resourceLoader, commonState);

  const width = window.innerWidth;
  const height = window.innerHeight;

  this.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(width, height);

  this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
  this.camera.up = new THREE.Vector3(0, 0, 1);
  this.camera.position.set(0, 0, 25);

  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color('gray');
}

Object.assign(TestingRenderer.prototype, BaseRenderer.prototype);

TestingRenderer.prototype.viewDidLoad = function () {
  return Promise.resolve();
};

TestingRenderer.prototype.viewWillAppear = function () {
};

TestingRenderer.prototype.viewWillDisappear = function () {
};

TestingRenderer.prototype.render = function () {
  this.renderer.render(this.scene, this.camera);
  return this.renderer.domElement;
};
