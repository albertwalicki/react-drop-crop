import type { CropArea } from '../types';
import { clamp, type Size } from './geometry';

/** A rectangle in displayed-image coordinates (origin = image top-left). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface ContainRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number; // natural px per displayed px
}

/** Fit the image inside the container (contain), centered. */
export function getContainRect(natural: Size, container: Size): ContainRect {
  if (
    natural.width === 0 ||
    natural.height === 0 ||
    container.width === 0 ||
    container.height === 0
  ) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1 };
  }
  const fit = Math.min(container.width / natural.width, container.height / natural.height);
  const width = natural.width * fit;
  const height = natural.height * fit;
  return {
    width,
    height,
    offsetX: (container.width - width) / 2,
    offsetY: (container.height - height) / 2,
    scale: natural.width / width,
  };
}

/** A centered initial crop box at ~80% of the image, honoring aspect. */
export function initialCropRect(display: Size, aspect: number | 'free'): Rect {
  if (display.width === 0 || display.height === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const ratio = aspect === 'free' ? display.width / display.height : aspect;
  let width = display.width * 0.8;
  let height = width / ratio;
  if (height > display.height * 0.8) {
    height = display.height * 0.8;
    width = height * ratio;
  }
  return {
    x: (display.width - width) / 2,
    y: (display.height - height) / 2,
    width,
    height,
  };
}

export function moveCropRect(start: Rect, dx: number, dy: number, bounds: Size): Rect {
  return {
    x: clamp(start.x + dx, 0, Math.max(0, bounds.width - start.width)),
    y: clamp(start.y + dy, 0, Math.max(0, bounds.height - start.height)),
    width: start.width,
    height: start.height,
  };
}

export interface ResizeOptions {
  aspect: number | 'free';
  minWidth: number; // in display px
  minHeight: number; // in display px
  bounds: Size;
}

/** Resize `start` by dragging `handle` with a (dx, dy) delta in display px. */
export function resizeCropRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  opts: ResizeOptions,
): Rect {
  const { aspect, minWidth, minHeight, bounds } = opts;
  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (hasW) left = start.x + dx;
  if (hasE) right = start.x + start.width + dx;
  if (hasN) top = start.y + dy;
  if (hasS) bottom = start.y + start.height + dy;

  // Enforce minimum size by pushing the moving edge back.
  if (right - left < minWidth) {
    if (hasW) left = right - minWidth;
    else right = left + minWidth;
  }
  if (bottom - top < minHeight) {
    if (hasN) top = bottom - minHeight;
    else bottom = top + minHeight;
  }

  if (aspect !== 'free') {
    const isCorner = (hasW || hasE) && (hasN || hasS);
    if (isCorner) {
      const newH = (right - left) / aspect;
      if (hasN) top = bottom - newH;
      else bottom = top + newH;
    } else if (hasW || hasE) {
      const newH = (right - left) / aspect;
      const cy = (top + bottom) / 2;
      top = cy - newH / 2;
      bottom = cy + newH / 2;
    } else {
      const newW = (bottom - top) * aspect;
      const cx = (left + right) / 2;
      left = cx - newW / 2;
      right = cx + newW / 2;
    }
  }

  // Clamp inside the image.
  left = clamp(left, 0, bounds.width);
  top = clamp(top, 0, bounds.height);
  right = clamp(right, 0, bounds.width);
  bottom = clamp(bottom, 0, bounds.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Convert a display-space crop rect to source-image pixels. */
export function rectToCropArea(rect: Rect, scale: number, natural: Size): CropArea {
  return {
    x: clamp(Math.round(rect.x * scale), 0, natural.width),
    y: clamp(Math.round(rect.y * scale), 0, natural.height),
    width: clamp(Math.round(rect.width * scale), 0, natural.width),
    height: clamp(Math.round(rect.height * scale), 0, natural.height),
  };
}
