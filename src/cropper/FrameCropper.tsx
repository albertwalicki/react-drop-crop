import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { CropArea, CropShape, ZoomOptions } from '../types';
import {
  clamp,
  clampPosition,
  distance,
  getBaseScale,
  getCropAreaPixels,
  getCropSize,
  getDisplaySize,
  midpoint,
  zoomToPoint,
  type Point,
  type Size,
} from './geometry';

import type { CropperHandle } from './types';

export interface FrameCropperProps {
  src: string;
  aspect: number | 'free';
  shape: CropShape;
  zoom?: ZoomOptions;
  grid?: boolean;
  restrictPosition?: boolean;
  onCropAreaChange?: (area: CropArea) => void;
}

const DEFAULT_ZOOM = { min: 1, max: 3, step: 0.01, initial: 1 } as const;

export const FrameCropper = forwardRef<CropperHandle, FrameCropperProps>(
  function FrameCropper(props, ref) {
    const {
      src,
      aspect,
      shape,
      grid = true,
      restrictPosition = true,
      onCropAreaChange,
    } = props;

    const zMin = props.zoom?.min ?? DEFAULT_ZOOM.min;
    const zMax = props.zoom?.max ?? DEFAULT_ZOOM.max;
    const zStep = props.zoom?.step ?? DEFAULT_ZOOM.step;
    const zInit = props.zoom?.initial ?? DEFAULT_ZOOM.initial;

    const containerRef = useRef<HTMLDivElement>(null);

    const [container, setContainer] = useState<Size>({ width: 0, height: 0 });
    const [natural, setNatural] = useState<Size>({ width: 0, height: 0 });
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(zInit);

    const cropSize = getCropSize(container, aspect, shape);
    const baseScale = getBaseScale(natural, cropSize);
    const display = getDisplaySize(natural, baseScale, zoom);

    const ready = container.width > 0 && natural.width > 0 && cropSize.width > 0;

    // ---- live state mirror for event handlers (avoid stale closures) ----
    const live = useRef({
      crop,
      zoom,
      container,
      natural,
      baseScale,
      cropSize,
      restrictPosition,
      zMin,
      zMax,
    });
    live.current = {
      crop,
      zoom,
      container,
      natural,
      baseScale,
      cropSize,
      restrictPosition,
      zMin,
      zMax,
    };

    const areaRef = useRef<CropArea | null>(null);

    const commit = useCallback(
      (nextCrop: Point, nextZoom: number) => {
        const s = live.current;
        const z = clamp(nextZoom, s.zMin, s.zMax);
        const disp = getDisplaySize(s.natural, s.baseScale, z);
        const c = clampPosition(nextCrop, disp, s.cropSize, s.restrictPosition);
        setZoom(z);
        setCrop(c);
        if (s.natural.width > 0 && s.cropSize.width > 0) {
          const area = getCropAreaPixels(s.natural, c, s.cropSize, s.baseScale, z);
          areaRef.current = area;
          onCropAreaChange?.(area);
        }
      },
      [onCropAreaChange],
    );

    useImperativeHandle(ref, () => ({ getCropArea: () => areaRef.current }), []);

    // ---- measure container ----
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (r) setContainer({ width: r.width, height: r.height });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // ---- load image natural size ----
    useEffect(() => {
      let alive = true;
      const img = new Image();
      img.onload = () => {
        if (alive) setNatural({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = src;
      return () => {
        alive = false;
      };
    }, [src]);

    // ---- re-clamp + emit when geometry settles ----
    useEffect(() => {
      if (ready) commit(live.current.crop, live.current.zoom);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, container.width, container.height, natural.width, natural.height]);

    // ---- pointer gestures (mouse + touch + pinch) ----
    const pointers = useRef<Map<number, Point>>(new Map());
    const rectRef = useRef<DOMRect | null>(null);

    const rel = (clientX: number, clientY: number): Point => {
      const r = rectRef.current;
      return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      rectRef.current = el.getBoundingClientRect();
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const pts = pointers.current;
      if (!pts.has(e.pointerId)) return;
      const prev = [...pts.values()];
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cur = [...pts.values()];
      const s = live.current;

      if (cur.length === 1) {
        const p0 = prev[0];
        const c0 = cur[0];
        if (!p0 || !c0) return;
        commit({ x: s.crop.x + (c0.x - p0.x), y: s.crop.y + (c0.y - p0.y) }, s.zoom);
        return;
      }

      if (cur.length >= 2) {
        const pa = prev[0];
        const pb = prev[1];
        const ca = cur[0];
        const cb = cur[1];
        if (!pa || !pb || !ca || !cb) return;
        const prevDist = distance(pa, pb);
        const curDist = distance(ca, cb);
        if (prevDist === 0) return;
        const k = curDist / prevDist;
        const pm = midpoint(pa, pb);
        const cm = midpoint(ca, cb);
        const prevMid = rel(pm.x, pm.y);
        const curMid = rel(cm.x, cm.y);
        const newZoom = clamp(s.zoom * k, s.zMin, s.zMax);
        const zoomed = zoomToPoint(s.crop, s.zoom, newZoom, curMid, s.container);
        commit(
          { x: zoomed.x + (curMid.x - prevMid.x), y: zoomed.y + (curMid.y - prevMid.y) },
          newZoom,
        );
      }
    };

    const endPointer = (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
    };

    // ---- wheel zoom (non-passive so we can preventDefault) ----
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const s = live.current;
        const r = el.getBoundingClientRect();
        const focal = { x: e.clientX - r.left, y: e.clientY - r.top };
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newZoom = clamp(s.zoom * factor, s.zMin, s.zMax);
        if (newZoom === s.zoom) return;
        commit(zoomToPoint(s.crop, s.zoom, newZoom, focal, s.container), newZoom);
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [commit]);

    // ---- keyboard a11y: arrows pan, +/- zoom ----
    const onKeyDown = (e: React.KeyboardEvent) => {
      const s = live.current;
      const stepPx = e.shiftKey ? 20 : 5;
      switch (e.key) {
        case 'ArrowLeft':
          commit({ x: s.crop.x + stepPx, y: s.crop.y }, s.zoom);
          break;
        case 'ArrowRight':
          commit({ x: s.crop.x - stepPx, y: s.crop.y }, s.zoom);
          break;
        case 'ArrowUp':
          commit({ x: s.crop.x, y: s.crop.y + stepPx }, s.zoom);
          break;
        case 'ArrowDown':
          commit({ x: s.crop.x, y: s.crop.y - stepPx }, s.zoom);
          break;
        case '+':
        case '=':
          commit({ x: s.crop.x, y: s.crop.y }, s.zoom + zStep * 10);
          break;
        case '-':
        case '_':
          commit({ x: s.crop.x, y: s.crop.y }, s.zoom - zStep * 10);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    const onSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      const k = next / zoom;
      commit({ x: crop.x * k, y: crop.y * k }, next);
    };

    const imgStyle: React.CSSProperties = {
      width: `${display.width}px`,
      height: `${display.height}px`,
      left: `${(container.width - display.width) / 2 + crop.x}px`,
      top: `${(container.height - display.height) / 2 + crop.y}px`,
    };

    const windowStyle: React.CSSProperties = {
      width: `${cropSize.width}px`,
      height: `${cropSize.height}px`,
      borderRadius: shape === 'round' ? '50%' : 'var(--rdc-radius-sm)',
    };

    return (
      <div className="rdc-cropper">
        <div
          ref={containerRef}
          className="rdc-cropper__viewport"
          role="slider"
          tabIndex={0}
          aria-label="Crop image — drag to reposition, arrow keys to nudge, +/- to zoom"
          aria-valuenow={Math.round(zoom * 100)}
          aria-valuemin={Math.round(zMin * 100)}
          aria-valuemax={Math.round(zMax * 100)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onKeyDown={onKeyDown}
        >
          {ready && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img className="rdc-cropper__img" src={src} style={imgStyle} draggable={false} alt="" />
          )}
          <div className="rdc-cropper__window" style={windowStyle} data-shape={shape}>
            {grid && <div className="rdc-cropper__grid" aria-hidden="true" />}
          </div>
        </div>
        <div className="rdc-cropper__zoom">
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={zMin}
            max={zMax}
            step={zStep}
            value={zoom}
            onChange={onSlider}
            aria-label="Zoom"
          />
          <span aria-hidden="true">+</span>
        </div>
      </div>
    );
  },
);
