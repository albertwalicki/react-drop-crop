import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type {
  CropResult,
  ImageUploadCropProps,
  ImageUploadError,
  UploadStatus,
} from './types';
import { FrameCropper } from './cropper/FrameCropper';
import { RectCropper } from './cropper/RectCropper';
import type { CropperHandle } from './cropper/types';
import { getCroppedFile } from './output/getCroppedFile';
import { Modal } from './Modal';

const DEFAULT_LABELS = {
  dropHere: 'Drag & drop an image, or',
  browse: 'Browse',
  cropTitle: 'Crop image',
  save: 'Save',
  cancel: 'Cancel',
  retry: 'Retry',
  remove: 'Remove',
  tooLarge: 'File is too large',
  wrongType: 'Unsupported file type',
  uploadFailed: 'Upload failed',
} as const;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function matchesAccept(file: File, accept: string[]): boolean {
  return accept.some((a) => {
    if (a === 'image/*' || a === '*') return file.type.startsWith('image/');
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
    return file.type === a;
  });
}

export function ImageUploadCrop(props: ImageUploadCropProps): React.JSX.Element {
  const {
    accept = ['image/*'],
    sources = ['drop', 'browse', 'paste'],
    disabled = false,
    maxSize,
    crop = true,
    cropMode = 'frame',
    aspect = 'free',
    shape = 'rect',
    zoom,
    grid = true,
    restrictPosition = true,
    output,
    onUpload,
    autoUpload = false,
    mode = 'inline',
    theme = 'auto',
    className,
    classNames,
    labels,
    style,
    onSelect,
    onCropComplete,
    onUploadProgress,
    onUploadSuccess,
    onError,
    onRemove,
    onStatusChange,
    id,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<CropperHandle>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CropResult | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<ImageUploadError | null>(null);
  const [progress, setProgress] = useState(0);

  const reactId = useId();
  const rootId = id ?? reactId;
  const l = { ...DEFAULT_LABELS, ...labels };

  // status change notifications
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const fail = useCallback(
    (err: ImageUploadError) => {
      setError(err);
      setStatus('error');
      onError?.(err);
    },
    [onError],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSrcUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setFile(null);
    setError(null);
    setProgress(0);
    setStatus('idle');
  }, []);

  // revoke object URLs on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runUpload = useCallback(
    async (toUpload: File) => {
      if (!onUpload) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress(0);
      setStatus('uploading');
      try {
        const res = await onUpload(toUpload, {
          onProgress: (p) => {
            setProgress(p);
            onUploadProgress?.(p);
          },
          signal: controller.signal,
        });
        setStatus('success');
        onUploadSuccess?.(res);
      } catch (e) {
        if (controller.signal.aborted) return;
        fail({ code: 'upload-failed', message: l.uploadFailed, file: toUpload });
        // surface underlying error for debugging
        if (e instanceof Error) console.error('[react-drop-crop] upload failed:', e);
      }
    },
    [onUpload, onUploadProgress, onUploadSuccess, fail, l.uploadFailed],
  );

  const handleFilesRef = useRef<((files: FileList | null) => void) | null>(null);

  // Paste support: drop a clipboard image onto the component while it's idle.
  useEffect(() => {
    if (disabled || !sources.includes('paste')) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            handleFilesRef.current?.(dt.files);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, sources]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const picked = files?.[0];
      if (!picked || disabled) return;

      if (!matchesAccept(picked, accept)) {
        fail({ code: 'invalid-type', message: l.wrongType, file: picked });
        return;
      }
      if (maxSize != null && picked.size > maxSize) {
        fail({ code: 'file-too-large', message: l.tooLarge, file: picked });
        return;
      }

      setError(null);
      setFile(picked);
      onSelect?.(picked);

      if (!crop) {
        // Upload-as-is path.
        setStatus('selected');
        if (autoUpload) void runUpload(picked);
        return;
      }

      const url = URL.createObjectURL(picked);
      setSrcUrl(url);
      setStatus('cropping');
    },
    [accept, autoUpload, crop, disabled, fail, l.tooLarge, l.wrongType, maxSize, onSelect, runUpload],
  );
  handleFilesRef.current = handleFiles;

  const handleSave = useCallback(async () => {
    if (!file || !srcUrl) return;
    const area = cropperRef.current?.getCropArea();
    if (!area) return;
    try {
      const res = await getCroppedFile(file, srcUrl, area, output);
      setResult(res);
      onCropComplete?.(res);
      // Once cropped via the toolbar's Save, upload if a transport was provided.
      if (onUpload) {
        await runUpload(res.file);
      } else {
        setStatus('success');
      }
    } catch (e) {
      fail({ code: 'custom', message: 'Could not process image', file });
      if (e instanceof Error) console.error('[react-drop-crop] crop failed:', e);
    }
  }, [file, srcUrl, output, onCropComplete, onUpload, autoUpload, runUpload, fail]);

  const handleRemove = useCallback(() => {
    reset();
    onRemove?.();
  }, [reset, onRemove]);

  const showCropper =
    crop && (status === 'cropping' || status === 'uploading') && srcUrl;
  const showResult = status === 'success' && result;
  const isModal = mode === 'modal';

  const dropzone = (
    <div
      className={cx('rdc-dropzone', classNames?.dropzone)}
      data-disabled={disabled || undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
    >
      <p className="rdc-dropzone__hint">{l.dropHere}</p>
      <button
        type="button"
        className={cx('rdc-button', classNames?.button)}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {l.browse}
      </button>
      {error && status !== 'cropping' && (
        <p className="rdc-error" role="alert">
          {error.message}
        </p>
      )}
      {showResult && (
        <div className="rdc-preview">
          <img className="rdc-preview__img" src={result.previewUrl} alt="Cropped result" />
          <button type="button" className="rdc-button rdc-button--ghost" onClick={handleRemove}>
            {l.remove}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );

  const cropperPanel = showCropper && (
    <div className={cx('rdc-cropper-panel', classNames?.cropper)}>
      {isModal && <h2 className="rdc-cropper-panel__title">{l.cropTitle}</h2>}
      {cropMode === 'rect' ? (
        <RectCropper
          ref={cropperRef}
          src={srcUrl}
          aspect={aspect}
          shape={shape}
          grid={grid}
        />
      ) : (
        <FrameCropper
          ref={cropperRef}
          src={srcUrl}
          aspect={aspect}
          shape={shape}
          zoom={zoom}
          grid={grid}
          restrictPosition={restrictPosition}
        />
      )}
      <div className={cx('rdc-toolbar', classNames?.toolbar)}>
        <button
          type="button"
          className="rdc-button rdc-button--ghost"
          onClick={handleRemove}
          disabled={status === 'uploading'}
        >
          {l.cancel}
        </button>
        <button
          type="button"
          className="rdc-button"
          onClick={() => void handleSave()}
          disabled={status === 'uploading'}
        >
          {status === 'uploading' ? `${Math.round(progress)}%` : l.save}
        </button>
      </div>
      {status === 'uploading' && (
        <div className={cx('rdc-progress', classNames?.progress)} role="progressbar" aria-valuenow={Math.round(progress)}>
          <div className="rdc-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <div
      id={rootId}
      className={cx('rdc-root', className, classNames?.root)}
      data-theme={theme}
      data-mode={mode}
      style={style}
      aria-label={props['aria-label']}
    >
      {dropzone}
      {showCropper &&
        (isModal ? (
          <Modal open onClose={handleRemove} label={l.cropTitle}>
            {cropperPanel}
          </Modal>
        ) : (
          cropperPanel
        ))}
    </div>
  );
}
