import type {
  IframeSandboxPolicy,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  MediaType,
  PlayerConfig,
  PlayerSourceMode,
  StreamKind,
  WatchaFlixLang,
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

export const ALLOWED_WATCHAFLIX_LANGS: readonly WatchaFlixLang[] = ['pt', 'en'] as const;

export const DEFAULT_MYEMBED_BASE_URL = 'https://myembed.biz';
export const DEFAULT_WATCHAFLIX_BASE_URL = 'https://api.watcha.one';

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  sourceMode: 'myembed',
  defaultDomain: 'mgeb.lat',
  fallbackDomain: 'mgeb.space',
  autoFallback: true,
  availableDomains: ['mgeb.lat', 'mgeb.space'],
  defaultPlayer: 'vidstack',
  availablePlayers: ['vidstack', 'megaplay', 'megatube', 'clappr'],
  defaultColorHex: '00a8ff',
  myembedBaseUrl: DEFAULT_MYEMBED_BASE_URL,
  antiAdSandbox: true,
  watchaflixBaseUrl: DEFAULT_WATCHAFLIX_BASE_URL,
  watchaflixLang: 'pt',
  customEmbedMovieTemplate: '',
  customEmbedTvTemplate: '',
  embedTimeoutSeconds: 12,
  seriesSeasonEpisodeDocumented: true,
  seriesLimitationNote:
    'Séries carregam diretamente por temporada e episódio sem etapas extras de verificação.',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

export function sanitizeEmbedTemplate(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, 500);
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

export function sanitizeEmbedTimeoutSeconds(value: unknown, fallback = 12): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(30, Math.round(n)));
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

export function validatePlayerSourceMode(
  mode?: string | null,
  fallback: PlayerSourceMode = DEFAULT_PLAYER_CONFIG.sourceMode
): PlayerSourceMode {
  if (
    mode === 'myembed' ||
    mode === 'watchaflix' ||
    mode === 'custom_template' ||
    mode === 'megaembed'
  ) {
    return mode;
  }
  return fallback;
}

export function resolveHydratedSourceMode(params: {
  remoteSourceMode?: string | null;
  remoteAntiAdSandbox?: unknown;
  fallback: PlayerSourceMode;
}): PlayerSourceMode {
  const validRemote = validatePlayerSourceMode(params.remoteSourceMode, params.fallback);
  const hasExplicitPostUpgradeSave = typeof params.remoteAntiAdSandbox === 'boolean';
  // Legacy Firestore docs created before anti-Cloudflare upgrade lacked antiAdSandbox.
  // Upgrade watchaflix/megaembed automatically to myembed until an admin explicitly saves a choice.
  if (!hasExplicitPostUpgradeSave && (validRemote === 'watchaflix' || validRemote === 'megaembed')) {
    return 'myembed';
  }
  return validRemote;
}

export function normalizeMyEmbedBaseUrl(input?: string | null): string {
  if (!input || typeof input !== 'string') return DEFAULT_MYEMBED_BASE_URL;
  const trimmed = input.trim().slice(0, 300);
  if (!trimmed) return DEFAULT_MYEMBED_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_MYEMBED_BASE_URL;
    }
    const hostname = parsed.hostname.toLowerCase();
    // embedmovies.org is the docs portal; actual fast iframe server lives at myembed.biz
    if (hostname === 'embedmovies.org' || hostname === 'www.embedmovies.org') {
      return DEFAULT_MYEMBED_BASE_URL;
    }
    const cleanPath = parsed.pathname.replace(/\/(filme|serie)\/.*$/i, '').replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${cleanPath}`.slice(0, 300);
  } catch {
    return DEFAULT_MYEMBED_BASE_URL;
  }
}

export function buildMyEmbedUrl(params: {
  tmdbId: number;
  mediaType?: MediaType;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  baseUrl?: string | null;
}): string {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error('ID TMDB inválido para incorporação do player.');
  }
  const base = normalizeMyEmbedBaseUrl(params.baseUrl);
  if (params.mediaType === 'tv') {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `${base}/serie/${validId}/${season}/${episode}`;
  }
  return `${base}/filme/${validId}`;
}

export function detectStreamKind(url?: string | null): StreamKind {
  if (!url || typeof url !== 'string') return 'iframe';
  const clean = url.trim().split('#')[0].split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) {
    return 'hls';
  }
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.ogv') ||
    clean.endsWith('.mov')
  ) {
    return 'video';
  }
  return 'iframe';
}

export function resolveSandboxPolicy(params: {
  streamKind: StreamKind;
  antiAdSandbox?: boolean;
}): IframeSandboxPolicy {
  if (params.streamKind !== 'iframe') {
    return 'none';
  }
  return params.antiAdSandbox !== false ? 'strict_no_ads' : 'none';
}

export function validateWatchaFlixLang(
  lang?: string | null,
  fallback: WatchaFlixLang = 'pt'
): WatchaFlixLang {
  if (lang === 'pt' || lang === 'en') {
    return lang;
  }
  return fallback;
}

export function normalizeWatchaFlixBaseUrl(input?: string | null): string {
  if (!input || typeof input !== 'string') return DEFAULT_WATCHAFLIX_BASE_URL;
  const trimmed = input.trim().slice(0, 300);
  if (!trimmed) return DEFAULT_WATCHAFLIX_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_WATCHAFLIX_BASE_URL;
    }
    const hostname = parsed.hostname.toLowerCase();
    // WatchaFlix's public docs portal is watchaflixapi.watcha.one, while its actual embed API lives at api.watcha.one
    if (hostname === 'watchaflixapi.watcha.one' || hostname === 'watcha.one' || hostname === 'www.watcha.one') {
      return DEFAULT_WATCHAFLIX_BASE_URL;
    }
    const cleanPath = parsed.pathname.replace(/\/embed\/.*$/i, '').replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${cleanPath}`.slice(0, 300);
  } catch {
    return DEFAULT_WATCHAFLIX_BASE_URL;
  }
}

export function buildWatchaFlixEmbedUrl(params: {
  tmdbId: number;
  mediaType?: MediaType;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  baseUrl?: string | null;
  colorHex?: string | null;
  lang?: string | null;
}): string {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) {
    throw new Error('ID TMDB inválido para WatchaFlix.');
  }
  const base = normalizeWatchaFlixBaseUrl(params.baseUrl);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);
  const lang = validateWatchaFlixLang(params.lang, DEFAULT_PLAYER_CONFIG.watchaflixLang);
  const query = `?color=${encodeURIComponent(color)}&lang=${encodeURIComponent(lang)}`;

  if (params.mediaType === 'tv') {
    const season = normalizeSeasonNumber(params.seasonNumber, 1);
    const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
    return `${base}/embed/tv/${validId}/${season}/${episode}${query}`;
  }

  return `${base}/embed/movie/${validId}${query}`;
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

export function buildCustomEmbedUrl(params: {
  template: string;
  tmdbId: number;
  mediaType?: MediaType;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  player?: string | null;
  colorHex?: string | null;
}): string | null {
  const cleanTemplate = sanitizeEmbedTemplate(params.template);
  const validId = normalizeTmdbId(params.tmdbId);
  if (!cleanTemplate || !validId) return null;

  const season = normalizeSeasonNumber(params.seasonNumber, 1);
  const episode = normalizeEpisodeNumber(params.episodeNumber, 1);
  const player = validateMegaEmbedPlayer(params.player, DEFAULT_PLAYER_CONFIG.defaultPlayer);
  const color = sanitizeHexColor(params.colorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex);

  return cleanTemplate
    .replace(/\{tmdbId\}|\{tmdb_id\}|\{TMDB_ID\}|\{id\}/g, String(validId))
    .replace(/\{season\}|\{SEASON\}|\{temporada\}/g, String(season))
    .replace(/\{episode\}|\{EPISODE\}|\{episodio\}|\{episódio\}/g, String(episode))
    .replace(/\{player\}/g, encodeURIComponent(player))
    .replace(/\{color\}/g, color)
    .replace(/\{type\}/g, params.mediaType === 'tv' ? 'tv' : 'movie');
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
