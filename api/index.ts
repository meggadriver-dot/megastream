import '../server/env';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../server/app';
import { normalizeVercelApiUrl } from '../shared/vercelUtils';

type VercelLikeRequest = IncomingMessage & {
  url?: string;
  body?: unknown;
  _body?: boolean;
  query?: Record<string, unknown>;
};

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
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
}
