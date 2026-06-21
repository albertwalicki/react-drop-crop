import { useId, useRef, useState } from 'react';
import type { ImageUploadCropProps } from './types';

const DEFAULT_LABELS = {
  dropHere: 'Drag & drop an image, or',
  browse: 'Browse',
} as const;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * react-drop-crop — drop-in image upload + crop.
 *
 * NOTE: this is the scaffolding shell. It currently renders the dropzone and
 * wires file selection. The crop engine (frame model first), output pipeline,
 * progress/states, and modal mode are built on top of this contract next.
 */
export function ImageUploadCrop(props: ImageUploadCropProps): React.JSX.Element {
  const {
    accept = ['image/*'],
    disabled = false,
    theme = 'auto',
    mode = 'inline',
    className,
    classNames,
    labels,
    style,
    onSelect,
    id,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const reactId = useId();
  const rootId = id ?? reactId;
  const l = { ...DEFAULT_LABELS, ...labels };

  function handleFiles(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    setSelectedName(file.name);
    onSelect?.(file);
  }

  return (
    <div
      id={rootId}
      className={cx('rdc-root', className, classNames?.root)}
      data-theme={theme}
      data-mode={mode}
      style={style}
      aria-label={props['aria-label']}
    >
      <div
        className={cx('rdc-dropzone', classNames?.dropzone)}
        data-disabled={disabled || undefined}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
      >
        <p className="rdc-dropzone__hint">{selectedName ?? l.dropHere}</p>
        <button
          type="button"
          className={cx('rdc-button', classNames?.button)}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {l.browse}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
