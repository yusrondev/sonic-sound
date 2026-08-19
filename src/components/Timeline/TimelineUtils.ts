// Timeline layout constants and utility functions

export const TRACK_HEIGHT = 72;
export const RULER_HEIGHT = 32;

/** Convert a beat position to pixel x coordinate */
export function beatToPixel(beat: number, zoom: number): number {
  return beat * zoom;
}

/** Convert a pixel x coordinate to beat position */
export function pixelToBeat(px: number, zoom: number): number {
  return px / zoom;
}

/** Snap a beat value to the nearest grid division */
export function snapBeat(beat: number, grid: number): number {
  return Math.round(beat / grid) * grid;
}
