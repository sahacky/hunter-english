import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — статический сайт работает из любой подпапки (GitHub Pages / Cloudflare)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
