import type { NextFunction, Request, Response } from 'express';
import { AuthenticationService, type VerifiedIdentity } from '../services/AuthenticationService.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

export interface AuthenticatedRequest extends Request {
  identity?: VerifiedIdentity;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(maxRequests = 180, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'local';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: 'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.',
      });
    }

    bucket.count += 1;
    next();
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (!identity) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  const user = AuthenticationService.ensureUserRecord(identity);
  if (user.blocked) {
    return res.status(403).json({ error: 'Conta suspensa pelo administrador.' });
  }
  req.identity = { ...identity, isAdmin: identity.isAdmin || user.role === 'admin' };
  next();
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (identity) {
    const user = AuthenticationService.ensureUserRecord(identity);
    req.identity = { ...identity, isAdmin: identity.isAdmin || user.role === 'admin' };
  }
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const identity = await AuthenticationService.verifyBearerToken(req.headers.authorization);
  if (!identity) {
    return res.status(401).json({ error: 'Autenticação de administrador necessária.' });
  }
  const user = AuthenticationService.ensureUserRecord(identity);
  const isAdmin = identity.isAdmin || user.role === 'admin';
  if (!isAdmin) {
    repositoryStore.addLog({
      level: 'warn',
      service: 'Security',
      message: `Tentativa de acesso administrativo negada para ${identity.email}.`,
    });
    return res.status(403).json({ error: 'Permissão de administrador negada.' });
  }
  req.identity = { ...identity, isAdmin: true };
  next();
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const message = err instanceof Error ? err.message : 'Erro interno do servidor.';
  repositoryStore.addLog({
    level: 'error',
    service: 'API',
    message,
  });
  res.status(500).json({ error: message });
}
