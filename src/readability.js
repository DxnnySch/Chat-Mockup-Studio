// Poster legibility maths. Pure.
export const CM_PER_IN = 2.54;
/** Effective printed point size of a CSS-px font when the canvas is printed `cm` wide. */
export function effectivePt(fontPx, canvasWidthPx, cm) {
  if (!(canvasWidthPx > 0) || !(cm > 0)) return fontPx * 0.75;
  const physicalPx = (cm / CM_PER_IN) * 96;
  return fontPx * (physicalPx / canvasWidthPx) * 0.75;
}
/** Pixel density of the exported bitmap at print size. */
export function effectiveDpi(canvasWidthPx, scale, cm) {
  if (!(cm > 0)) return Infinity;
  return (canvasWidthPx * scale) / (cm / CM_PER_IN);
}
/** ok >= good, warn >= min, bad below. */
export function level(pt, { min = 18, good = 24 } = {}) {
  return pt >= good ? 'ok' : pt >= min ? 'warn' : 'bad';
}
export function wcagLevel(ratio, largeText = false) {
  if (ratio >= (largeText ? 4.5 : 7)) return 'AAA';
  if (ratio >= (largeText ? 3 : 4.5)) return 'AA';
  return 'fail';
}
