import { useRef, useState } from 'react';
import type { ClassNames } from '../types';
import { cx } from '../core/cx';

export interface DropzoneProps {
  accept: string[];
  disabled: boolean;
  labels: { dropHere: string; browse: string };
  classNames?: ClassNames;
  onFiles: (files: FileList | null) => void;
  /** Extra content rendered inside the dropzone (e.g. error, result preview). */
  children?: React.ReactNode;
}

function isFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function Dropzone({
  accept,
  disabled,
  labels,
  classNames,
  onFiles,
  children,
}: DropzoneProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  // Depth counter so dragging over child elements doesn't flip the state off
  // (dragenter/dragleave fire as the pointer crosses children).
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cx('rdc-dropzone', classNames?.dropzone)}
      data-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      onDragEnter={(e) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        if (disabled) return;
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
    >
      <p className="rdc-dropzone__hint">{labels.dropHere}</p>
      <button
        type="button"
        className={cx('rdc-button', classNames?.button)}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {labels.browse}
      </button>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
