import { defineConfig } from 'tsup';

export default defineConfig({
  // Object form pins output names: dist/index.* and dist/styles.css.
  entry: { index: 'src/index.ts', styles: 'src/styles/index.css' },
  format: ['esm', 'cjs'],
  // Generate type declarations only for the JS entry, not the CSS.
  dts: { entry: 'src/index.ts' },
  clean: true,
  treeshake: true,
  sourcemap: true,
  // React is a peer dependency — never bundle it.
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
