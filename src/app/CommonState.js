const DEFAULT_FOCUS = 'earth';

export default class CommonState {
  constructor(focus = DEFAULT_FOCUS) {
    this.focus = focus;
  }
}
