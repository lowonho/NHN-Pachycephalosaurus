import { VIEWPORT } from "../level-data.mjs";
export const WIDTH = VIEWPORT.width;
export const HEIGHT = VIEWPORT.height;
export const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
