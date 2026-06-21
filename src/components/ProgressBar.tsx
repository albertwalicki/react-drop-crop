import { cx } from '../core/cx';

export interface ProgressBarProps {
  percent: number;
  className?: string;
}

export function ProgressBar({ percent, className }: ProgressBarProps): React.JSX.Element {
  return (
    <div
      className={cx('rdc-progress', className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="rdc-progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}
