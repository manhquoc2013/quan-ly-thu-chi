import { readFileSync } from 'fs';
import { defineConfig, type Connect, type Plugin, type ProxyOptions, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

const KILO_UPSTREAM = 'https://api.kilo.ai/api/gateway';

const kiloProxyOptions: ProxyOptions = {
  target: 'https://api.kilo.ai',
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(/^\/api\/kilo/, '/api/gateway'),
};

async function handleKiloProxy(
  req: Connect.IncomingMessage,
  res: Connect.ServerResponse,
  next: Connect.NextFunction,
): Promise<void> {
  const url = req.url ?? '';
  if (!url.startsWith('/api/kilo')) {
    next();
    return;
  }

  try {
    const upstreamPath = url.replace(/^\/api\/kilo/, '');
    const target = `${KILO_UPSTREAM}${upstreamPath}`;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);

    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      Accept: 'application/json',
    };
    if (req.headers.authorization) {
      headers.Authorization = String(req.headers.authorization);
    }

    const upstream = await fetch(target, {
      method: req.method || 'POST',
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });

    res.statusCode = upstream.status;
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.end(await upstream.text());
  } catch (err) {
    console.error('[kilo-dev-proxy]', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Kilo proxy failed' }));
  }
}

/** Dev/preview reverse proxy — Kilo Gateway blocks browser CORS. */
function kiloDevProxyPlugin(): Plugin {
  const attach = (server: ViteDevServer) => {
    // Run before Vite internals so /api/kilo is not treated as SPA/404
    server.middlewares.use((req, res, next) => {
      void handleKiloProxy(req, res, next);
    });
  };

  return {
    name: 'kilo-dev-proxy',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), kiloDevProxyPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: '/',
  css: {
    transformer: 'postcss',
    lightningcss: {
      errorRecovery: true,
    },
  },
  build: {
    cssMinify: 'esbuild',
  },
  resolve: {
    // Prevent "Invalid hook call" from duplicate React copies (Vite prebundle drift)
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(
        __dirname,
        'node_modules/react/jsx-dev-runtime.js',
      ),
      '@': resolve(__dirname, 'src'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@components': resolve(__dirname, 'src/ui/components'),
      '@screens': resolve(__dirname, 'src/ui/screens'),
      '@store': resolve(__dirname, 'src/store'),
      '@services': resolve(__dirname, 'src/services'),
      '@models': resolve(__dirname, 'src/models'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@hooks': resolve(__dirname, 'src/hooks'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'zustand',
    ],
  },
  server: {
    port: 5173,
    host: true,
    // Let Vite infer HMR host from the page URL (works with Cursor Browser /
    // LAN). Hardcoding localhost breaks WS when the tab is not on localhost.
    strictPort: true,
    proxy: {
      '/api/kilo': kiloProxyOptions,
    },
  },
  preview: {
    proxy: {
      '/api/kilo': kiloProxyOptions,
    },
  },
});
