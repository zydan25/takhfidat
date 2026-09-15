import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const injectReactEntry = () => ({
  name: 'inject-react-entry-for-build',
  transformIndexHtml: {
    order: 'pre',
    handler(html: string, ctx: { bundle?: unknown }) {
      if (!ctx.bundle) return html;
      const scriptPattern = /<script\s+type="module"[^>]*src="[^"]+"[^>]*><\/script>/i;
      const cssPattern = /<link\s+rel="stylesheet"[^>]*href="[^"]+"[^>]*>/i;
      const withoutLegacyEntries = html
        .replace(scriptPattern, '')
        .replace(cssPattern, '');
      return withoutLegacyEntries.replace(
        '</head>',
        '    <script type="module" src="/src/main.tsx"></script>\n  </head>'
      );
    },
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), injectReactEntry()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/takhfid/api/v2/auth': {
          target: 'https://whats.alattab.site',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/takhfid\/api\/v2\/auth/, '/takhfid/api/v4/auth'),
        },
        '/takhfid': {
          target: 'https://whats.alattab.site',
          changeOrigin: true,
          secure: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
