import type { MediaType } from './types.ts';

export const PLAYER_LAST_ROUTE_KEY = 'ms_last_non_player_route';

export function isPlayerRoute(pathOrUrl: string): boolean {
  const clean = pathOrUrl.trim().split('?')[0].split('#')[0];
  return clean === '/watch' || clean.startsWith('/watch/');
}

export function isTrackableNonPlayerRoute(pathname: string): boolean {
  const clean = pathname.trim().split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) return false;
  if (isPlayerRoute(clean)) return false;
  if (clean === '/profiles' || clean.startsWith('/profiles/')) return false;
  return true;
}

export function resolvePlayerBackTarget(params: {
  lastNonPlayerRoute?: string | null;
  mediaType: MediaType;
  tmdbId?: string | number | null;
}): string {
  const candidate = (params.lastNonPlayerRoute || '').trim();
  if (
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !isPlayerRoute(candidate) &&
    candidate !== '/profiles' &&
    !candidate.startsWith('/profiles/')
  ) {
    return candidate;
  }

  const numericId = Number(params.tmdbId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return params.mediaType === 'tv' ? `/series/${numericId}` : `/movie/${numericId}`;
  }

  return '/';
}
