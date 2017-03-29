const DEFAULT_FOCUS = 'earth';

export default class SharedState {

  constructor(focus = DEFAULT_FOCUS) {
    this.focus = focus;
  }

}
