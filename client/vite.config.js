import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/docs': 'http://localhost:3000',
      '/openapi.json': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
