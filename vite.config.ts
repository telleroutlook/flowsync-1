import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        host: '0.0.0.0',
        proxy: {
          '/api': 'http://127.0.0.1:8788',
        },
      },
      test: {
        environment: 'jsdom',
        setupFiles: './src/test/setupTests.ts',
        exclude: ['dist/**', 'dist-server/**', 'node_modules/**'],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('jspdf-autotable')) return 'jspdf-autotable';
              if (id.includes('jspdf')) return 'jspdf';
              if (id.includes('html2canvas')) return 'html2canvas';
              if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('purify')) {
                return 'markdown';
              }
              if (id.includes('framer-motion')) return 'motion';
              if (
                id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/scheduler/') ||
                id.includes('/node_modules/use-sync-external-store/') ||
                id.includes('/node_modules/react-is/')
              ) {
                return 'react';
              }
              return 'vendor';
            },
          },
        },
      },
    };
});
