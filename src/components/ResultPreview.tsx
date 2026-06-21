export interface ResultPreviewProps {
  previewUrl: string;
  removeLabel: string;
  onRemove: () => void;
}

export function ResultPreview({
  previewUrl,
  removeLabel,
  onRemove,
}: ResultPreviewProps): React.JSX.Element {
  return (
    <div className="rdc-preview">
      <img className="rdc-preview__img" src={previewUrl} alt="Cropped result" />
      <button type="button" className="rdc-button rdc-button--ghost" onClick={onRemove}>
        {removeLabel}
      </button>
    </div>
  );
}
