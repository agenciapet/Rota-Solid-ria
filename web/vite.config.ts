import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Em desenvolvimento o front chama /api e o Vite encaminha para a API local.
// Assim um telemóvel na mesma rede Wi-Fi só precisa de abrir http://<ip-do-mac>:5173.
const proxy = { '/api': { target: 'http://localhost:3001', ws: true, rewrite: (p: string) => p.replace(/^\/api/, '') } };

export default defineConfig({
  server: { host: true, proxy },
  preview: { host: true, proxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rota Solidária',
        short_name: 'Rota',
        description: 'Montagem e execução da rota de apoio da Associação',
        lang: 'pt-PT',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O app exige internet: só o "esqueleto" fica em cache; a API e as fotos nunca.
        navigateFallbackDenylist: [/^\/api/, /^\/fotos/],
        runtimeCaching: [],
      },
    }),
  ],
});
