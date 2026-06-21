import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageUploadCrop } from 'react-drop-crop';
import '../src/styles.css';
import './demo.css';

function App(): React.JSX.Element {
  return (
    <main className="demo">
      <h1>react-drop-crop</h1>
      <p className="demo__tagline">Beautiful by default, you bring the upload.</p>

      <section className="demo__panel">
        <h2>Avatar (round, modal) — target case</h2>
        <ImageUploadCrop
          aspect={1}
          shape="round"
          mode="modal"
          output={{ format: 'webp', quality: 0.9, maxWidth: 1024 }}
          maxSize={5 * 1024 * 1024}
          onSelect={(file) => console.log('selected', file.name)}
          onUpload={async (_file, { onProgress }) => {
            // Demo transport: fake progress.
            for (let p = 0; p <= 100; p += 10) {
              await new Promise((r) => setTimeout(r, 80));
              onProgress(p);
            }
          }}
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
