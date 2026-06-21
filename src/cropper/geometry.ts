import type { CropArea, CropShape } from '../types';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Size of the (centered) crop window inside the viewport. The window is fit
 * within ~90% of the container so there's room to pan, honoring the aspect
 * ratio (forced to 1 for round/avatar shapes).
 */
export function getCropSize(
  container: Size,
  aspect: number | 'free',
  shape: CropShape,
): Size {
  if (container.width === 0 || container.height === 0) {
    return { width: 0, height: 0 };
  }
  const ratio =
    shape === 'round'
      ? 1
      : aspect === 'free'
        ? container.width / container.height
        : aspect;

  const availW = container.width * 0.9;
  const availH = container.height * 0.9;

  if (availW / availH > ratio) {
    const height = availH;
    return { width: height * ratio, height };
  }
  const width = availW;
  return { width, height: width / ratio };
}

/** Minimum scale (zoom = 1) at which the image fully covers the crop window. */
export function getBaseScale(natural: Size, crop: Size): number {
  if (natural.width === 0 || natural.height === 0) return 1;
  return Math.max(crop.width / natural.width, crop.height / natural.height);
}

/** On-screen pixel size of the image at the given zoom. */
export function getDisplaySize(natural: Size, baseScale: number, zoom: number): Size {
  return {
    width: natural.width * baseScale * zoom,
    height: natural.height * baseScale * zoom,
  };
}

/**
 * Keep the image covering the crop window: the pan offset can't move the image
 * far enough to reveal empty space inside the window.
 */
export function clampPosition(
  pos: Point,
  display: Size,
  crop: Size,
  restrict: boolean,
): Point {
  if (!restrict) return pos;
  const maxX = Math.max(0, (display.width - crop.width) / 2);
  const maxY = Math.max(0, (display.height - crop.height) / 2);
  return { x: clamp(pos.x, -maxX, maxX), y: clamp(pos.y, -maxY, maxY) };
}

/**
 * New pan offset after zooming from `zoom` to `newZoom` while keeping the point
 * `focal` (in container-relative px) stationary on screen.
 */
export function zoomToPoint(
  pos: Point,
  zoom: number,
  newZoom: number,
  focal: Point,
  container: Size,
): Point {
  const k = newZoom / zoom;
  const cx = focal.x - container.width / 2;
  const cy = focal.y - container.height / 2;
  return { x: cx * (1 - k) + pos.x * k, y: cy * (1 - k) + pos.y * k };
}

/** Crop rectangle in pixels of the source (natural) image. */
export function getCropAreaPixels(
  natural: Size,
  crop: Point,
  cropSize: Size,
  baseScale: number,
  zoom: number,
): CropArea {
  const factor = 1 / (baseScale * zoom);
  const width = cropSize.width * factor;
  const height = cropSize.height * factor;
  const x = natural.width / 2 - crop.x * factor - width / 2;
  const y = natural.height / 2 - crop.y * factor - height / 2;
  return {
    x: clamp(Math.round(x), 0, natural.width),
    y: clamp(Math.round(y), 0, natural.height),
    width: clamp(Math.round(width), 0, natural.width),
    height: clamp(Math.round(height), 0, natural.height),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
