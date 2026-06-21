import { describe, expect, it } from 'vitest';
import {
  getContainRect,
  initialCropRect,
  moveCropRect,
  rectToCropArea,
  resizeCropRect,
  type Rect,
} from './rectGeometry';

describe('getContainRect', () => {
  it('fits a wide image by width and centers vertically', () => {
    const c = getContainRect({ width: 2000, height: 1000 }, { width: 800, height: 800 });
    expect(c.width).toBe(800);
    expect(c.height).toBe(400);
    expect(c.offsetY).toBe(200);
    expect(c.scale).toBeCloseTo(2.5);
  });

  it('returns zero for an unmeasured container', () => {
    expect(getContainRect({ width: 0, height: 0 }, { width: 0, height: 0 }).width).toBe(0);
  });
});

describe('initialCropRect', () => {
  it('centers an aspect-correct box within the image', () => {
    const r = initialCropRect({ width: 800, height: 400 }, 1);
    expect(r.width).toBe(r.height); // 1:1
    expect(r.x).toBeCloseTo((800 - r.width) / 2);
    expect(r.y).toBeCloseTo((400 - r.height) / 2);
  });
});

describe('moveCropRect', () => {
  const start: Rect = { x: 100, y: 100, width: 200, height: 200 };
  const bounds = { width: 800, height: 400 };

  it('translates within bounds', () => {
    expect(moveCropRect(start, 50, -50, bounds)).toEqual({ x: 150, y: 50, width: 200, height: 200 });
  });

  it('clamps to the image edges', () => {
    expect(moveCropRect(start, 9999, 9999, bounds)).toEqual({
      x: 600,
      y: 200,
      width: 200,
      height: 200,
    });
  });
});

describe('resizeCropRect', () => {
  const start: Rect = { x: 100, y: 100, width: 200, height: 200 };
  const bounds = { width: 800, height: 600 };
  const free = { aspect: 'free' as const, minWidth: 16, minHeight: 16, bounds };

  it('grows from the SE handle', () => {
    const r = resizeCropRect(start, 'se', 100, 50, free);
    expect(r).toEqual({ x: 100, y: 100, width: 300, height: 250 });
  });

  it('moves the left edge from the W handle', () => {
    const r = resizeCropRect(start, 'w', -40, 0, free);
    expect(r).toEqual({ x: 60, y: 100, width: 240, height: 200 });
  });

  it('enforces the minimum width', () => {
    const r = resizeCropRect(start, 'e', -500, 0, { ...free, minWidth: 50 });
    expect(r.width).toBe(50);
  });

  it('locks aspect ratio on a corner handle', () => {
    const r = resizeCropRect(start, 'se', 100, 0, {
      aspect: 1,
      minWidth: 16,
      minHeight: 16,
      bounds,
    });
    expect(r.width).toBeCloseTo(r.height);
  });
});

describe('rectToCropArea', () => {
  it('scales a display rect to source pixels', () => {
    const area = rectToCropArea({ x: 100, y: 50, width: 200, height: 100 }, 2.5, {
      width: 2000,
      height: 1000,
    });
    expect(area).toEqual({ x: 250, y: 125, width: 500, height: 250 });
  });
});
