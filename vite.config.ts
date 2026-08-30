import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/klondike-lab/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      manifest: {
        name: 'Klondike Lab',
        short_name: 'Klondike Lab',
        description: 'An offline-first Klondike Solitaire game',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f7a44',
        theme_color: '#0b3d24',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,ttf,webp}'],
        // The Saul Spatz deck is an opt-in alternate card design (default is
        // 'classic', which is plain CSS/text and ships no images at all) —
        // eagerly precaching it would make every first-time visitor download
        // 5MB+ of cards they may never switch to. Excluded here and instead
        // cached on demand below, so the cost is only paid by someone who
        // actually picks this design.
        globIgnores: ['**/cards/saulspatz/**'],
        runtimeCaching: [
          {
            urlPattern: /\/cards\/saulspatz\/.*\.svg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'saulspatz-cards',
              expiration: { maxEntries: 53, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
