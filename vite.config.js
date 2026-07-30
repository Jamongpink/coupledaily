import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa/source-screen-icon.png',
        'pwa/screen-heart-v2-apple.png',
      ],
      manifest: {
        name: 'CoupleDaily - 우리의 하루',
        short_name: 'CoupleDaily',
        description: '커플의 식단, 일정, 목표와 일기를 함께 기록하는 공간',
        theme_color: '#4f9c87',
        background_color: '#fbfaf5',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'ko-KR',
        categories: ['lifestyle', 'productivity'],
        icons: [
          {
            src: '/pwa/screen-heart-v2-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa/screen-heart-v2-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa/screen-heart-v2-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
