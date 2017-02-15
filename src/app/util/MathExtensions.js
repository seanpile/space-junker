/**
 * Limit the input to be between [-1, 1].
 */
Math.safeAcos = function (rads) {

  const enableLogging = false;

  let input = rads;
  if (input < -1) {
    enableLogging && console.warn(`Setting rads = ${rads} to -1`);
    input = -1;
  } else if (input > 1) {
    enableLogging && console.warn(`Setting rads = ${rads} to 1`);
    input = 1;
  }

  return Math.acos(input);
}
