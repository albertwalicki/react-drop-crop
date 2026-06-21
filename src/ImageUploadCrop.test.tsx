import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImageUploadCrop } from './ImageUploadCrop';
import type { ImageUploadError } from './types';

function makeFile(name: string, type: string, size = 4): File {
  const file = new File(['x'.repeat(size)], name, { type });
  return file;
}

/** Drive the hidden file input without userEvent's accept-filtering. */
function selectFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input;
}

describe('ImageUploadCrop', () => {
  it('renders the dropzone with a browse control', () => {
    render(<ImageUploadCrop />);
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
  });

  it('selects a valid image and enters the crop state', () => {
    const onSelect = vi.fn();
    const { container } = render(<ImageUploadCrop onSelect={onSelect} />);
    selectFile(getFileInput(container), makeFile('a.png', 'image/png'));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]![0]).toBeInstanceOf(File);
    // Crop toolbar appears once a file is selected (crop defaults to true).
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('rejects files over maxSize with a file-too-large error', () => {
    const onError = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <ImageUploadCrop maxSize={2} onError={onError} onSelect={onSelect} />,
    );
    selectFile(getFileInput(container), makeFile('big.png', 'image/png', 10));

    expect(onSelect).not.toHaveBeenCalled();
    const err = onError.mock.calls[0]![0] as ImageUploadError;
    expect(err.code).toBe('file-too-large');
  });

  it('rejects a wrong file type', () => {
    const onError = vi.fn();
    const { container } = render(<ImageUploadCrop accept={['image/*']} onError={onError} />);
    selectFile(getFileInput(container), makeFile('notes.txt', 'text/plain'));

    const err = onError.mock.calls[0]![0] as ImageUploadError;
    expect(err.code).toBe('invalid-type');
  });

  it('uploads as-is when crop is false and autoUpload is set', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ImageUploadCrop crop={false} autoUpload onUpload={onUpload} />);
    const file = makeFile('a.png', 'image/png');
    selectFile(getFileInput(container), file);

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(onUpload.mock.calls[0]![0]).toBe(file);
  });

  it('ignores input when disabled', () => {
    const onSelect = vi.fn();
    const { container } = render(<ImageUploadCrop disabled onSelect={onSelect} />);

    expect(screen.getByRole('button', { name: /browse/i })).toBeDisabled();
    selectFile(getFileInput(container), makeFile('a.png', 'image/png'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('handles a dropped file', () => {
    const onSelect = vi.fn();
    const { container } = render(<ImageUploadCrop onSelect={onSelect} />);
    const zone = container.querySelector('.rdc-dropzone')!;
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile('a.png', 'image/png')] } });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('reports status transitions through onStatusChange', () => {
    const onStatusChange = vi.fn();
    const { container } = render(<ImageUploadCrop onStatusChange={onStatusChange} />);
    selectFile(getFileInput(container), makeFile('a.png', 'image/png'));
    expect(onStatusChange).toHaveBeenCalledWith('cropping');
  });
});
