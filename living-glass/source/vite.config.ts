import { defineConfig } from 'vite';

// Relative base so the static build runs from any folder or artifact host.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
