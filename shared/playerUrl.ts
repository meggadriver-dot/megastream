import type {
  MegaEmbedDomain,
  MegaEmbedPlayer,
  MediaType,
  PlayerConfig,
} from './types';

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
  seriesSeasonEpisodeDocumented: false,
  seriesLimitationNote:
    'A documentação pública do MegaEmbed define o endpoint base /embed/{TMDB_ID} com ?player= e #color:. Parâmetros específicos de temporada e episódio não são presumidos sem confirmação oficial do provedor.',
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

export function buildMegaEmbedUrl(params: {
  tmdbId: number;
  domain?: string | null;
  player?: string | null;
  colorHex?: string | null;
  mediaType?: MediaType;
}): string {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error('ID TMDB inválido para incorporação do player.');
  }

  const domain = validateMegaEmbedDomain(params.domain, DEFAULT_PLAYER_CONFIG.defaultDomain);
  const player = validateMegaEmbedPlayer(params.player, DEFAULT_PLAYER_CONFIG.defaultPlayer);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);

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
