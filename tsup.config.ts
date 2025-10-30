import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],  // Your main entry
    format: ['cjs', 'esm'],   // Dual support
    dts: true,                // Auto .d.ts
    sourcemap: true,
    minify: true,
    clean: true,              // Clean dist/
    splitting: false,         // No code-split for libs
    // React JSX auto-handled!
});