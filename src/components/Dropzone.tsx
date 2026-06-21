import { useRef } from 'react';
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

export function Dropzone({
  accept,
  disabled,
  labels,
  classNames,
  onFiles,
  children,
}: DropzoneProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cx('rdc-dropzone', classNames?.dropzone)}
      data-disabled={disabled || undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(e.dataTransfer.files);
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
