export default class SpaceJunkerAPI {

  constructor() {

    this.handlers = {
      update: [],
      render: [],
    };

    this.initialize();
  }

  /**
   * Add custom handlers here
   */
  initialize() {
  }

  clear() {
    this.handlers.update = [];
    this.handlers.render = [];
  }

  addUpdateHandler(fn) {
    this.handlers.update.push(fn);
  }

  addRenderHandler(fn) {
    this.handlers.render.push(fn);
  }

  onUpdate(engine) {
    this.handlers.update.forEach(handler => handler(engine));
  }

  onRender(engine) {
    let stop = false;
    this.handlers.render.forEach((handler) => {
      stop = stop || handler(engine);
    });

    return stop;
  }

}
