import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GH_PAGES ? '/LocMediaStream/' : '/',
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5001'
    }
  }
});
