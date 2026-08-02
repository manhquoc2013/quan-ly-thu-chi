import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  css: {
    transformer: 'postcss',
    lightningcss: {
      errorRecovery: true,
    },
  },
  build: {
    cssMinify: 'esbuild',
  },
  resolve: {
    // Prevent "Invalid hook call" from duplicate React copies (Vite prebundle drift)
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      '@': resolve(__dirname, 'src'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@components': resolve(__dirname, 'src/ui/components'),
      '@screens': resolve(__dirname, 'src/ui/screens'),
      '@store': resolve(__dirname, 'src/store'),
      '@services': resolve(__dirname, 'src/services'),
      '@models': resolve(__dirname, 'src/models'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@hooks': resolve(__dirname, 'src/hooks'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
  server: { port: 5173, host: true },
});
