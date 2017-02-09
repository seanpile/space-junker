import * as THREE from 'three';

// Textures
import moonmap from '../img/moonmap4k.jpg';

function TestingRenderer(container, backgroundImage) {

  this.width = 1024;
  this.height = 680;
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width, this.height);

  this.container = container;
  container.appendChild(this.renderer.domElement);

  this.scene = new THREE.Scene();
  this.scene.add(new THREE.AmbientLight(0x333333));

  let light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 3, 5);
  this.scene.add(light);
};

TestingRenderer.prototype.recenter = function () {};

TestingRenderer.prototype.viewDidLoad = function (solarSystem) {

  // initialize camera and scene
  this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.01, 1000)
  this.camera.position.z = 1.5;
  this.scene.background = new THREE.Color('gray');

  return new Promise((resolve, reject) => {

    let material = new THREE.MeshPhongMaterial();
    let geometry = new THREE.SphereGeometry(0.5, 32, 32);
    let threeBody = new THREE.Mesh(geometry, material);

    var loader = new THREE.TextureLoader();
    loader.load(moonmap,
      (texture) => {
        console.log('Loaded the moon texture');
        material.map = texture;
        this.scene.add(threeBody);
        resolve();
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
        resolve();
      },
      (xhr) => {
        console.log("An error happened loading...");
        resolve();
      });
  });

};

TestingRenderer.prototype.viewWillAppear = function () {};
TestingRenderer.prototype.viewWillDisappear = function () {};

TestingRenderer.prototype.render = function (solarSystem) {
  this.renderer.render(this.scene, this.camera);
};

export default TestingRenderer;
