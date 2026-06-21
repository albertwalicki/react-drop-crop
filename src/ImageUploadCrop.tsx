import { forwardRef, useId, useImperativeHandle } from 'react';
import type { ImageUploadCropHandle, ImageUploadCropProps } from './types';
import { useImageUpload } from './hooks/useImageUpload';
import { Dropzone } from './components/Dropzone';
import { Toolbar } from './components/Toolbar';
import { ResultPreview } from './components/ResultPreview';
import { Modal } from './components/Modal';
import { FrameCropper } from './cropper/FrameCropper';
import { RectCropper } from './cropper/RectCropper';
import { cx } from './core/cx';

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

export const ImageUploadCrop = forwardRef<ImageUploadCropHandle, ImageUploadCropProps>(
  function ImageUploadCrop(props, ref): React.JSX.Element {
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

    const reactId = useId();
    const rootId = id ?? reactId;
    const l = { ...DEFAULT_LABELS, ...labels };

    const {
      status,
      error,
      progress,
      srcUrl,
      result,
      cropperRef,
      handleFiles,
      selectFile,
      handleSave,
      handleRemove,
      reset,
      handleImageError,
    } = useImageUpload({
      accept,
      sources,
      disabled,
      maxSize,
      crop,
      autoUpload,
      output,
      messages: { wrongType: l.wrongType, tooLarge: l.tooLarge, uploadFailed: l.uploadFailed },
      onUpload,
      onSelect,
      onCropComplete,
      onUploadProgress,
      onUploadSuccess,
      onError,
      onRemove,
      onStatusChange,
    });

    useImperativeHandle(
      ref,
      () => ({
        submit: handleSave,
        selectFile,
        getCropArea: () => cropperRef.current?.getCropArea() ?? null,
        reset,
      }),
      [handleSave, selectFile, reset, cropperRef],
    );

    const showCropper = crop && (status === 'cropping' || status === 'uploading') && srcUrl;
    const showResult = status === 'success' && result;
    const isModal = mode === 'modal';

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
            onImageError={handleImageError}
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
            onImageError={handleImageError}
          />
        )}
        <Toolbar
          labels={{ cancel: l.cancel, save: l.save }}
          classNames={classNames}
          status={status}
          progress={progress}
          onCancel={handleRemove}
          onSave={() => void handleSave()}
        />
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
        <Dropzone
          accept={accept}
          disabled={disabled}
          labels={{ dropHere: l.dropHere, browse: l.browse }}
          classNames={classNames}
          onFiles={handleFiles}
        >
          {error && status !== 'cropping' && (
            <p className="rdc-error" role="alert">
              {error.message}
            </p>
          )}
          {showResult && (
            <ResultPreview
              previewUrl={result.previewUrl}
              removeLabel={l.remove}
              onRemove={handleRemove}
            />
          )}
        </Dropzone>
        {showCropper &&
          (isModal ? (
            <Modal open onClose={handleRemove} label={l.cropTitle} theme={theme}>
              {cropperPanel}
            </Modal>
          ) : (
            cropperPanel
          ))}
      </div>
    );
  },
);
