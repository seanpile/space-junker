/**
 * Kepler elements taken from http://ssd.jpl.nasa.gov/txt/aprx_pos_planets.pdf
 * Planetary constants taken from http://www.braeunig.us/space/constant.htm
 *
 * All distances are scaled down by the AU to reduce the size of the numbers
 * throughout the simulation.
 */

export const AU = 149.59787e9;
export const PLANET_TYPE = "planet";
export const SHIP_TYPE = "ship";
export const ASTEROID_TYPE = "asteroid";

export default {
  "sun": {
    type: PLANET_TYPE,
    constants: {
      u: 1.32712438e20 / Math.pow(AU, 3),
      radius: 696e6 / AU,
    }
  },
  "mercury": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 0.02203e15 / Math.pow(AU, 3),
      radius: 2.4397e6 / AU,
      rotation_period: 58.646, // days
      axial_tilt: 0.034, // relative to orbit
    },
    kepler_elements: {
      a: [0.38709843, 0.0],
      e: [0.20563661, 0.00002123],
      I: [7.00559432, -0.00590158],
      L: [252.25166724, 149472.67486623],
      w: [77.45771895, 0.15940013],
      omega: [48.33961819, -0.12214182],
    }
  },
  "venus": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 0.3249e15 / Math.pow(AU, 3),
      radius: 6.0518e6 / AU,
      rotation_period: -243.025, // days (negative == retrograde)
      axial_tilt: 177.36, // relative to orbit
    },
    kepler_elements: {
      a: [0.72332102, -0.00000026],
      e: [0.00676399, -0.00005107],
      I: [3.39777545, 0.00043494],
      L: [181.97970850, 58517.81560260],
      w: [131.76755713, 0.05679648],
      omega: [76.67261496, -0.27274174],
    }
  },

  "moon": {
    type: PLANET_TYPE,
    primary: "earth",
    constants: {
      u: 4.902794e12 / Math.pow(AU, 3),
      radius: 1738e3 / AU,
      rotation_period: 27.321661,
      axial_tilt: 6.687
    },
    kepler_elements: {
      a: [0.00257, 0],
      e: [0.0549, 0],
      I: [5.145, 0],
      // mean longitude,
      L: [0, 500000],
      // longitude of perihelion
      w: [0, 0],
      // longitude of the ascending node
      omega: [0, 0],
    }
  },
  "earth": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 0.3986e15 / Math.pow(AU, 3),
      radius: 6.3781e6 / AU,
      rotation_period: 0.99726968,
      axial_tilt: 23.4392811,
    },
    kepler_elements: {
      a: [1.00000018, -0.00000003],
      e: [0.01673163, -0.00003661],
      I: [-0.00054346, -0.01337178],
      L: [100.46691572, 35999.37306329],
      w: [102.93005885, 0.31795260],
      omega: [-5.11260389, -0.24123856],
    }
  },
  "firefly": {
    type: SHIP_TYPE,
    primary: "earth",
    constants: {
      radius: 100 / AU,
    },
    kepler_elements: {
      a: [400e3 / AU, 0],
      e: [0.1, 0],
      I: [0, 0],
      L: [0, 50000],
      w: [0, 0],
      omega: [0, 0],
    },
  },
  "mars": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 0.04283e15 / Math.pow(AU, 3),
      radius: 3.397e6 / AU,
      rotation_period: 1.025957, // days
      axial_tilt: 25.19, // relative to orbit
    },
    kepler_elements: {
      a: [1.52371243, 0.00000097],
      e: [0.09336511, 0.00009149],
      I: [1.85181869, -0.00724757],
      L: [-4.56813164, 19140.29934243],
      w: [-23.91744784, 0.45223625],
      omega: [49.71320984, -0.26852431],
    }
  },
  "jupiter": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 126.686e15 / Math.pow(AU, 3),
      radius: 7.1492e7 / AU,
      rotation_period: 0.413542, // days
      axial_tilt: 3.13, // relative to orbit
    },
    kepler_elements: {
      a: [5.20248019, -0.00002864],
      e: [0.04853590, 0.00018026],
      I: [1.29861416, -0.00322699],
      L: [34.33479152, 3034.90371757],
      w: [14.27495244, 0.18199196],
      omega: [100.29282654, 0.13024619],
      perturbations: {
        b: -0.00012452,
        c: 0.6064060,
        s: -0.35635438,
        f: 38.35125000
      }
    }
  },
  "saturn": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 37.391e15 / Math.pow(AU, 3),
      radius: 6.0268e7 / AU,
      rotation_period: 0.439583, // days
      axial_tilt: 26.73, // relative to orbit
    },
    kepler_elements: {
      a: [9.54149883, -0.00003065],
      e: [0.05550825, -0.00032044],
      I: [2.49424102, 0.00451969],
      L: [50.07571329, 1222.11494724],
      w: [92.86136063, 0.54179478],
      omega: [113.63998702, -0.25015002],
      perturbations: {
        b: 0.00025899,
        c: -0.13434469,
        s: 0.87320147,
        f: 38.35125000
      }
    }
  },
  "uranus": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 5.794e15 / Math.pow(AU, 3),
      radius: 2.5559e7 / AU,
      rotation_period: 0.71833, // days (negative == retrograde)
      axial_tilt: 97.77, // relative to orbit
    },
    kepler_elements: {
      a: [19.18797948, -0.00020455],
      e: [0.04685740, -0.00001550],
      I: [0.77298127, -0.00180155],
      L: [314.20276625, 428.49512595],
      w: [172.43404441, 0.09266985],
      omega: [73.96250215, 0.05739699],
      perturbations: {
        b: 0.00058331,
        c: -0.97731848,
        s: 0.17689245,
        f: 7.67025000
      }
    }
  },
  "neptune": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 6.835e15 / Math.pow(AU, 3),
      radius: 2.4764e7 / AU,
      rotation_period: 0.6713, // days (negative == retrograde)
      axial_tilt: 28.32 // relative to orbit
    },
    kepler_elements: {
      a: [30.06952752, 0.00006447],
      e: [0.00895439, 0.00000818],
      I: [1.77005520, 0.00022400],
      L: [304.22289287, 218.46515314],
      w: [46.68158724, 0.01009938],
      omega: [131.78635853, -0.00606302],
      perturbations: {
        b: -0.00041348,
        c: 0.68346318,
        s: -0.10162547,
        f: 7.67025000
      }
    }
  },
  "pluto": {
    type: PLANET_TYPE,
    primary: "sun",
    constants: {
      u: 0.00083e15 / Math.pow(AU, 3),
      radius: 1.195e6 / AU,
      rotation_period: 6.387230, // days
      axial_tilt: 122.53, // relative to orbit
    },
    kepler_elements: {
      a: [39.48686035, 0.00449751],
      e: [0.24885238, 0.00006016],
      I: [17.14104260, 0.00000501],
      L: [238.96535011, 145.18042903],
      w: [224.09702598, -0.00968827],
      omega: [110.30167986, -0.00809981],
      perturbations: {
        b: -0.01262724,
        c: 0,
        s: 0,
        f: 0
      }
    }
  }
};
