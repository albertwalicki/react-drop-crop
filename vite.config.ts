import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Demo playground: serves demo/ and resolves the package name to live source
// (src/index.ts) so changes hot-reload without a build step.
export default defineConfig({
  root: 'demo',
  plugins: [react()],
  resolve: {
    alias: {
      'react-drop-crop': resolve(__dirname, 'src/index.ts'),
    },
  },
});
