import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CropResult,
  ImageUploadError,
  OutputOptions,
  Source,
  UploadController,
  UploadStatus,
} from '../types';
import type { CropperHandle } from '../cropper/types';
import { getCroppedFile } from '../core/getCroppedFile';
import { matchesAccept } from '../core/validate';

export interface UseImageUploadOptions {
  accept: string[];
  sources: Source[];
  disabled: boolean;
  maxSize?: number;
  crop: boolean;
  autoUpload: boolean;
  output?: OutputOptions;
  /** Pre-resolved error/label strings. */
  messages: { wrongType: string; tooLarge: string; uploadFailed: string };
  onUpload?: (file: File, ctrl: UploadController) => Promise<unknown>;
  onSelect?: (file: File) => void;
  onCropComplete?: (result: CropResult) => void;
  onUploadProgress?: (percent: number) => void;
  onUploadSuccess?: (result: unknown) => void;
  onError?: (error: ImageUploadError) => void;
  onRemove?: () => void;
  onStatusChange?: (status: UploadStatus) => void;
}

export interface UseImageUpload {
  status: UploadStatus;
  error: ImageUploadError | null;
  progress: number;
  file: File | null;
  srcUrl: string | null;
  result: CropResult | null;
  cropperRef: React.RefObject<CropperHandle>;
  handleFiles: (files: FileList | null) => void;
  selectFile: (file: File) => void;
  handleSave: () => Promise<CropResult | null>;
  handleRemove: () => void;
  reset: () => void;
  handleImageError: () => void;
}

/**
 * The upload state machine: select -> validate -> crop -> upload, with object-URL
 * lifecycle, abortable transport, and lifecycle callbacks. Pure logic, no markup —
 * this is the seed of the v2 headless `useImageUploadCrop` hook.
 */
export function useImageUpload(opts: UseImageUploadOptions): UseImageUpload {
  const {
    accept,
    sources,
    disabled,
    maxSize,
    crop,
    autoUpload,
    output,
    messages,
    onUpload,
    onSelect,
    onCropComplete,
    onUploadProgress,
    onUploadSuccess,
    onError,
    onRemove,
    onStatusChange,
  } = opts;

  const cropperRef = useRef<CropperHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CropResult | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<ImageUploadError | null>(null);
  const [progress, setProgress] = useState(0);

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

  // Object-URL setters that revoke the previous URL to prevent leaks.
  const setSrc = useCallback((url: string | null) => {
    if (srcUrlRef.current && srcUrlRef.current !== url) {
      URL.revokeObjectURL(srcUrlRef.current);
    }
    srcUrlRef.current = url;
    setSrcUrl(url);
  }, []);

  const setCropResult = useCallback((res: CropResult | null) => {
    const nextUrl = res?.previewUrl ?? null;
    if (resultUrlRef.current && resultUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = nextUrl;
    setResult(res);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSrc(null);
    setCropResult(null);
    setFile(null);
    setError(null);
    setProgress(0);
    setStatus('idle');
  }, [setSrc, setCropResult]);

  // revoke object URLs + abort any in-flight upload on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
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
        fail({ code: 'upload-failed', message: messages.uploadFailed, file: toUpload });
        if (e instanceof Error) console.error('[react-drop-crop] upload failed:', e);
      }
    },
    [onUpload, onUploadProgress, onUploadSuccess, fail, messages.uploadFailed],
  );

  // Core selection: validate one file, then enter the crop (or upload-as-is) flow.
  // `selectFile` is the public/programmatic entry; handleFiles + paste delegate here.
  const selectFile = useCallback(
    (picked: File) => {
      if (disabled) return;

      if (!matchesAccept(picked, accept)) {
        fail({ code: 'invalid-type', message: messages.wrongType, file: picked });
        return;
      }
      if (maxSize != null && picked.size > maxSize) {
        fail({ code: 'file-too-large', message: messages.tooLarge, file: picked });
        return;
      }

      setError(null);
      setFile(picked);
      onSelect?.(picked);

      if (!crop) {
        setStatus('selected');
        if (autoUpload) void runUpload(picked);
        return;
      }

      setSrc(URL.createObjectURL(picked));
      setStatus('cropping');
    },
    [
      accept,
      autoUpload,
      crop,
      disabled,
      fail,
      messages.tooLarge,
      messages.wrongType,
      maxSize,
      onSelect,
      runUpload,
      setSrc,
    ],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const picked = files?.[0];
      if (picked) selectFile(picked);
    },
    [selectFile],
  );

  // Paste support: drop a clipboard image onto the component. Ignored mid-upload.
  const selectFileRef = useRef(selectFile);
  useEffect(() => {
    selectFileRef.current = selectFile;
  }, [selectFile]);

  useEffect(() => {
    if (disabled || !sources.includes('paste') || status === 'uploading') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) selectFileRef.current(f);
          break;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, sources, status]);

  const handleSave = useCallback(async (): Promise<CropResult | null> => {
    if (!file || !srcUrl) return null;
    const area = cropperRef.current?.getCropArea();
    if (!area) return null;
    try {
      const res = await getCroppedFile(file, srcUrl, area, output);
      setCropResult(res);
      onCropComplete?.(res);
      if (onUpload) {
        await runUpload(res.file);
      } else {
        setStatus('success');
      }
      return res;
    } catch (e) {
      fail({ code: 'custom', message: 'Could not process image', file });
      if (e instanceof Error) console.error('[react-drop-crop] crop failed:', e);
      return null;
    }
  }, [file, srcUrl, output, onCropComplete, onUpload, runUpload, fail, setCropResult]);

  const handleRemove = useCallback(() => {
    reset();
    onRemove?.();
  }, [reset, onRemove]);

  // Surface a decode failure (corrupt/unsupported image) instead of a blank cropper.
  const handleImageError = useCallback(() => {
    setSrc(null);
    fail({ code: 'invalid-type', message: messages.wrongType, file: file ?? undefined });
  }, [setSrc, fail, messages.wrongType, file]);

  return {
    status,
    error,
    progress,
    file,
    srcUrl,
    result,
    cropperRef,
    handleFiles,
    selectFile,
    handleSave,
    handleRemove,
    reset,
    handleImageError,
  };
}
