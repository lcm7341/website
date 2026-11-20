import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // run server/analytics.mjs locally to test tracking and /dev with `npm run dev`
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
})
