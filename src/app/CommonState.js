const DEFAULT_FOCUS = 'apollo';

export default class CommonState {
  constructor(focus = DEFAULT_FOCUS) {
    this.focus = focus;
  }
}
