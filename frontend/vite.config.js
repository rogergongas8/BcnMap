import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BCN Live',
        short_name: 'BCN Live',
        description: 'Mapa en temps real de Barcelona amb IA integrada',
        theme_color: '#0a0c10',
        background_color: '#0a0c10',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/(weather|air-quality|bicing|traffic|metro|bus)(\/?$|\?)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'live-data',
              expiration: { maxAgeSeconds: 180, maxEntries: 20 },
            },
          },
          {
            urlPattern: /^https:\/\/(.*\.maptiler\.com|.*\.openstreetmap\.org|.*\.carto\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 7, maxEntries: 500 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
