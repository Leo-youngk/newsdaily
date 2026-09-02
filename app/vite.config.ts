import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端部署到 Cloudflare Pages，通过 VITE_API_BASE 指向 Worker
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
});
