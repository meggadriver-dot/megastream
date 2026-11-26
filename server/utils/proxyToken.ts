import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StreamKind } from '../../shared/types.ts';

export interface SignedStreamSessionPayload {
  u: string;
  r?: string;
  o?: string;
  ua?: string;
  sr: boolean;
  sua?: boolean;
  k: StreamKind;
  exp: number;
}

export interface SignedSubtitlePayload {
  u: string;
  l: string;
  e?: string;
  exp: number;
}

let cachedSecret: string | null = null;

function resolveSecret(): string {
  if (cachedSecret) return cachedSecret;
  const envSecret =
    process.env.STREAM_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    cachedSecret = envSecret;
    return cachedSecret;
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    'gen-lang-client-0094430568';
  const apiKey =
    process.env.FIREBASE_API_KEY?.trim() ||
    process.env.VITE_FIREBASE_API_KEY?.trim() ||
    'megastream-stateless-proxy-key';
  cachedSecret = `ms-v1:${projectId}:${apiKey}`;
  return cachedSecret;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function hmacSign(data: string, secret = resolveSecret()): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function signStreamSessionToken(
  payload: Omit<SignedStreamSessionPayload, 'exp'>,
  ttlSeconds = 6 * 3600,
  secretOverride?: string
): string {
  const compact: SignedStreamSessionPayload = {
    u: payload.u,
    ...(payload.r ? { r: payload.r } : {}),
    ...(payload.o ? { o: payload.o } : {}),
    ...(payload.ua ? { ua: payload.ua } : {}),
    sr: payload.sr,
    ...(payload.sua === false ? { sua: false } : {}),
    k: payload.k,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds),
  };
  const body = toBase64Url(JSON.stringify(compact));
  const sig = hmacSign(`st:${body}`, secretOverride);
  return `v1.${body}.${sig}`;
}

export function verifyStreamSessionToken(
  token: string,
  secretOverride?: string
): SignedStreamSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = hmacSign(`st:${body}`, secretOverride);
  if (!safeEqualStrings(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(body).toString('utf8')) as SignedStreamSessionPayload;
    if (!parsed || typeof parsed.u !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (parsed.k !== 'hls' && parsed.k !== 'video' && parsed.k !== 'iframe') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function signSubtitleToken(
  payload: Omit<SignedSubtitlePayload, 'exp'>,
  ttlSeconds = 12 * 3600,
  secretOverride?: string
): string {
  const compact: SignedSubtitlePayload = {
    u: payload.u,
    l: payload.l,
    ...(payload.e ? { e: payload.e } : {}),
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds),
  };
  const body = toBase64Url(JSON.stringify(compact));
  const sig = hmacSign(`sub:${body}`, secretOverride);
  return `sv1.${body}.${sig}`;
}

export function verifySubtitleToken(
  token: string,
  secretOverride?: string
): SignedSubtitlePayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'sv1') return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = hmacSign(`sub:${body}`, secretOverride);
  if (!safeEqualStrings(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(body).toString('utf8')) as SignedSubtitlePayload;
    if (!parsed || typeof parsed.u !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function signSegmentUrl(
  sessionToken: string,
  segmentUrl: string,
  secretOverride?: string
): string {
  return hmacSign(`seg:${sessionToken}:${segmentUrl}`, secretOverride).slice(0, 24);
}

export function verifySegmentUrl(
  sessionToken: string,
  segmentUrl: string,
  providedSig: string,
  secretOverride?: string
): boolean {
  if (!sessionToken || !segmentUrl || !providedSig) return false;
  const expected = signSegmentUrl(sessionToken, segmentUrl, secretOverride);
  return safeEqualStrings(providedSig, expected);
}
