/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' — статический сайт работает из любой подпапки (GitHub Pages / Cloudflare)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Implements: plan://M9#9.1 — PWA (specs/07 §1 offline-first, specs/05 §7)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Hunter English',
        short_name: 'Hunter',
        description: 'Английский с нуля до C1: охота за языком',
        lang: 'ru',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#070b14',
        background_color: '#070b14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // аудио (23 МБ) сознательно НЕ в precache — только runtime-кэш (решение M9#2)
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: (options) => options.url.pathname.includes('/audio/') && options.sameOrigin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: { maxEntries: 10000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      // istanbul: корректный мерж счётчиков между воркерами (v8 last-wins терял
      // покрытие модулей, загруженных в нескольких тест-файлах — M19)
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**'],
      exclude: ['src/test/**', 'src/i18n.ts', 'src/main.tsx'],
      // рейчёт: порог = зафиксированный уровень M19; повышать при добавлении тестов
      thresholds: {
        // веха S4 (план M21#21.4): statements/lines 100%; branches/functions —
        // зафиксированный уровень (остаток — обоснованные istanbul-ignore)
        statements: 100,
        branches: 90,
        functions: 99,
        lines: 100,
      },
    },
  },
})
