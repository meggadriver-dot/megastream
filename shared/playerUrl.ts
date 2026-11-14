import type {
  MegaEmbedDomain,
  MegaEmbedPlayer,
  MediaType,
  PlayerConfig,
} from './types.ts';

export const ALLOWED_MEGAEMBED_DOMAINS: readonly MegaEmbedDomain[] = [
  'mgeb.lat',
  'mgeb.space',
] as const;

export const ALLOWED_MEGAEMBED_PLAYERS: readonly MegaEmbedPlayer[] = [
  'vidstack',
  'megaplay',
  'megatube',
  'clappr',
] as const;

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  defaultDomain: 'mgeb.lat',
  availableDomains: ['mgeb.lat', 'mgeb.space'],
  defaultPlayer: 'vidstack',
  availablePlayers: ['vidstack', 'megaplay', 'megatube', 'clappr'],
  defaultColorHex: '00a8ff',
  seriesSeasonEpisodeDocumented: true,
  seriesLimitationNote:
    'Séries utilizam o endpoint oficial /embed/{TMDB_ID}/{TEMPORADA}/{EPISODIO} com ?player= e #color:.',
};

export function sanitizeHexColor(input?: string | null, fallback = '00a8ff'): string {
  if (!input) return fallback;
  const cleaned = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[0-9a-f]{3}$/.test(cleaned)) {
    return cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return fallback;
}

export function validateMegaEmbedDomain(
  domain?: string | null,
  fallback: MegaEmbedDomain = 'mgeb.lat'
): MegaEmbedDomain {
  if (domain && (ALLOWED_MEGAEMBED_DOMAINS as readonly string[]).includes(domain)) {
    return domain as MegaEmbedDomain;
  }
  return fallback;
}

export function validateMegaEmbedPlayer(
  player?: string | null,
  fallback: MegaEmbedPlayer = 'vidstack'
): MegaEmbedPlayer {
  if (player && (ALLOWED_MEGAEMBED_PLAYERS as readonly string[]).includes(player)) {
    return player as MegaEmbedPlayer;
  }
  return fallback;
}

export function normalizeTmdbId(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 999_999_999) {
    return null;
  }
  return parsed;
}

export function normalizeSeasonNumber(
  value?: string | number | null,
  fallback = 1
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
    return fallback;
  }
  return parsed;
}

export function normalizeEpisodeNumber(
  value?: string | number | null,
  fallback = 1
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 9999) {
    return fallback;
  }
  return parsed;
}

export function buildMegaEmbedUrl(params: {
  tmdbId: number;
  domain?: string | null;
  player?: string | null;
  colorHex?: string | null;
  mediaType?: MediaType;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
}): string {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error('ID TMDB inválido para incorporação do player.');
  }

  const domain = validateMegaEmbedDomain(params.domain, DEFAULT_PLAYER_CONFIG.defaultDomain);
  const player = validateMegaEmbedPlayer(params.player, DEFAULT_PLAYER_CONFIG.defaultPlayer);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);

  if (params.mediaType === 'tv') {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `https://${domain}/embed/${validId}/${season}/${episode}?player=${encodeURIComponent(player)}#color:${color}`;
  }

  return `https://${domain}/embed/${validId}?player=${encodeURIComponent(player)}#color:${color}`;
}

export function buildTmdbImageUrl(
  path: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500',
  baseUrl = 'https://image.tmdb.org/t/p/'
): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/src/') || path.startsWith('/assets/')) {
    return path;
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${size}${normalizedPath}`;
}
