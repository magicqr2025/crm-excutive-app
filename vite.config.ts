import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // The bundle ships inside the Capacitor app and loads from the device, so its
    // size costs no download time; splitting it would only add a load flash per page.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 4000,
  },
})
