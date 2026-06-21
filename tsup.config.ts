import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styles.css'],
  format: ['esm', 'cjs'],
  // Generate type declarations only for the JS entry, not the CSS.
  dts: { entry: 'src/index.ts' },
  clean: true,
  treeshake: true,
  sourcemap: true,
  // React is a peer dependency — never bundle it.
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
