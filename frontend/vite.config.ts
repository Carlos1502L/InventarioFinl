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
  build: {
    chunkSizeWarningLimit: 450,
    modulePreload: {
      filter(filename) {
        // Exclude vendor-qr and on-demand heavy modules from entry modulepreload (REQ-05)
        if (/vendor-qr|qrcode|html5-qrcode/i.test(filename)) {
          return false;
        }
        return true;
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-idb': ['idb'],
          'vendor-icons': ['lucide-react'],
          'vendor-qr': ['html5-qrcode', 'qrcode']
        }
      }
    }
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
