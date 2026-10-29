import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    allowedHosts: true,
    proxy: {
      '/auth/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/rest/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/storage/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  }
});
