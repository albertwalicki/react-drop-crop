import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useImageUpload, type UseImageUploadOptions } from './useImageUpload';
import type { ImageUploadError } from '../types';
import type { CropperHandle } from '../cropper/types';

/** Simulate the cropper reporting a crop area through its imperative ref. */
function attachCropper(ref: React.RefObject<CropperHandle>): void {
  (ref as unknown as MutableRefObject<CropperHandle | null>).current = {
    getCropArea: () => ({ x: 0, y: 0, width: 10, height: 10 }),
  };
}

// getCroppedFile draws to a canvas (unavailable in jsdom) — mock it.
vi.mock('../core/getCroppedFile', () => ({
  getCroppedFile: vi.fn(async (originalFile: File) => ({
    file: new File(['c'], 'cropped.webp', { type: 'image/webp' }),
    previewUrl: 'blob:mock/result',
    cropArea: { x: 0, y: 0, width: 10, height: 10 },
    originalFile,
  })),
}));

function opts(over: Partial<UseImageUploadOptions> = {}): UseImageUploadOptions {
  return {
    accept: ['image/*'],
    sources: ['drop', 'browse', 'paste'],
    disabled: false,
    crop: true,
    autoUpload: false,
    messages: { wrongType: 'wrong', tooLarge: 'big', uploadFailed: 'failed' },
    ...over,
  };
}

function fileList(file: File): FileList {
  return {
    0: file,
    length: 1,
    item: (i: number) => (i === 0 ? file : null),
  } as unknown as FileList;
}

const png = (size = 4) => new File(['x'.repeat(size)], 'a.png', { type: 'image/png' });

describe('useImageUpload', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useImageUpload(opts()));
    expect(result.current.status).toBe('idle');
  });

  it('enters cropping on a valid selection', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ onSelect })));
    act(() => result.current.handleFiles(fileList(png())));
    expect(result.current.status).toBe('cropping');
    expect(result.current.srcUrl).toBeTruthy();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('rejects a wrong type', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ onError })));
    act(() =>
      result.current.handleFiles(fileList(new File(['x'], 'a.txt', { type: 'text/plain' }))),
    );
    expect(result.current.status).toBe('error');
    expect((onError.mock.calls[0]![0] as ImageUploadError).code).toBe('invalid-type');
  });

  it('rejects files over maxSize', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ maxSize: 2, onError })));
    act(() => result.current.handleFiles(fileList(png(10))));
    expect((onError.mock.calls[0]![0] as ImageUploadError).code).toBe('file-too-large');
  });

  it('uploads as-is when crop is false and autoUpload is set', async () => {
    const onUpload = vi.fn(
      async (_f: File, { onProgress }: { onProgress: (p: number) => void }) => {
        onProgress(100);
      },
    );
    const { result } = renderHook(() =>
      useImageUpload(opts({ crop: false, autoUpload: true, onUpload })),
    );
    act(() => result.current.handleFiles(fileList(png())));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(onUpload).toHaveBeenCalledOnce();
  });

  it('crops then uploads via handleSave', async () => {
    const onCropComplete = vi.fn();
    const onUpload = vi.fn(async () => undefined);
    const { result } = renderHook(() => useImageUpload(opts({ onCropComplete, onUpload })));

    act(() => result.current.handleFiles(fileList(png())));
    attachCropper(result.current.cropperRef);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onCropComplete).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('success');
    expect(result.current.result?.file.type).toBe('image/webp');
  });

  it('crops without uploading when no transport is given', async () => {
    const onCropComplete = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ onCropComplete })));
    act(() => result.current.handleFiles(fileList(png())));
    attachCropper(result.current.cropperRef);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onCropComplete).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('success');
  });

  it('resets on remove', () => {
    const onRemove = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ onRemove })));
    act(() => result.current.handleFiles(fileList(png())));
    act(() => result.current.handleRemove());
    expect(result.current.status).toBe('idle');
    expect(result.current.srcUrl).toBeNull();
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('surfaces a decode failure via handleImageError', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useImageUpload(opts({ onError })));
    act(() => result.current.handleFiles(fileList(png())));
    act(() => result.current.handleImageError());
    expect(result.current.status).toBe('error');
    expect((onError.mock.calls[0]![0] as ImageUploadError).code).toBe('invalid-type');
  });
});
