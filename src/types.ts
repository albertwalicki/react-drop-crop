import type { CSSProperties, HTMLAttributes, InputHTMLAttributes } from 'react';

/** Where an image can come from. `camera` / `url` arrive in a later version. */
export type Source = 'drop' | 'browse' | 'paste';

/** Crop window shape. `round` is the avatar case. */
export type CropShape = 'rect' | 'round';

/** Output encoding. `original` passes the source bytes through untouched. */
export type OutputFormat = 'webp' | 'jpeg' | 'png' | 'original';

/** Inline (in the page flow) vs modal (overlay) presentation. */
export type Mode = 'inline' | 'modal';

export type Theme = 'light' | 'dark' | 'auto';

/**
 * Two interaction models:
 * - `rect`  — fixed image, user drags/resizes a crop rectangle over it.
 * - `frame` — fixed crop window, user pans + pinch/wheel-zooms the image beneath.
 */
export type CropMode = 'rect' | 'frame';

export type UploadStatus =
  | 'idle'
  | 'selected'
  | 'cropping'
  | 'uploading'
  | 'success'
  | 'error';

export interface OutputOptions {
  /** Default `'webp'`. */
  format?: OutputFormat;
  /** 0..1, default `0.9`. Ignored for `png`. */
  quality?: number;
  /** Downscale cap — the longest output edge will not exceed these. */
  maxWidth?: number;
  maxHeight?: number;
  /** Background used when flattening transparency to a format without alpha (jpeg). */
  fillColor?: string;
  /** Output file name, or a mapper from the original name. */
  fileName?: string | ((original: string) => string);
}

/** Handed to `onUpload` so the consumer can report progress and be cancelled. */
export interface UploadController {
  /** Report transfer progress, 0..100. Drives the progress bar. */
  onProgress: (percent: number) => void;
  /** Wired to the cancel button. Abort your request when this fires. */
  signal: AbortSignal;
}

/** Crop rectangle in pixels of the source image. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  /** Ready-to-upload file, encoded in the chosen output format. */
  file: File;
  /** Object URL for previewing `file`. Revoke it when you're done. */
  previewUrl: string;
  /** Where the crop was taken from, in source-image pixels. */
  cropArea: CropArea;
  /** The untouched file the user selected. */
  originalFile: File;
}

export type ImageUploadErrorCode =
  | 'file-too-large'
  | 'invalid-type'
  | 'dimensions'
  | 'upload-failed'
  | 'custom';

export interface ImageUploadError {
  code: ImageUploadErrorCode;
  message: string;
  file?: File;
}

/** Override the zoom behaviour of the `frame` cropper. */
export interface ZoomOptions {
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
}

/** Per-part `className` overrides. */
export type ClassNames = Partial<
  Record<
    'root' | 'dropzone' | 'cropper' | 'toolbar' | 'progress' | 'preview' | 'button',
    string
  >
>;

/** i18n labels (English defaults are provided). */
export type Labels = Partial<
  Record<
    | 'dropHere'
    | 'browse'
    | 'cropTitle'
    | 'save'
    | 'cancel'
    | 'retry'
    | 'remove'
    | 'tooLarge'
    | 'wrongType'
    | 'uploadFailed',
    string
  >
>;

export interface ImageUploadCropProps {
  // ---- Source / input -------------------------------------
  /** Accepted MIME types. Default `['image/*']`. */
  accept?: string[];
  /** Enabled input sources. Default `['drop', 'browse', 'paste']`. */
  sources?: Source[];
  disabled?: boolean;

  // ---- Validation -----------------------------------------
  /** Max file size in bytes. */
  maxSize?: number;

  // ---- Crop -----------------------------------------------
  /** Enable cropping. Default `true`; `false` uploads the file as-is. */
  crop?: boolean;
  /** Interaction model. Default `'frame'`. */
  cropMode?: CropMode;
  /** Aspect ratio, e.g. `1` or `16 / 9`. Default `'free'`. */
  aspect?: number | 'free';
  /** Crop window shape. Default `'rect'`. */
  shape?: CropShape;
  zoom?: ZoomOptions;
  /** Rule-of-thirds overlay. Default `true`. */
  grid?: boolean;
  /** Keep the image within the crop bounds. Default `true`. */
  restrictPosition?: boolean;

  // ---- Output ---------------------------------------------
  output?: OutputOptions;

  // ---- Upload (bring-your-own transport) ------------------
  onUpload?: (file: File, ctrl: UploadController) => Promise<unknown>;
  /** Upload immediately after crop, or wait for a "Save" action. Default `false`. */
  autoUpload?: boolean;

  // ---- Presentation ---------------------------------------
  /** Default `'inline'`. */
  mode?: Mode;
  /** Controlled open state for `mode="modal"`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default `'auto'`. */
  theme?: Theme;

  // ---- Styling / customization ----------------------------
  className?: string;
  style?: CSSProperties;
  classNames?: ClassNames;
  labels?: Labels;

  // ---- Lifecycle callbacks --------------------------------
  /** Raw file picked, before cropping. */
  onSelect?: (file: File) => void;
  /** Cropped file ready. */
  onCropComplete?: (result: CropResult) => void;
  onUploadProgress?: (percent: number) => void;
  onUploadSuccess?: (result: unknown) => void;
  onError?: (error: ImageUploadError) => void;
  onRemove?: () => void;
  onStatusChange?: (status: UploadStatus) => void;

  // ---- a11y -----------------------------------------------
  id?: string;
  'aria-label'?: string;
}

/** Props returned by the (v2) headless hook for the root element. */
export type RootProps = HTMLAttributes<HTMLElement>;
/** Props returned by the (v2) headless hook for the file input. */
export type FileInputProps = InputHTMLAttributes<HTMLInputElement>;
