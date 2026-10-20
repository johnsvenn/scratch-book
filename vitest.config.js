import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});
