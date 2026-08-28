import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteApiPlugin } from './server/apiPlugin.js';

export default defineConfig({
  plugins: [
    viteApiPlugin(),
    tailwindcss(),
    react(),
  ],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});

