import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (which sets root to demo/ for the playground) so
// test discovery runs from the repo root against src/.
export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
