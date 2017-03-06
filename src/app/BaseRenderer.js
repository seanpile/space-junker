import * as THREE from 'three';
import {
  AU
} from './Bodies';

// Textures
const TEXTURES = {
  'moon': require('../img/moonmap.jpg'),
  'earth': require('../img/earthmap.jpg'),
  'earthspec': require('../img/earthspec.jpg'),
  'earthbump': require('../img/earthbump.jpg'),
  'jupiter': require('../img/jupitermap.jpg'),
  'saturn': require('../img/saturnmap.jpg'),
  'mercury': require('../img/mercurymap.jpg'),
  'venus': require('../img/venusmap.jpg'),
  'mars': require('../img/marsmap.jpg'),
  'pluto': require('../img/plutomap.jpg'),
  'neptune': require('../img/neptunemap.jpg'),
  'uranus': require('../img/uranusmap.jpg'),
  'lensflare': require('../img/lensflare.png'),
  'rock1': require('../models/rock1/ArmGra05.jpg'),
  'apollo': require('../models/apollo/OldGlory.jpg'),
  'navball': require('../img/navball.png'),
};

const MODELS = {
  'rock1': require('../models/rock1.dae'),
  'apollo': require('../models/apollo.dae'),
}

export default function BaseRenderer(resourceLoader, state) {
  this.resourceLoader = resourceLoader;
  this.state = state;
};

// Allow renderers to act on changes to the user interface
Object.assign(BaseRenderer.prototype, THREE.EventDispatcher.prototype);

/**
 *
 */
BaseRenderer.prototype._onWindowResize = function (cameras, originalHeight, originalFov) {
  const tanFOV = Math.tan(((Math.PI / 180) * originalFov / 2));
  return (event) => {

    cameras.forEach((camera) => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / originalHeight));

      camera.updateProjectionMatrix();
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
};

BaseRenderer.prototype._loadTextures = function () {
  const all_keys = Object.keys(TEXTURES);

  return Promise.all(all_keys
      .map((key) => this.resourceLoader.loadTexture(TEXTURES[key]))
    )
    .then(values => {
      return Promise.resolve(new Map(values.map(([url, texture], idx) => [all_keys[idx], texture])));
    });
};

BaseRenderer.prototype._loadModels = function () {
  const all_keys = Object.keys(MODELS);

  return Promise.all(all_keys
      .map((key) => this.resourceLoader.loadModel(MODELS[key]))
    )
    .then(values => {
      return Promise.resolve(new Map(values.map(([url, model], idx) => [all_keys[idx], model])));
    });
};

BaseRenderer.prototype._setupLightSources = function () {
  const ambientLight = new THREE.AmbientLight(0x202020);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.up = new THREE.Vector3(0, 0, 1);

  this.scene.add(ambientLight);
  this.scene.add(directionalLight);

  return directionalLight;
};

BaseRenderer.prototype._createSkyBox = function () {

  //This will add a starfield to the background of a scene
  const stars = [{
      color: 'blue',
      number: 500,
    },
    {
      color: 'red',
      number: 500,
    },
    {
      color: 0x888888,
      number: 10000,
    },
    {
      color: 0xdddddd,
      number: 10000
    }
  ]

  const skyBox = new THREE.Group();

  stars.forEach(({
    color,
    number
  }) => {

    const vertices = [];
    for (let i = 0; i < number; i++) {

      let r;

      // Generate stars that are a minimum distance away
      do {
        r = new THREE.Vector3(
          THREE.Math.randFloatSpread(3000),
          THREE.Math.randFloatSpread(3000),
          THREE.Math.randFloatSpread(3000))
      } while (r.lengthSq() < 500)

      vertices.push(r.x, r.y, r.z);
    }

    let starsGeometry = new THREE.BufferGeometry();
    starsGeometry.addAttribute('position',
      new THREE.BufferAttribute(Float32Array.from(vertices), 3));

    let starsMaterial = new THREE.PointsMaterial({
      color: color,
      size: Math.random() * 0.8 + 0.2,
      depthWrite: false,
    });

    let field = new THREE.Points(starsGeometry, starsMaterial);
    field.matrixAutoUpdate = false;
    skyBox.add(field);
  });

  skyBox.matrixAutoUpdate = false;
  return skyBox;
};

/**
 * Recenter the coordinate system on the focus being the 'center'.
 */
BaseRenderer.prototype._adjustCoordinates = function (focus, position) {

  if (!focus)
    return position.clone();

  let coordinates = position.clone()
    .sub(focus.derived.position);

  return coordinates;
};

BaseRenderer.prototype._loadPlanet = function (body, textures) {

  let material;
  if (body.name === 'sun') {
    material = new THREE.MeshBasicMaterial({
      color: 'yellow'
    });
  } else {
    material = new THREE.MeshPhongMaterial();
    if (textures.has(body.name + 'bump')) {
      material.bumpMap = textures.get(body.name + 'bump');
      material.bumpScale = 100000 / AU;
    }

    if (textures.has(body.name + 'spec')) {
      material.specularMap = textures.get(body.name + 'spec');
      material.specular = new THREE.Color('grey');
    }

    if (textures.has(body.name)) {
      // Reduce harsh glare effect of the light source (default 30 -> 1);
      material.map = textures.get(body.name);
      material.shininess = 1;
    }
  }

  const threeBody = new THREE.Mesh(
    new THREE.SphereGeometry(body.constants.radius, 128, 128),
    material);

  threeBody.receiveShadow = true;
  threeBody.castShadow = true;

  return threeBody;
};

BaseRenderer.prototype._applyPlanetaryRotation = function (planet, body) {

  const derived = body.derived;

  planet.rotation.set(0, 0, 0);
  planet.rotateZ(derived.omega);
  planet.rotateX(derived.I);
  planet.rotateZ(derived.argumentPerihelion);
  planet.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  planet.rotateOnAxis(new THREE.Vector3(1, 0, 0), -(body.constants.axial_tilt || 0) * Math.PI / 180);
  planet.rotateY(derived.rotation);
};

BaseRenderer.prototype.loadNavball = function (textures) {

  const lightSource = new THREE.DirectionalLight(0xffffff, 1);

  this.navballScene = new THREE.Scene();
  this.navballCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

  const navball = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 128, 128),
    new THREE.MeshPhongMaterial({
      map: textures.get('navball'),
      shininess: 1
    }));

  const border = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.05, 80, 60),
    new THREE.MeshPhongMaterial({
      color: 'gray',
      depthFunc: THREE.AlwaysDepth,
      shininess: 10
    }));

  const prograde = (() => {

    let shapes = [
      // Circle
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        let innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
        let lineShape = new THREE.Shape();
        lineShape.moveTo(-1, 8);
        lineShape.lineTo(-1, 13);
        lineShape.lineTo(1, 13);
        lineShape.lineTo(1, 8);
        return lineShape;
      })(),
      (() => {
        let lineShape = new THREE.Shape();
        lineShape.moveTo(8, 1);
        lineShape.lineTo(13, 1);
        lineShape.lineTo(13, -1);
        lineShape.lineTo(8, -1);
        return lineShape;
      })(),
      (() => {
        let lineShape = new THREE.Shape();
        lineShape.moveTo(-8, 1);
        lineShape.lineTo(-13, 1);
        lineShape.lineTo(-13, -1);
        lineShape.lineTo(-8, -1);
        return lineShape;
      })(),
      (() => {
        let dotShape = new THREE.Shape();
        dotShape.absarc(0, 0, 1, 0, 2 * Math.PI);
        return dotShape;
      })(),
    ];

    return new THREE.Mesh(
      new THREE.ShapeGeometry(shapes, 64),
      new THREE.MeshBasicMaterial({
        color: 'yellow',
      })
    );

  })();

  const retrograde = (() => {

    let shapes = [
      // Circle
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        let innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
        // Up line
        let lineShape = new THREE.Shape();
        lineShape.moveTo(-1, 8);
        lineShape.lineTo(-1, 13);
        lineShape.lineTo(1, 13);
        lineShape.lineTo(1, 8);
        return lineShape;
      })(),
      (() => {
        // Cross X
        let lineShape = new THREE.Shape();
        let e = 3 / 180 * Math.PI;
        lineShape.moveTo(7 * Math.cos(Math.PI / 4 - e), 7 * Math.sin(Math.PI / 4 - e));
        lineShape.lineTo(7 * Math.cos(Math.PI / 4 + e), 7 * Math.sin(Math.PI / 4 + e));
        lineShape.lineTo(7 * Math.cos(5 / 4 * Math.PI - e), 7 * Math.sin(5 / 4 * Math.PI - e));
        lineShape.lineTo(7 * Math.cos(5 / 4 * Math.PI + e), 7 * Math.sin(5 / 4 * Math.PI + e));
        return lineShape;
      })(),
      (() => {
        // Cross X
        let lineShape = new THREE.Shape();
        let e = 3 / 180 * Math.PI;
        lineShape.moveTo(7 * Math.cos(3 * Math.PI / 4 - e), 7 * Math.sin(3 * Math.PI / 4 - e));
        lineShape.lineTo(7 * Math.cos(3 * Math.PI / 4 + e), 7 * Math.sin(3 * Math.PI / 4 + e));
        lineShape.lineTo(7 * Math.cos(-Math.PI / 4 - e), 7 * Math.sin(-Math.PI / 4 - e));
        lineShape.lineTo(7 * Math.cos(-Math.PI / 4 + e), 7 * Math.sin(-Math.PI / 4 + e));
        return lineShape;
      })(),
      (() => {
        // Cross X
        let lineShape = new THREE.Shape();
        let e = 5 / 180 * Math.PI;
        let angle = -30 / 180 * Math.PI;
        let baseRadius = 7;
        let length = 6;
        lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
        lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
        lineShape.lineTo((baseRadius + length) * Math.cos(angle + e), (baseRadius + length) * Math.sin(angle + e));
        lineShape.lineTo((baseRadius + length) * Math.cos(angle - e), (baseRadius + length) * Math.sin(angle - e));
        return lineShape;
      })(),
      (() => {
        // Cross X
        let lineShape = new THREE.Shape();
        let e = 5 / 180 * Math.PI;
        let angle = -150 / 180 * Math.PI;
        let baseRadius = 7;
        let length = 6;
        lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
        lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
        lineShape.lineTo((baseRadius + length) * Math.cos(angle + e), (baseRadius + length) * Math.sin(angle + e));
        lineShape.lineTo((baseRadius + length) * Math.cos(angle - e), (baseRadius + length) * Math.sin(angle - e));
        return lineShape;
      })(),
    ];

    return new THREE.Mesh(
      new THREE.ShapeGeometry(shapes, 64),
      new THREE.MeshBasicMaterial({
        color: 'yellow',
      })
    );

  })();

  const radialIn = (() => {

    let shapes = [
      // Circle
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        let innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
    ];

    [Math.PI / 4, 3 * Math.PI / 4, 5 / 4 * Math.PI, 7 / 4 * Math.PI].forEach((angle) => {
      let lineShape = new THREE.Shape();
      let e = 5 / 180 * Math.PI;
      let baseRadius = 7;
      let length = 4;
      lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
      lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
      lineShape.lineTo((baseRadius - length) * Math.cos(angle + e), (baseRadius - length) * Math.sin(angle + e));
      lineShape.lineTo((baseRadius - length) * Math.cos(angle - e), (baseRadius - length) * Math.sin(angle - e));
      shapes.push(lineShape);
    });

    return new THREE.Mesh(
      new THREE.ShapeGeometry(shapes, 64),
      new THREE.MeshBasicMaterial({
        color: 'aqua',
      })
    );

  })();

  const radialOut = (() => {

    let shapes = [
      // Circle
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        let innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
        let dotShape = new THREE.Shape();
        dotShape.absarc(0, 0, 1, 0, 2 * Math.PI);
        return dotShape;
      })(),
    ];

    [Math.PI / 4, 3 * Math.PI / 4, 5 / 4 * Math.PI, 7 / 4 * Math.PI].forEach((angle) => {
      let lineShape = new THREE.Shape();
      let e = 5 / 180 * Math.PI;
      let baseRadius = 7;
      let length = 4;
      lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
      lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
      lineShape.lineTo((baseRadius + length) * Math.cos(angle + e), (baseRadius + length) * Math.sin(angle + e));
      lineShape.lineTo((baseRadius + length) * Math.cos(angle - e), (baseRadius + length) * Math.sin(angle - e));
      shapes.push(lineShape);
    });

    return new THREE.Mesh(
      new THREE.ShapeGeometry(shapes, 64),
      new THREE.MeshBasicMaterial({
        color: 'aqua',
      })
    );

  })();

  const level = (() => {

    let shapes = [
      // Circle
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(-1.5, 0);
        shape.lineTo(0, 1.5);
        shape.lineTo(1.5, 0);
        shape.lineTo(0, -1.5);
        return shape;
      })(),
      (() => {
        let shape = new THREE.Shape();
        shape.moveTo(-13, 1);
        shape.lineTo(-5, 1);
        shape.lineTo(0, -4);
        shape.lineTo(5, 1);
        shape.lineTo(13, 1);
        shape.lineTo(13, -1);
        shape.lineTo(5, -1);
        shape.lineTo(0, -6);
        shape.lineTo(-5, -1);
        shape.lineTo(-13, -1);
        return shape;
      })(),
    ];

    return new THREE.Mesh(
      //new THREE.ShapeGeometry(shapes, 64),
      new THREE.ExtrudeGeometry(shapes, {
        steps: 2,
        amount: 8,
        bevelEnabled: true,
        bevelThickness: 0.75,
        bevelSize: 0.75,
        bevelSegments: 4
      }),
      new THREE.MeshPhongMaterial({
        color: '#e8a739',
        shininess: 20
      })
    );

  })();

  prograde.scale.set(0.008, 0.008, 0.008);
  retrograde.scale.set(0.008, 0.008, 0.008);
  radialIn.scale.set(0.008, 0.008, 0.008);
  radialOut.scale.set(0.008, 0.008, 0.008);
  level.scale.set(0.008, 0.008, 0.008);

  this.navball = navball;
  this.navballPrograde = prograde;
  this.navballRetrograde = retrograde;
  this.navballRadialIn = radialIn;
  this.navballRadialOut = radialOut;
  this.navballLevel = level;

  this.navballScene.add(navball);
  this.navballScene.add(border);
  this.navballScene.add(prograde);
  this.navballScene.add(retrograde);
  this.navballScene.add(radialIn);
  this.navballScene.add(radialOut);
  this.navballScene.add(level);
  this.navballScene.add(lightSource);

  this.navballCamera.up = new THREE.Vector3(0, 0, 1);
  this.navballCamera.position.set(0, -5, 0);
  this.navballCamera.lookAt(new THREE.Vector3(0, 0, 0));

  this.navballLight = lightSource;
  this.navballBorder = border;

  lightSource.position.set(0, -5, 0);

  this.navballCamera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    0, -0.40 * window.innerHeight,
    window.innerWidth,
    window.innerHeight);
};

BaseRenderer.prototype._lookupNearbyBodies = function (focus, bodies, nearbyThreshold) {

  const partitioned = bodies.map((body) => {
      const distance = new THREE.Vector3()
        .subVectors(focus.derived.position, body.derived.position);
      return [body, distance.lengthSq()];
    })
    .reduce((acc, [body, distance]) => {
      if (distance < nearbyThreshold || (focus.primary && focus.primary.name === body.name)) {
        acc[0].push(body);
      } else {
        acc[1].push(body);
      }
      return acc;
    }, [
      [],
      []
    ]);

  const neighbours = partitioned[0];
  const outliers = partitioned[1];
  return [neighbours, outliers];
};
