import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageUploadCrop, type CropResult } from 'react-drop-crop';
import '../src/styles.css';
import './demo.css';

// Demo transport: fake an upload with incremental progress.
async function fakeUpload(
  _file: File,
  { onProgress, signal }: { onProgress: (p: number) => void; signal: AbortSignal },
): Promise<void> {
  for (let p = 0; p <= 100; p += 10) {
    if (signal.aborted) return;
    await new Promise((r) => setTimeout(r, 90));
    onProgress(p);
  }
}

function App(): React.JSX.Element {
  const [last, setLast] = useState<CropResult | null>(null);

  return (
    <main className="demo">
      <h1>react-drop-crop</h1>
      <p className="demo__tagline">Beautiful by default, you bring the upload.</p>

      <section className="demo__panel">
        <h2>Avatar — round, modal, 1:1</h2>
        <ImageUploadCrop
          aspect={1}
          shape="round"
          mode="modal"
          output={{ format: 'webp', quality: 0.9, maxWidth: 1024 }}
          maxSize={5 * 1024 * 1024}
          onSelect={(file) => console.log('selected:', file.name)}
          onCropComplete={(res) => {
            console.log('cropped:', res.file, res.cropArea);
            setLast(res);
          }}
          onUpload={fakeUpload}
          onUploadSuccess={() => console.log('upload done')}
        />
      </section>

      <section className="demo__panel">
        <h2>Inline — frame mode, free aspect</h2>
        <ImageUploadCrop
          mode="inline"
          cropMode="frame"
          shape="rect"
          aspect="free"
          output={{ format: 'webp', quality: 0.9 }}
          onCropComplete={(res) => setLast(res)}
        />
      </section>

      <section className="demo__panel">
        <h2>Inline — rect mode (resize box), 16:9</h2>
        <ImageUploadCrop
          mode="inline"
          cropMode="rect"
          shape="rect"
          aspect={16 / 9}
          output={{ format: 'webp', quality: 0.9 }}
          onCropComplete={(res) => setLast(res)}
        />
      </section>

      {last && (
        <section className="demo__panel">
          <h2>Last crop result</h2>
          <p className="demo__meta">
            {last.file.name} · {(last.file.size / 1024).toFixed(1)} KB · {last.file.type} ·{' '}
            {last.cropArea.width}×{last.cropArea.height}px
          </p>
          <img className="demo__result" src={last.previewUrl} alt="Last crop" />
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
