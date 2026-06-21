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
 * NOTE: EXIF orientation correction is not applied yet (tracked for v1) — phone
 * photos with rotation metadata may crop rotated until that lands.
 */
export async function getCroppedFile(
  originalFile: File,
  src: string,
  cropArea: CropArea,
  output?: OutputOptions,
): Promise<CropResult> {
  const img = await loadImage(src);

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

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Flatten transparency for formats without an alpha channel.
  if (mime === 'image/jpeg') {
    ctx.fillStyle = output?.fillColor ?? '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    targetW,
    targetH,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
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
