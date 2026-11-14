import './env.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from './app.ts';
import { normalizeVercelApiUrl } from '../shared/vercelUtils.ts';

type VercelLikeRequest = IncomingMessage & {
  url?: string;
  body?: unknown;
  _body?: boolean;
  query?: Record<string, unknown>;
};

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    req.url = normalizeVercelApiUrl(req.url ?? '/api');

    if (req.query && typeof req.query === 'object' && '__path' in req.query) {
      try {
        delete req.query.__path;
      } catch {
        // Ignore read-only query getter
      }
    }

    if (req.body !== undefined && !req._body) {
      req._body = true;
    }

    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (err) {
    console.error('MegaStream Vercel handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Erro interno na função serverless.',
        })
      );
    }
  }
}
