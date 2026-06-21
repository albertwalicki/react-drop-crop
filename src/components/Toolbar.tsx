import type { ClassNames, UploadStatus } from '../types';
import { cx } from '../core/cx';
import { ProgressBar } from './ProgressBar';

export interface ToolbarProps {
  labels: { cancel: string; save: string };
  classNames?: ClassNames;
  status: UploadStatus;
  progress: number;
  onCancel: () => void;
  onSave: () => void;
}

export function Toolbar({
  labels,
  classNames,
  status,
  progress,
  onCancel,
  onSave,
}: ToolbarProps): React.JSX.Element {
  const uploading = status === 'uploading';
  return (
    <>
      <div className={cx('rdc-toolbar', classNames?.toolbar)}>
        <button
          type="button"
          className="rdc-button rdc-button--ghost"
          onClick={onCancel}
          disabled={uploading}
        >
          {labels.cancel}
        </button>
        <button type="button" className="rdc-button" onClick={onSave} disabled={uploading}>
          {uploading ? `${Math.round(progress)}%` : labels.save}
        </button>
      </div>
      {uploading && <ProgressBar percent={progress} className={classNames?.progress} />}
    </>
  );
}
