import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampPosition,
  getBaseScale,
  getCropAreaPixels,
  getCropSize,
  getDisplaySize,
  zoomToPoint,
} from './geometry';

describe('clamp', () => {
  it('bounds a value to [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('getCropSize', () => {
  it('fits an aspect box within ~90% of the container', () => {
    expect(getCropSize({ width: 1000, height: 600 }, 1, 'rect')).toEqual({
      width: 540,
      height: 540,
    });
  });

  it('forces 1:1 for round shapes regardless of aspect', () => {
    const round = getCropSize({ width: 1000, height: 600 }, 16 / 9, 'round');
    expect(round.width).toBe(round.height);
  });

  it('uses the container ratio for free aspect', () => {
    expect(getCropSize({ width: 1000, height: 600 }, 'free', 'rect')).toEqual({
      width: 900,
      height: 540,
    });
  });

  it('returns zero size for an unmeasured container', () => {
    expect(getCropSize({ width: 0, height: 0 }, 1, 'rect')).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe('getBaseScale', () => {
  it('returns the cover scale (max of the two ratios)', () => {
    expect(getBaseScale({ width: 2000, height: 1000 }, { width: 540, height: 540 })).toBeCloseTo(
      0.54,
    );
  });
});

describe('getDisplaySize', () => {
  it('multiplies natural size by base scale and zoom', () => {
    expect(getDisplaySize({ width: 2000, height: 1000 }, 0.54, 1)).toEqual({
      width: 1080,
      height: 540,
    });
  });
});

describe('clampPosition', () => {
  const display = { width: 1080, height: 540 };
  const crop = { width: 540, height: 540 };

  it('keeps the image covering the crop window', () => {
    expect(clampPosition({ x: 1000, y: 0 }, display, crop, true)).toEqual({ x: 270, y: 0 });
    expect(clampPosition({ x: -1000, y: 0 }, display, crop, true)).toEqual({ x: -270, y: 0 });
  });

  it('passes through unchanged when restrictPosition is false', () => {
    expect(clampPosition({ x: 9999, y: 9999 }, display, crop, false)).toEqual({
      x: 9999,
      y: 9999,
    });
  });
});

describe('zoomToPoint', () => {
  const container = { width: 1000, height: 600 };

  it('does not shift when the focal point is the center', () => {
    expect(zoomToPoint({ x: 0, y: 0 }, 1, 2, { x: 500, y: 300 }, container)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('shifts to keep an off-center focal point stationary', () => {
    expect(zoomToPoint({ x: 0, y: 0 }, 1, 2, { x: 0, y: 0 }, container)).toEqual({
      x: 500,
      y: 300,
    });
  });
});

describe('getCropAreaPixels', () => {
  it('maps a centered window to source pixels', () => {
    const area = getCropAreaPixels(
      { width: 2000, height: 1000 },
      { x: 0, y: 0 },
      { width: 540, height: 540 },
      0.54,
      1,
    );
    expect(area).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('clamps the rectangle within the image bounds', () => {
    const area = getCropAreaPixels(
      { width: 800, height: 800 },
      { x: 0, y: 0 },
      { width: 400, height: 400 },
      0.5,
      1,
    );
    expect(area.x).toBeGreaterThanOrEqual(0);
    expect(area.y).toBeGreaterThanOrEqual(0);
    expect(area.x + area.width).toBeLessThanOrEqual(800);
    expect(area.y + area.height).toBeLessThanOrEqual(800);
  });
});
