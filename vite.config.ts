import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * WhatsApp necesita la URL completa en og:image. En Vercel se toma sola del
 * dominio de producción; también se puede fijar con VITE_SITE_URL.
 */
function urlSitio(): Plugin {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = (process.env.VITE_SITE_URL || (vercel ? `https://${vercel}` : '')).replace(/\/$/, '');
  return {
    name: 'url-sitio',
    transformIndexHtml: (html) => html.replaceAll('__SITIO__', base),
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), urlSitio()],
});
