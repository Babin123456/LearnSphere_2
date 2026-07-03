// vite.config.js – Vite configuration for LearnSphere_2
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // project root
  publicDir: 'public', // static assets folder (if any)
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Preserve the original index.html as entry
      input: './index.html',
    },
  },
  server: {
    open: true,
  },
});
