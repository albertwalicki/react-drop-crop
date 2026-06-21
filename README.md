# react-drop-crop

> **Beautiful by default, you bring the upload.**

A drop-in **React image upload + crop** component. Drag-drop → crop → ready-to-upload file, with progress and states. The library owns the UX (dropzone, cropper, progress, modal); **you own the network transport** via a callback — S3, presigned URLs, auth, whatever.

<p align="center">
  <img src="./assets/demo.gif" alt="react-drop-crop: drop an image, crop it in a modal, save with an upload progress bar" width="520" />
</p>

[![npm](https://img.shields.io/npm/v/react-drop-crop.svg)](https://www.npmjs.com/package/react-drop-crop)
[![CI](https://github.com/albertwalicki/react-drop-crop/actions/workflows/ci.yml/badge.svg)](https://github.com/albertwalicki/react-drop-crop/actions/workflows/ci.yml)
[![minzip](https://img.shields.io/bundlephobia/minzip/react-drop-crop.svg)](https://bundlephobia.com/package/react-drop-crop)
[![license](https://img.shields.io/npm/l/react-drop-crop.svg)](./LICENSE)

## Features

- ✂️ **Own crop engine, zero runtime dependencies** — mouse + touch + pinch + wheel + keyboard
- 🪟 **Two crop modes** — `frame` (pan/zoom under a fixed window, great for avatars) and `rect` (resize-selection-box)
- 🖼️ **Output pipeline** — WebP by default, downscaling, EXIF orientation fix, transparency flattening
- 🔌 **Bring-your-own upload** — you provide transport; the component renders progress, cancel, and states
- 🎨 **Themeable** — vanilla CSS custom properties, light / dark / auto, per-part `classNames`
- ♿ **Accessible** — keyboard-drivable croppers, focus-trapped modal, ARIA
- 🧩 **TypeScript-first**, inline + modal, i18n labels, imperative `ref` handle

## Install

```bash
npm install react-drop-crop
```

```tsx
import { ImageUploadCrop } from 'react-drop-crop';
import 'react-drop-crop/styles.css';
```

> Requires React 18+ (peer dependency). Ships ESM + CJS + type declarations.

## Quick start

The avatar case — round crop in a modal, WebP output, with your upload:

```tsx
<ImageUploadCrop
  aspect={1}
  shape="round"
  mode="modal"
  output={{ format: 'webp', quality: 0.9, maxWidth: 1024 }}
  maxSize={5 * 1024 * 1024}
  onUpload={async (file, { onProgress, signal }) => {
    await myUpload(file, onProgress, signal); // you transport; we show progress + states
  }}
/>
```

Don't pass `onUpload` and it's a **pure cropper** — it just hands you the cropped file:

```tsx
<ImageUploadCrop onCropComplete={(result) => console.log(result.file)} />
```

## Recipes

### Upload to S3 / a presigned URL (with progress)

`fetch` can't report upload progress, so use `XMLHttpRequest` and wire it to the
`onProgress` / `signal` you're handed:

```tsx
function uploadToUrl(url: string) {
  return (file: File, { onProgress, signal }: UploadController) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Network error'));
      signal.addEventListener('abort', () => xhr.abort());
      xhr.send(file);
    });
}

<ImageUploadCrop aspect={1} shape="round" mode="modal" onUpload={uploadToUrl(presignedUrl)} />;
```

### Inline gallery cropper (rect mode)

```tsx
<ImageUploadCrop
  mode="inline"
  cropMode="rect"
  aspect={16 / 9}
  output={{ format: 'webp', maxWidth: 1920 }}
  onCropComplete={({ file }) => addToGallery(file)}
/>
```

### Drive it from your own form (imperative handle)

```tsx
const ref = useRef<ImageUploadCropHandle>(null);

<form
  onSubmit={async (e) => {
    e.preventDefault();
    await ref.current?.submit(); // crop (+ upload if onUpload is set)
  }}
>
  <ImageUploadCrop ref={ref} aspect={1} shape="round" onUpload={myUpload} />
  <button type="submit">Save profile</button>
</form>;
```

## Props

| Prop                                 | Type                                  | Default                      | Description                                             |
| ------------------------------------ | ------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| `accept`                             | `string[]`                            | `['image/*']`                | Accepted MIME types / extensions                        |
| `sources`                            | `('drop' \| 'browse' \| 'paste')[]`   | all three                    | Enabled input methods                                   |
| `disabled`                           | `boolean`                             | `false`                      | Disable all input                                       |
| `maxSize`                            | `number`                              | —                            | Max file size in bytes                                  |
| `crop`                               | `boolean`                             | `true`                       | `false` uploads/returns the file as-is                  |
| `cropMode`                           | `'frame' \| 'rect'`                   | `'frame'`                    | Pan/zoom window vs. resize-selection-box                |
| `aspect`                             | `number \| 'free'`                    | `'free'`                     | Aspect ratio (e.g. `1`, `16/9`)                         |
| `shape`                              | `'rect' \| 'round'`                   | `'rect'`                     | `'round'` for avatars (forces 1:1)                      |
| `zoom`                               | `{ min?; max?; step?; initial? }`     | `{1, 3, 0.01, 1}`            | `frame` zoom bounds                                     |
| `grid`                               | `boolean`                             | `true`                       | Rule-of-thirds overlay                                  |
| `restrictPosition`                   | `boolean`                             | `true`                       | Keep the image covering the crop window (`frame`)       |
| `output`                             | `OutputOptions`                       | `{ format: 'webp', q: 0.9 }` | Format, quality, max dims, fill color, file name        |
| `onUpload`                           | `(file, ctrl) => Promise<unknown>`    | —                            | Your transport. Omit for a pure cropper                 |
| `autoUpload`                         | `boolean`                             | `false`                      | Upload immediately after crop (for `crop: false` flows) |
| `mode`                               | `'inline' \| 'modal'`                 | `'inline'`                   | Presentation                                            |
| `theme`                              | `'light' \| 'dark' \| 'auto'`         | `'auto'`                     | Color theme                                             |
| `className` / `style` / `classNames` | `string` / `CSSProperties` / per-part | —                            | Styling overrides                                       |
| `labels`                             | `Partial<Labels>`                     | English                      | i18n strings                                            |

**Callbacks:** `onSelect`, `onCropComplete`, `onUploadProgress`, `onUploadSuccess`, `onError`, `onRemove`, `onStatusChange`.

### `OutputOptions`

| Field       | Type                                      | Default  |
| ----------- | ----------------------------------------- | -------- |
| `format`    | `'webp' \| 'jpeg' \| 'png' \| 'original'` | `'webp'` |
| `quality`   | `number` (0–1)                            | `0.9`    |
| `maxWidth`  | `number`                                  | —        |
| `maxHeight` | `number`                                  | —        |
| `fillColor` | `string` (jpeg transparency flattening)   | `#fff`   |
| `fileName`  | `string \| (original) => string`          | derived  |

### `CropResult` (passed to `onCropComplete`)

```ts
interface CropResult {
  file: File; // ready-to-upload, in the chosen format
  previewUrl: string; // object URL for preview
  cropArea: { x: number; y: number; width: number; height: number }; // source pixels
  originalFile: File;
}
```

## Imperative handle

Attach a `ref` typed `ImageUploadCropHandle` to control the component:

| Method             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `submit()`         | Crop (and upload if `onUpload` is set); returns result |
| `selectFile(file)` | Provide a `File` programmatically (bypass the picker)  |
| `getCropArea()`    | Current crop rect in source pixels, or `null`          |
| `reset()`          | Clear back to idle                                     |

## Theming

Override any `--rdc-*` custom property (scope to `.rdc-root` or a parent). Dark mode follows `theme`.

```css
.rdc-root {
  --rdc-accent: #16a34a;
  --rdc-radius: 16px;
}
```

| Token                                 | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `--rdc-bg` / `--rdc-fg`               | Surface / text                |
| `--rdc-muted`                         | Secondary text                |
| `--rdc-border` / `--rdc-border-hover` | Borders                       |
| `--rdc-accent` / `--rdc-accent-fg`    | Primary action color          |
| `--rdc-dropzone-bg`                   | Dropzone background           |
| `--rdc-overlay`                       | Modal backdrop / crop dimming |
| `--rdc-radius` / `--rdc-radius-sm`    | Corner radii                  |
| `--rdc-gap` / `--rdc-pad`             | Spacing                       |

For deeper changes, target parts via `classNames`: `root`, `dropzone`, `cropper`, `toolbar`, `progress`, `preview`, `button`.

## Notes & browser support

- **WebP** is the default output and is encoded in all current browsers. Some upload backends reject `image/webp` — set `output.format` to `'jpeg'`/`'png'` if needed.
- **EXIF orientation** is applied on decode, so rotated phone photos crop upright.
- **`shape="round"`** produces a genuinely circular image with transparent corners (webp/png); for jpeg the corners are filled with `output.fillColor`.
- Targets modern evergreen browsers (uses Pointer Events, `createImageBitmap`, `color-mix`).

## License

MIT © [Albert Walicki](https://github.com/albertwalicki)
