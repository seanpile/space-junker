import * as THREE from 'three';
import Mousetrap from 'mousetrap';
import {
  AU,
} from '../Constants';

// rad / second
const MOTION_STEP = Math.PI / 16;
const THRUST_STEP = 0.1;

export default function BaseRenderer(solarSystem, resourceLoader, state) {
  this.solarSystem = solarSystem;
  this.resourceLoader = resourceLoader;
  this.sharedState = state;
}

// Allow renderers to act on changes to the user interface
Object.assign(BaseRenderer.prototype, THREE.EventDispatcher.prototype);

/**
 *
 */
BaseRenderer.prototype._onWindowResize =
  function (cameras,
    originalHeight,
    originalFov) {
    const tanFOV = Math.tan((((Math.PI / 180) * originalFov) / 2));
    return () => {
      cameras.forEach((camera) => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / originalHeight));

        camera.updateProjectionMatrix();
      });

      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
  };

/**
 * Recenter the coordinate system on the focus being the 'center'.
 */
BaseRenderer.prototype._adjustCoordinates = function (focus, position) {

  if (!position) {
    return position;
  }

  if (!focus) {
    return position.clone();
  }

  const coordinates = position.clone()
    .sub(focus.position);

  return coordinates;
};

BaseRenderer.prototype._loadPlanet = function (body, textures) {
  let material;
  if (body.name === 'sun') {
    material = new THREE.MeshBasicMaterial({ color: 'yellow' });
  } else {
    material = new THREE.MeshPhongMaterial();
    if (textures.has(`${body.name}bump`)) {
      material.bumpMap = textures.get(`${body.name}bump`);
      material.bumpScale = 100000 / AU;
    }

    if (textures.has(`${body.name}spec`)) {
      material.specularMap = textures.get(`${body.name}spec`);
      material.specular = new THREE.Color('grey');
    }

    if (textures.has(body.name)) {
      // Reduce harsh glare effect of the light source (default 30 -> 1);
      material.map = textures.get(body.name);
      material.shininess = 1;
    }
  }

  const threeBody = new THREE.Mesh(
    new THREE.SphereBufferGeometry(body.constants.radius, 32, 32),
    material);

  threeBody.receiveShadow = true;
  threeBody.castShadow = true;

  return threeBody;
};

BaseRenderer.prototype._applyPlanetaryRotation = function (planet, body) {
  const orbit = body.orbit;

  planet.rotation.set(0, 0, 0);
  planet.rotateZ(orbit.omega);
  planet.rotateX(orbit.I);
  planet.rotateZ(orbit.argumentPerihelion);
  planet.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  planet.rotateOnAxis(
   new THREE.Vector3(0, 0, 1),
   -((body.constants.axial_tilt || 0) * Math.PI) / 180);
  planet.rotateY(body.constants.rotation);
};

BaseRenderer.prototype.loadNavball = function (textures) {
  const navballScene = new THREE.Scene();
  const navballCamera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, 0.1, 100);

  const navball = new THREE.Mesh(
    new THREE.SphereBufferGeometry(0.4, 32, 32),
    new THREE.MeshPhongMaterial({
      map: textures.get('navball'),
      shininess: 1,
    }));

  const border = new THREE.Mesh(
    new THREE.TorusBufferGeometry(0.44, 0.05, 80, 60),
    new THREE.MeshPhongMaterial({
      color: 'gray',
      depthFunc: THREE.AlwaysDepth,
      shininess: 10,
    }));

  const { prograde, retrograde, radialIn, radialOut } = this._createOrbitalMarkers();

  const level = (() => {
    const shapes = [
            // Circle
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(-1.5, 0);
        shape.lineTo(0, 1.5);
        shape.lineTo(1.5, 0);
        shape.lineTo(0, -1.5);
        return shape;
      })(),
      (() => {
        const shape = new THREE.Shape();
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
            // new THREE.ShapeGeometry(shapes, 64),
            new THREE.ExtrudeGeometry(shapes, {
              steps: 2,
              amount: 8,
              bevelEnabled: true,
              bevelThickness: 0.75,
              bevelSize: 0.75,
              bevelSegments: 4,
            }),
            new THREE.MeshPhongMaterial({
              color: '#e8a739',
              shininess: 20,
            }),
          );
  })();

  prograde.scale.set(0.008, 0.008, 0.008);
  retrograde.scale.set(0.008, 0.008, 0.008);
  radialIn.scale.set(0.008, 0.008, 0.008);
  radialOut.scale.set(0.008, 0.008, 0.008);
  level.scale.set(0.008, 0.008, 0.008);

  navballScene.add(navball);
  navballScene.add(border);
  navballScene.add(prograde);
  navballScene.add(retrograde);
  navballScene.add(radialIn);
  navballScene.add(radialOut);
  navballScene.add(level);

  navballCamera.up = new THREE.Vector3(0, 0, 1);
  navballCamera.position.set(0, -5, 0);
  navballCamera.lookAt(new THREE.Vector3(0, 0, 0));

  const lightSource = new THREE.DirectionalLight(0xffffff, 1);
  lightSource.position.set(0, -5, 0);
  navballScene.add(lightSource);

  navballCamera.setViewOffset(
    window.innerWidth,
    window.innerHeight,
    0, -0.40 * window.innerHeight,
    window.innerWidth,
    window.innerHeight);

  return {
    light: lightSource,
    border,
    camera: navballCamera,
    scene: navballScene,
    gyroscope: navball,
    markers: {
      radialIn,
      radialOut,
      prograde,
      retrograde,
      level,
    },
  };
};

BaseRenderer.prototype._createOrbitalMarkers = function () {

  const prograde = (() => {
    const shapes = [
        // Circle
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        const innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
        const lineShape = new THREE.Shape();
        lineShape.moveTo(-1, 8);
        lineShape.lineTo(-1, 13);
        lineShape.lineTo(1, 13);
        lineShape.lineTo(1, 8);
        return lineShape;
      })(),
      (() => {
        const lineShape = new THREE.Shape();
        lineShape.moveTo(8, 1);
        lineShape.lineTo(13, 1);
        lineShape.lineTo(13, -1);
        lineShape.lineTo(8, -1);
        return lineShape;
      })(),
      (() => {
        const lineShape = new THREE.Shape();
        lineShape.moveTo(-8, 1);
        lineShape.lineTo(-13, 1);
        lineShape.lineTo(-13, -1);
        lineShape.lineTo(-8, -1);
        return lineShape;
      })(),
      (() => {
        const dotShape = new THREE.Shape();
        dotShape.absarc(0, 0, 1, 0, 2 * Math.PI);
        return dotShape;
      })(),
    ];

    return new THREE.Mesh(
        new THREE.ShapeBufferGeometry(shapes, 64),
        new THREE.MeshBasicMaterial({ color: 'yellow' }),
      );
  })();

  const retrograde = (() => {
    const shapes = [
        // Circle
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        const innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
          // Up line
        const lineShape = new THREE.Shape();
        lineShape.moveTo(-1, 8);
        lineShape.lineTo(-1, 13);
        lineShape.lineTo(1, 13);
        lineShape.lineTo(1, 8);
        return lineShape;
      })(),
      (() => {
          // Cross X
        const lineShape = new THREE.Shape();
        const e = (3 / 180) * Math.PI;
        lineShape.moveTo(
            7 * Math.cos((Math.PI / 4) - e),
            7 * Math.sin((Math.PI / 4) - e));
        lineShape.lineTo(
            7 * Math.cos((Math.PI / 4) + e),
            7 * Math.sin((Math.PI / 4) + e));
        lineShape.lineTo(
            7 * Math.cos(((5 / 4) * Math.PI) - e),
            7 * Math.sin(((5 / 4) * Math.PI) - e));
        lineShape.lineTo(
            7 * Math.cos(((5 / 4) * Math.PI) + e),
            7 * Math.sin(((5 / 4) * Math.PI) + e));

        return lineShape;
      })(),
      (() => {
          // Cross X
        const lineShape = new THREE.Shape();
        const e = (3 / 180) * Math.PI;
        lineShape.moveTo(
            7 * Math.cos(((3 / 4) * Math.PI) - e),
            7 * Math.sin(((3 / 4) * Math.PI) - e));
        lineShape.lineTo(
            7 * Math.cos(((3 / 4) * Math.PI) + e),
            7 * Math.sin(((3 / 4) * Math.PI) + e));
        lineShape.lineTo(
            7 * Math.cos(-(Math.PI / 4) - e),
            7 * Math.sin(-(Math.PI / 4) - e));
        lineShape.lineTo(
            7 * Math.cos(-(Math.PI / 4) + e),
            7 * Math.sin(-(Math.PI / 4) + e));
        return lineShape;
      })(),
      (() => {
          // Cross X
        const lineShape = new THREE.Shape();
        const e = (5 / 180) * Math.PI;
        const angle = -(30 / 180) * Math.PI;
        const baseRadius = 7;
        const length = 6;
        lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
        lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
        lineShape.lineTo(
            (baseRadius + length) * Math.cos(angle + e),
            (baseRadius + length) * Math.sin(angle + e));
        lineShape.lineTo(
            (baseRadius + length) * Math.cos(angle - e),
            (baseRadius + length) * Math.sin(angle - e));
        return lineShape;
      })(),
      (() => {
          // Cross X
        const lineShape = new THREE.Shape();
        const e = (5 / 180) * Math.PI;
        const angle = (-150 / 180) * Math.PI;
        const baseRadius = 7;
        const length = 6;
        lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
        lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
        lineShape.lineTo(
            (baseRadius + length) * Math.cos(angle + e),
            (baseRadius + length) * Math.sin(angle + e));
        lineShape.lineTo(
            (baseRadius + length) * Math.cos(angle - e),
            (baseRadius + length) * Math.sin(angle - e));
        return lineShape;
      })(),
    ];

    return new THREE.Mesh(
        new THREE.ShapeBufferGeometry(shapes, 64),
        new THREE.MeshBasicMaterial({ color: 'yellow' }),
      );
  })();

  const radialIn = (() => {
    const shapes = [
        // Circle
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        const innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
    ];

    [(1 / 4) * Math.PI, (3 / 4) * Math.PI, (5 / 4) * Math.PI, (7 / 4) * Math.PI].forEach(
        (angle) => {
          const lineShape = new THREE.Shape();
          const e = (5 / 180) * Math.PI;
          const baseRadius = 7;
          const length = 4;
          lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
          lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
          lineShape.lineTo(
          (baseRadius - length) * Math.cos(angle + e),
          (baseRadius - length) * Math.sin(angle + e));
          lineShape.lineTo(
          (baseRadius - length) * Math.cos(angle - e),
          (baseRadius - length) * Math.sin(angle - e));
          shapes.push(lineShape);
        });

    return new THREE.Mesh(
        new THREE.ShapeBufferGeometry(shapes, 64),
        new THREE.MeshBasicMaterial({ color: 'aqua' }),
      );
  })();

  const radialOut = (() => {
    const shapes = [
        // Circle
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 8, 0, Math.PI * 2, false);
        const innerHole = new THREE.Path();
        innerHole.absellipse(0, 0, 6, 6, 0, Math.PI * 2, true);
        shape.holes.push(innerHole);
        return shape;
      })(),
      (() => {
        const dotShape = new THREE.Shape();
        dotShape.absarc(0, 0, 1, 0, 2 * Math.PI);
        return dotShape;
      })(),
    ];

    [(1 / 4) * Math.PI, (3 / 4) * Math.PI, (5 / 4) * Math.PI, (7 / 4) * Math.PI].forEach(
        (angle) => {
          const lineShape = new THREE.Shape();
          const e = (5 / 180) * Math.PI;
          const baseRadius = 7;
          const length = 4;
          lineShape.moveTo(baseRadius * Math.cos(angle - e), baseRadius * Math.sin(angle - e));
          lineShape.lineTo(baseRadius * Math.cos(angle + e), baseRadius * Math.sin(angle + e));
          lineShape.lineTo(
          (baseRadius + length) * Math.cos(angle + e),
          (baseRadius + length) * Math.sin(angle + e));
          lineShape.lineTo(
          (baseRadius + length) * Math.cos(angle - e),
          (baseRadius + length) * Math.sin(angle - e));
          shapes.push(lineShape);
        });

    return new THREE.Mesh(
        new THREE.ShapeBufferGeometry(shapes, 64),
        new THREE.MeshBasicMaterial({ color: 'aqua' }),
      );
  })();


  return { prograde, retrograde, radialIn, radialOut };
};

BaseRenderer.prototype.setNavballOrientation = (function () {
  const orientation = new THREE.Vector3();
  const primaryOrientation = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const ORIGIN = new THREE.Vector3();
  const up = new THREE.Vector3();
  const up0 = new THREE.Vector3(0, 0, 1);

  return function setNavballOrientation(focus, navball) {
    const primary = focus.primary;
    const motion = focus.motion;
    const velocity = focus.velocity.clone();
    const primaryPosition = this._adjustCoordinates(focus, primary.position);

    orientation.copy(motion.heading0);
    orientation.applyQuaternion(motion.rotation);
    orientation.normalize();

    up.copy(up0);
    up.applyQuaternion(motion.rotation);
    up.normalize();

    primaryOrientation.copy(primaryPosition);
    primaryOrientation.normalize();

    /**
     * Helpers to visualize velocity, orientation, position
     */
    if (this.showHelpers) {
      this.velocityHelper && this.scene.remove(this.velocityHelper);
      this.velocityHelper = new THREE.ArrowHelper(velocity.clone()
        .normalize(), ORIGIN, 1000 / AU, 'yellow');
      this.scene.add(this.velocityHelper);

      this.orientationHelper && this.scene.remove(this.orientationHelper);
      this.orientationHelper = new THREE.ArrowHelper(orientation, ORIGIN, 1000 / AU, 'blue');
      this.scene.add(this.orientationHelper);

      this.positionHelper && this.scene.remove(this.positionHelper);
      this.positionHelper = new THREE.ArrowHelper(primaryOrientation, ORIGIN, 1000 / AU, 'red');
      this.scene.add(this.positionHelper);
    }

    /**
     * Rotate the camera, reproducing the pitch/yaw/rotation on the
     * foucs.
     */
    offset.copy(orientation);
    offset.normalize()
        .negate()
        .multiplyScalar(5);

    const navballCamera = navball.camera;
    const navballLight = navball.light;
    const navballBorder = navball.border;

    navballCamera.position.copy(offset);
    navballLight.position.copy(offset);

    navballCamera.up.copy(up);
    navballCamera.lookAt(ORIGIN);

    // Set the border to always face the camera
    navballBorder.setRotationFromQuaternion(motion.rotation);
    navballBorder.rotateX(Math.PI / 2);

    const radial = primaryPosition;
    const angle = radial.angleTo(motion.heading0);
    offset.crossVectors(radial, motion.heading0)
        .normalize();

    const gyroscope = navball.gyroscope;

    gyroscope.rotation.set(0, 0, 0);
    gyroscope.rotateOnAxis(offset, -angle);

    const verticalAngle = -(primary.constants.axial_tilt || 0) * (Math.PI / 180);
    gyroscope.rotateY(Math.PI / 2);
    gyroscope.rotateY(-verticalAngle);

    /**
     * Adjust Navball Markers (Prograde, Retrograde, etc...)
     */

    const markers = [
      [navball.markers.prograde, velocity.clone()
        .normalize()
        .negate()
        .multiplyScalar(0.41),
      ],
      [navball.markers.retrograde, velocity.clone()
        .normalize()
        .multiplyScalar(0.41),
      ],
      [navball.markers.radialIn,
        primaryOrientation.clone()
        .negate()
        .multiplyScalar(0.41),
      ],
      [navball.markers.radialOut,
        primaryOrientation.clone()
        .multiplyScalar(0.41),
      ],
      [navball.markers.level,
        this.navball.camera.position.clone()
        .normalize()
        .multiplyScalar(0.45),
      ],
    ];

    markers.forEach(([marker, position]) => {
      marker.position.copy(position);
      marker.setRotationFromQuaternion(motion.rotation);
      marker.up.copy(up);
      marker.lookAt(ORIGIN);
      marker.rotateX(Math.PI);
      marker.rotateZ(Math.PI);
    });
  };
}());

BaseRenderer.prototype.createKeyBindings = function (additionalKeys) {

  const ifShip = fn => () => {
    const body = this.solarSystem.find(this.sharedState.focus);
    if (body.isShip()) {
      fn(body);
    }
  };

  const keyBindings = {
    // (Decrease Throttle)
    '-': ifShip((ship) => {
      ship.motion.thrust = Math.max(0, ship.motion.thrust - THRUST_STEP);
    }),
    // (Increase Throttle)
    '=': ifShip((ship) => {
      ship.motion.thrust = Math.min(1, ship.motion.thrust + THRUST_STEP);
    }),
    t: ifShip((ship) => {
      ship.motion.sas = !ship.motion.sas;
    }),
    q: ifShip((ship) => {
      ship.motion.roll += -MOTION_STEP;
    }),
    e: ifShip((ship) => {
      ship.motion.roll += MOTION_STEP;
    }),
    w: ifShip((ship) => {
      ship.motion.pitch += MOTION_STEP;
    }),
    s: ifShip((ship) => {
      ship.motion.pitch += -MOTION_STEP;
    }),
    a: ifShip((ship) => {
      ship.motion.yaw += -MOTION_STEP;
    }),
    d: ifShip((ship) => {
      ship.motion.yaw += MOTION_STEP;
    }),
  };

  const allBindings = Object.assign(keyBindings, additionalKeys);

  return {
    bind: () => {
      Object.keys(allBindings).forEach((key) => {
        Mousetrap.bind(key, allBindings[key]);
      });
    },
    unbind: () => {
      Object.keys(allBindings).forEach((key) => {
        Mousetrap.unbind(key);
      });
    },
  };
};

BaseRenderer.prototype._lookupNearbyBodies =
  function lookupNearbyBodies(focus, bodies, nearbyThreshold) {
    const partitioned = bodies.filter(b => b.name !== 'sun').map((body) => {
      const distance = new THREE.Vector3()
        .subVectors(focus.position, body.position);
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
      [],
    ]);

    const neighbours = partitioned[0];
    const outliers = partitioned[1];
    return [neighbours, outliers];
  };
