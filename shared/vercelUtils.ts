/**
 * Normalizes incoming Vercel serverless URLs when requests are rewritten from
 * `/api/(.*)` to `/api/index?__path=$1`, preserving all other query parameters.
 */
export function normalizeVercelApiUrl(rawUrl: string): string {
  const input = rawUrl && rawUrl.trim().length > 0 ? rawUrl : '/api';
  const url = new URL(input, 'http://localhost');
  const pathOverride = url.searchParams.get('__path');

  if (pathOverride !== null) {
    url.searchParams.delete('__path');
    const cleanSubpath = pathOverride.replace(/^\/+/, '');
    url.pathname = cleanSubpath ? `/api/${cleanSubpath}` : '/api';
  } else if (url.pathname === '/api/index') {
    url.pathname = '/api';
  }

  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}
