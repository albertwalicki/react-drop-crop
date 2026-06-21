import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CropArea, CropShape } from '../types';
import type { CropperHandle } from './types';
import type { Size } from './geometry';
import {
  getContainRect,
  HANDLES,
  initialCropRect,
  moveCropRect,
  rectToCropArea,
  resizeCropRect,
  type Handle,
  type Rect,
} from './rectGeometry';

export interface RectCropperProps {
  src: string;
  aspect: number | 'free';
  shape: CropShape;
  grid?: boolean;
  /** Minimum crop size in source-image pixels. */
  minCropWidth?: number;
  minCropHeight?: number;
  onCropAreaChange?: (area: CropArea) => void;
  onImageError?: () => void;
}

const CORNER_HANDLES: Handle[] = ['nw', 'ne', 'se', 'sw'];

export const RectCropper = forwardRef<CropperHandle, RectCropperProps>(
  function RectCropper(props, ref) {
    const {
      src,
      aspect,
      shape,
      grid = true,
      minCropWidth,
      minCropHeight,
      onCropAreaChange,
      onImageError,
    } = props;
    const effectiveAspect = shape === 'round' ? 1 : aspect;

    const viewportRef = useRef<HTMLDivElement>(null);
    const [container, setContainer] = useState<Size>({ width: 0, height: 0 });
    const [natural, setNatural] = useState<Size>({ width: 0, height: 0 });
    const [crop, setCrop] = useState<Rect | null>(null);

    const contain = getContainRect(natural, container);
    const display: Size = { width: contain.width, height: contain.height };
    const ready = display.width > 0 && natural.width > 0;

    // min size in display px (default to a small grabbable minimum)
    const minW = Math.max(16, (minCropWidth ?? 0) / (contain.scale || 1));
    const minH = Math.max(16, (minCropHeight ?? 0) / (contain.scale || 1));

    const areaRef = useRef<CropArea | null>(null);
    const live = useRef({
      display,
      scale: contain.scale,
      natural,
      crop,
      effectiveAspect,
      minW,
      minH,
    });
    live.current = { display, scale: contain.scale, natural, crop, effectiveAspect, minW, minH };

    const commit = useCallback(
      (rect: Rect) => {
        setCrop(rect);
        const s = live.current;
        const area = rectToCropArea(rect, s.scale, s.natural);
        areaRef.current = area;
        onCropAreaChange?.(area);
      },
      [onCropAreaChange],
    );

    useImperativeHandle(ref, () => ({ getCropArea: () => areaRef.current }), []);

    useEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (r) setContainer({ width: r.width, height: r.height });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      let alive = true;
      const img = new Image();
      img.onload = () => {
        if (alive) setNatural({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        if (alive) onImageError?.();
      };
      img.src = src;
      return () => {
        alive = false;
      };
    }, [src, onImageError]);

    // Initialize / rescale the crop box as geometry settles.
    const prevDisplay = useRef<Size>({ width: 0, height: 0 });
    useEffect(() => {
      if (!ready) return;
      const prev = prevDisplay.current;
      if (!crop || prev.width === 0) {
        commit(initialCropRect(display, effectiveAspect));
      } else if (prev.width !== display.width || prev.height !== display.height) {
        const sx = display.width / prev.width;
        const sy = display.height / prev.height;
        commit({
          x: crop.x * sx,
          y: crop.y * sy,
          width: crop.width * sx,
          height: crop.height * sy,
        });
      }
      prevDisplay.current = display;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, display.width, display.height, effectiveAspect]);

    // ---- drag (interior move + handle resize) ----
    const drag = useRef<{ handle: Handle | 'move'; start: Rect; px: number; py: number } | null>(
      null,
    );

    const onPointerDown = (e: React.PointerEvent) => {
      const el = viewportRef.current;
      const s = live.current;
      if (!el || !s.crop) return;
      const target = e.target as HTMLElement;
      const handle = target.dataset.handle as Handle | undefined;
      const isCropBox = target.dataset.cropbox === 'true';
      if (!handle && !isCropBox) return;
      el.setPointerCapture(e.pointerId);
      drag.current = {
        handle: handle ?? 'move',
        start: s.crop,
        px: e.clientX,
        py: e.clientY,
      };
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const s = live.current;
      const dx = e.clientX - d.px;
      const dy = e.clientY - d.py;
      const next =
        d.handle === 'move'
          ? moveCropRect(d.start, dx, dy, s.display)
          : resizeCropRect(d.start, d.handle, dx, dy, {
              aspect: s.effectiveAspect,
              minWidth: s.minW,
              minHeight: s.minH,
              bounds: s.display,
            });
      commit(next);
    };

    const endDrag = () => {
      drag.current = null;
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      const s = live.current;
      if (!s.crop) return;
      const step = e.shiftKey ? 20 : 5;
      switch (e.key) {
        case 'ArrowLeft':
          commit(moveCropRect(s.crop, -step, 0, s.display));
          break;
        case 'ArrowRight':
          commit(moveCropRect(s.crop, step, 0, s.display));
          break;
        case 'ArrowUp':
          commit(moveCropRect(s.crop, 0, -step, s.display));
          break;
        case 'ArrowDown':
          commit(moveCropRect(s.crop, 0, step, s.display));
          break;
        case '+':
        case '=':
        case '-':
        case '_': {
          const grow = e.key === '+' || e.key === '=' ? 10 : -10;
          commit(
            resizeCropRect(s.crop, 'se', grow, grow, {
              aspect: s.effectiveAspect,
              minWidth: s.minW,
              minHeight: s.minH,
              bounds: s.display,
            }),
          );
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    };

    const handles = effectiveAspect === 'free' ? HANDLES : CORNER_HANDLES;

    return (
      <div className="rdc-cropper">
        <div
          ref={viewportRef}
          className="rdc-cropper__viewport rdc-cropper__viewport--rect"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {ready && (
            <img
              className="rdc-cropper__img"
              src={src}
              style={{
                width: `${display.width}px`,
                height: `${display.height}px`,
                left: `${contain.offsetX}px`,
                top: `${contain.offsetY}px`,
              }}
              draggable={false}
              alt=""
            />
          )}
          {ready && crop && (
            <div
              className="rdc-rect"
              data-cropbox="true"
              data-shape={shape}
              role="slider"
              tabIndex={0}
              aria-label="Crop selection — drag to move, handles to resize, arrow keys to nudge"
              aria-valuenow={Math.round(crop.width)}
              onKeyDown={onKeyDown}
              style={{
                left: `${contain.offsetX + crop.x}px`,
                top: `${contain.offsetY + crop.y}px`,
                width: `${crop.width}px`,
                height: `${crop.height}px`,
                borderRadius: shape === 'round' ? '50%' : '0',
              }}
            >
              {grid && shape !== 'round' && (
                <div className="rdc-cropper__grid" aria-hidden="true" />
              )}
              {handles.map((h) => (
                <span key={h} data-handle={h} className={`rdc-handle rdc-handle--${h}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);
