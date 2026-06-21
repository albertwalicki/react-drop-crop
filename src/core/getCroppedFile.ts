import type { CropArea, CropResult, OutputFormat, OutputOptions } from '../types';

const MIME: Record<Exclude<OutputFormat, 'original'>, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = src;
  });
}

interface OrientedSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

/**
 * Decode the image with EXIF orientation already applied, so phone photos crop
 * upright. `createImageBitmap(..., { imageOrientation: 'from-image' })` returns
 * a bitmap whose dimensions match the auto-oriented <img> the cropper displays,
 * keeping crop coordinates consistent. Falls back to a plain <img> decode
 * (browsers auto-orient <img> via the default image-orientation: from-image).
 */
async function loadOriented(file: File, src: string): Promise<OrientedSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // fall through to <img> decode
    }
  }
  const img = await loadImage(src);
  return { source: img, width: img.naturalWidth, height: img.naturalHeight };
}

function resolveFileName(
  output: OutputOptions | undefined,
  originalName: string,
  mime: string,
): string {
  const ext = EXT[mime] ?? 'png';
  const fn = output?.fileName;
  if (typeof fn === 'string') return fn;
  if (typeof fn === 'function') return fn(originalName);
  const base = originalName.replace(/\.[^./\\]+$/, '') || 'image';
  return `${base}.${ext}`;
}

/**
 * Crop `cropArea` (source pixels) out of the original file, optionally
 * downscale to `output.maxWidth/maxHeight`, encode to the chosen format, and
 * return a ready-to-upload File plus an object URL for preview.
 *
 * EXIF orientation is applied during decode (see `loadOriented`), so rotated
 * phone photos crop upright.
 */
export async function getCroppedFile(
  originalFile: File,
  src: string,
  cropArea: CropArea,
  output?: OutputOptions,
  /** Mask the output to a circle (transparent corners for webp/png). */
  circular = false,
): Promise<CropResult> {
  const oriented = await loadOriented(originalFile, src);

  const format = output?.format ?? 'webp';
  const mime = format === 'original' ? originalFile.type || 'image/png' : MIME[format];
  const quality = output?.quality ?? 0.9;

  // Target size: crop dimensions, downscaled to fit max bounds.
  let targetW = cropArea.width;
  let targetH = cropArea.height;
  const scale = Math.min(
    1,
    output?.maxWidth ? output.maxWidth / targetW : 1,
    output?.maxHeight ? output.maxHeight / targetH : 1,
  );
  targetW = Math.max(1, Math.round(targetW * scale));
  targetH = Math.max(1, Math.round(targetH * scale));

  // Browsers silently fail toBlob past their canvas limits (~16k px / area caps).
  // Clamp very large outputs so encoding never silently returns null.
  const MAX_CANVAS_DIM = 8192;
  const safety = Math.min(1, MAX_CANVAS_DIM / targetW, MAX_CANVAS_DIM / targetH);
  if (safety < 1) {
    targetW = Math.max(1, Math.round(targetW * safety));
    targetH = Math.max(1, Math.round(targetH * safety));
    console.warn(
      `[react-drop-crop] output exceeded ${MAX_CANVAS_DIM}px and was downscaled; set output.maxWidth/maxHeight to control this.`,
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Flatten transparency for formats without an alpha channel. (Done before the
  // circular clip so a round jpeg gets solid corners rather than black ones.)
  if (mime === 'image/jpeg') {
    ctx.fillStyle = output?.fillColor ?? '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // Round shape: clip to an inscribed ellipse so corners are transparent
  // (webp/png) or the fill color (jpeg).
  if (circular) {
    ctx.beginPath();
    ctx.ellipse(targetW / 2, targetH / 2, targetW / 2, targetH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    oriented.source,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    targetW,
    targetH,
  );
  oriented.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error('Canvas export failed (toBlob returned null)');

  const fileName = resolveFileName(output, originalFile.name, blob.type || mime);
  const file = new File([blob], fileName, { type: blob.type || mime });

  return {
    file,
    previewUrl: URL.createObjectURL(file),
    cropArea,
    originalFile,
  };
}
