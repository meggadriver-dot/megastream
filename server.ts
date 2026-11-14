import './server/env';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app';
import { CatalogService } from './server/services/CatalogService';
import { TMDBService } from './server/services/TMDBService';

async function startServer() {
  const app = createApiApp();
  const PORT = Number(process.env.PORT || 3000);

  // --- Frontend Serving (Vite Dev Middleware vs Production Static) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MegaStream server listening on http://0.0.0.0:${PORT}`);
    if (TMDBService.isConfigured()) {
      CatalogService.syncCatalog().catch((err) => {
        console.warn('Initial TMDB catalog sync warning:', err instanceof Error ? err.message : err);
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start MegaStream server:', err);
  process.exit(1);
});
