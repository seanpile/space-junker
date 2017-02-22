const DEFAULT_FOCUS = 'sun';

export default class CommonState {
  constructor(focus = DEFAULT_FOCUS) {
    this.focus = focus;
  }
}
