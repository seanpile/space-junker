# space-junker

Inspired by Kerbal Space Program, this is an orbital mechanics simulator that builds upon my previous project at [expanse-sandbox](https://github.com/seanpile/expanse-sandbox).

This project leverages several resources:

* Planetary Textures:
  * http://planetpixelemporium.com/sun.html
  * http://www.shadedrelief.com/natural3/pages/textures.html
* NASA Craft Models (Sketchup 3D Warehouse):
  * https://3dwarehouse.sketchup.com/model.html?id=cdfbbdbb8503f57c115f0b7032477834
* Planetary Data for initial plotting care of the NASA Jet Propulsion Laboratory
  * [Keplerian Elements](http://ssd.jpl.nasa.gov/?planet_pos)

Technology used:

* **JavaScript** (self-contained, runs in the browser)
* **Three.js / WebGL** (provides 3D graphics)
* **React / Vue** (experimented with both libraries for rendering UI Components)
* **Webpack** (provides build / bundling / dev server)

## Installation

Requires [npm](http://blog.npmjs.org/post/85484771375/how-to-install-npm)

```sh
$ git clone https://github.com/seanpile/space-junker
$ cd space-junker

# Install all dependencies
$ npm install

# Start dev server
$ npm start

# Simulation is available at http://localhost:8080/index.html
```

## Live build

The [docs](/docs) folder contains a live-build of the project.  To access, visit http://github.seanpile.io/space-junker

## Meta

Sean Dawson – [@seanpiled](https://twitter.com/seanpiled)

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/seanpile](https://github.com/seanpile/)
