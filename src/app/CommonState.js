const DEFAULT_FOCUS = 'firefly';

export default class CommonState {
  constructor(focus = DEFAULT_FOCUS) {
    this.focus = focus;
  }
}
