import type {
  IframeSandboxPolicy,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  MediaType,
  PlayerAspectMode,
  PlayerBrandingConfig,
  PlayerConfig,
  PlayerSourceMode,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  StreamKind,
  WatchaFlixLang,
  WatermarkPosition,
  WatermarkSize,
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

export const ALLOWED_PLAYER_ASPECT_MODES: readonly PlayerAspectMode[] = [
  'contain',
  'cover',
  'fill',
  'cinema',
] as const;

export const ALLOWED_SUBTITLE_SIZES: readonly PlayerSubtitleSize[] = ['sm', 'md', 'lg'] as const;

export const ALLOWED_SUBTITLE_COLORS: readonly PlayerSubtitleColor[] = [
  'white',
  'yellow',
  'cyan',
] as const;

export const ALLOWED_SUBTITLE_BGS: readonly PlayerSubtitleBg[] = [
  'box',
  'shadow',
  'none',
] as const;

export const ALLOWED_WATERMARK_POSITIONS: readonly WatermarkPosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

export const ALLOWED_WATERMARK_SIZES: readonly WatermarkSize[] = ['sm', 'md', 'lg'] as const;

export const DEFAULT_MYEMBED_BASE_URL = 'https://myembed.biz';
export const DEFAULT_WATCHAFLIX_BASE_URL = 'https://api.watcha.one';

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  sourceMode: 'megastream_watcha',
  defaultDomain: 'mgeb.lat',
  fallbackDomain: 'mgeb.space',
  autoFallback: true,
  availableDomains: ['mgeb.lat', 'mgeb.space'],
  defaultPlayer: 'vidstack',
  availablePlayers: ['vidstack', 'megaplay', 'megatube', 'clappr'],
  defaultColorHex: '00a8ff',
  myembedBaseUrl: DEFAULT_MYEMBED_BASE_URL,
  antiAdSandbox: true,
  preferImdbForMovies: false,
  watchaflixBaseUrl: DEFAULT_WATCHAFLIX_BASE_URL,
  watchaflixLang: 'pt',
  customEmbedMovieTemplate: '',
  customEmbedTvTemplate: '',
  embedTimeoutSeconds: 12,
  defaultAspectMode: 'contain',
  autoEnableSubtitles: false,
  defaultSubtitleSize: 'md',
  defaultSubtitleColor: 'white',
  defaultSubtitleBg: 'box',
  allowTvCast: true,
  allowPipMode: true,
  allowTheaterMode: true,
  watermarkEnabled: false,
  watermarkText: '',
  watermarkLogoUrl: '',
  watermarkPosition: 'top-right',
  watermarkOpacity: 0.9,
  watermarkSize: 'md',
  autoNextEpisode: true,
  autoNextCountdownSeconds: 8,
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

export function sanitizeWatermarkText(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export function sanitizeWatermarkLogoUrl(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, 500);
  if (!trimmed) return '';
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/src/') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  return '';
}

export function validateWatermarkPosition(
  pos?: string | null,
  fallback: WatermarkPosition = DEFAULT_PLAYER_CONFIG.watermarkPosition
): WatermarkPosition {
  if (pos && (ALLOWED_WATERMARK_POSITIONS as readonly string[]).includes(pos)) {
    return pos as WatermarkPosition;
  }
  return fallback;
}

export function validateWatermarkSize(
  size?: string | null,
  fallback: WatermarkSize = DEFAULT_PLAYER_CONFIG.watermarkSize
): WatermarkSize {
  if (size && (ALLOWED_WATERMARK_SIZES as readonly string[]).includes(size)) {
    return size as WatermarkSize;
  }
  return fallback;
}

export function sanitizeWatermarkOpacity(
  value: unknown,
  fallback = DEFAULT_PLAYER_CONFIG.watermarkOpacity
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0.15, Math.min(1, n)) * 100) / 100;
}

export function sanitizeAutoNextCountdownSeconds(
  value: unknown,
  fallback = DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(3, Math.min(30, Math.round(n)));
}

export function validatePlayerAspectMode(
  mode?: string | null,
  fallback: PlayerAspectMode = DEFAULT_PLAYER_CONFIG.defaultAspectMode
): PlayerAspectMode {
  if (mode && (ALLOWED_PLAYER_ASPECT_MODES as readonly string[]).includes(mode)) {
    return mode as PlayerAspectMode;
  }
  return fallback;
}

export function validateSubtitleSize(
  size?: string | null,
  fallback: PlayerSubtitleSize = DEFAULT_PLAYER_CONFIG.defaultSubtitleSize
): PlayerSubtitleSize {
  if (size && (ALLOWED_SUBTITLE_SIZES as readonly string[]).includes(size)) {
    return size as PlayerSubtitleSize;
  }
  return fallback;
}

export function validateSubtitleColor(
  color?: string | null,
  fallback: PlayerSubtitleColor = DEFAULT_PLAYER_CONFIG.defaultSubtitleColor
): PlayerSubtitleColor {
  if (color && (ALLOWED_SUBTITLE_COLORS as readonly string[]).includes(color)) {
    return color as PlayerSubtitleColor;
  }
  return fallback;
}

export function validateSubtitleBg(
  bg?: string | null,
  fallback: PlayerSubtitleBg = DEFAULT_PLAYER_CONFIG.defaultSubtitleBg
): PlayerSubtitleBg {
  if (bg && (ALLOWED_SUBTITLE_BGS as readonly string[]).includes(bg)) {
    return bg as PlayerSubtitleBg;
  }
  return fallback;
}

export function extractPlayerBranding(
  cfg?: Partial<PlayerConfig> | null
): PlayerBrandingConfig {
  return {
    colorHex: sanitizeHexColor(cfg?.defaultColorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex),
    preferredLang: validateWatchaFlixLang(
      cfg?.watchaflixLang,
      DEFAULT_PLAYER_CONFIG.watchaflixLang
    ),
    defaultAspectMode: validatePlayerAspectMode(
      cfg?.defaultAspectMode,
      DEFAULT_PLAYER_CONFIG.defaultAspectMode
    ),
    autoEnableSubtitles:
      typeof cfg?.autoEnableSubtitles === 'boolean'
        ? cfg.autoEnableSubtitles
        : DEFAULT_PLAYER_CONFIG.autoEnableSubtitles,
    defaultSubtitleSize: validateSubtitleSize(
      cfg?.defaultSubtitleSize,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleSize
    ),
    defaultSubtitleColor: validateSubtitleColor(
      cfg?.defaultSubtitleColor,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleColor
    ),
    defaultSubtitleBg: validateSubtitleBg(
      cfg?.defaultSubtitleBg,
      DEFAULT_PLAYER_CONFIG.defaultSubtitleBg
    ),
    allowTvCast:
      typeof cfg?.allowTvCast === 'boolean'
        ? cfg.allowTvCast
        : DEFAULT_PLAYER_CONFIG.allowTvCast,
    allowPipMode:
      typeof cfg?.allowPipMode === 'boolean'
        ? cfg.allowPipMode
        : DEFAULT_PLAYER_CONFIG.allowPipMode,
    allowTheaterMode:
      typeof cfg?.allowTheaterMode === 'boolean'
        ? cfg.allowTheaterMode
        : DEFAULT_PLAYER_CONFIG.allowTheaterMode,
    watermarkEnabled:
      typeof cfg?.watermarkEnabled === 'boolean'
        ? cfg.watermarkEnabled
        : DEFAULT_PLAYER_CONFIG.watermarkEnabled,
    watermarkText:
      cfg?.watermarkText !== undefined
        ? sanitizeWatermarkText(cfg.watermarkText)
        : DEFAULT_PLAYER_CONFIG.watermarkText,
    watermarkLogoUrl:
      cfg?.watermarkLogoUrl !== undefined
        ? sanitizeWatermarkLogoUrl(cfg.watermarkLogoUrl)
        : DEFAULT_PLAYER_CONFIG.watermarkLogoUrl,
    watermarkPosition: validateWatermarkPosition(
      cfg?.watermarkPosition,
      DEFAULT_PLAYER_CONFIG.watermarkPosition
    ),
    watermarkOpacity: sanitizeWatermarkOpacity(
      cfg?.watermarkOpacity,
      DEFAULT_PLAYER_CONFIG.watermarkOpacity
    ),
    watermarkSize: validateWatermarkSize(
      cfg?.watermarkSize,
      DEFAULT_PLAYER_CONFIG.watermarkSize
    ),
    autoNextEpisode:
      typeof cfg?.autoNextEpisode === 'boolean'
        ? cfg.autoNextEpisode
        : DEFAULT_PLAYER_CONFIG.autoNextEpisode,
    autoNextCountdownSeconds: sanitizeAutoNextCountdownSeconds(
      cfg?.autoNextCountdownSeconds,
      DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds
    ),
  };
}

export function sanitizeImdbId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (/^tt\d{5,12}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
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
    mode === 'megastream_watcha' ||
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
  remoteHasPrincipalFields?: unknown;
  fallback: PlayerSourceMode;
}): PlayerSourceMode {
  const validRemote = validatePlayerSourceMode(params.remoteSourceMode, params.fallback);
  if (validRemote === 'megastream_watcha') {
    return 'megastream_watcha';
  }
  const hasExplicitPostUpgradeSave = typeof params.remoteAntiAdSandbox === 'boolean';
  // Legacy Firestore docs created before anti-Cloudflare upgrade lacked antiAdSandbox.
  // Upgrade watchaflix/megaembed automatically to the fallback until an admin explicitly saves a choice.
  if (!hasExplicitPostUpgradeSave && (validRemote === 'watchaflix' || validRemote === 'megaembed')) {
    return params.fallback;
  }
  // Pre-principal Firestore docs lacking defaultAspectMode also auto-promote to megastream_watcha
  // unless an admin explicitly configured a custom_template or saved after this upgrade.
  if (
    params.remoteHasPrincipalFields === false &&
    validRemote !== 'custom_template'
  ) {
    return 'megastream_watcha';
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
  imdbId?: string | null;
  preferImdbForMovies?: boolean;
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
  const validImdb = params.preferImdbForMovies ? sanitizeImdbId(params.imdbId) : null;
  return `${base}/filme/${validImdb || validId}`;
}

export function detectStreamKind(url?: string | null): StreamKind {
  if (!url || typeof url !== 'string') return 'iframe';
  const raw = url.trim().split('#')[0];
  const [beforeQuery, query = ''] = raw.split('?');
  const clean = beforeQuery.toLowerCase();
  if (clean.endsWith('.m3u8') || /format=m3u8|type=hls/i.test(query)) {
    return 'hls';
  }
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.ogv') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m4v')
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
  imdbId?: string | null;
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
  const imdb = sanitizeImdbId(params.imdbId) || String(validId);

  return cleanTemplate
    .replace(/\{tmdbId\}|\{tmdb_id\}|\{TMDB_ID\}|\{id\}/g, String(validId))
    .replace(/\{imdbId\}|\{imdb_id\}|\{IMDB_ID\}/g, imdb)
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

export interface SourceCascadeCandidate {
  sourceId: PlayerSourceMode | 'native_watcha';
  label: string;
  url?: string;
  isCustomConfigured: boolean;
}

export function buildOrderedSourceCascade(
  cfg: PlayerConfig,
  params: {
    tmdbId: number;
    imdbId?: string | null;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
  }
): SourceCascadeCandidate[] {
  const validId = normalizeTmdbId(params.tmdbId);
  if (!validId) return [];

  const season = params.mediaType === 'tv' ? normalizeSeasonNumber(params.seasonNumber, 1) : undefined;
  const episode = params.mediaType === 'tv' ? normalizeEpisodeNumber(params.episodeNumber, 1) : undefined;

  const customTemplateRaw =
    params.mediaType === 'tv' ? cfg.customEmbedTvTemplate : cfg.customEmbedMovieTemplate;
  const customTemplateUrl = customTemplateRaw
    ? buildCustomEmbedUrl({
        template: customTemplateRaw,
        tmdbId: validId,
        imdbId: params.imdbId,
        mediaType: params.mediaType,
        seasonNumber: season,
        episodeNumber: episode,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
      })
    : null;

  const watchaflixUrl = buildWatchaFlixEmbedUrl({
    tmdbId: validId,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
    baseUrl: cfg.watchaflixBaseUrl,
    colorHex: cfg.defaultColorHex,
    lang: cfg.watchaflixLang,
  });

  const myembedUrl = buildMyEmbedUrl({
    tmdbId: validId,
    imdbId: params.imdbId,
    preferImdbForMovies: cfg.preferImdbForMovies,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
    baseUrl: cfg.myembedBaseUrl,
  });

  const megaPrimaryUrl = buildMegaEmbedUrl({
    tmdbId: validId,
    domain: cfg.defaultDomain,
    player: cfg.defaultPlayer,
    colorHex: cfg.defaultColorHex,
    mediaType: params.mediaType,
    seasonNumber: season,
    episodeNumber: episode,
  });

  const megaFallbackUrl =
    cfg.fallbackDomain && cfg.fallbackDomain !== cfg.defaultDomain
      ? buildMegaEmbedUrl({
          tmdbId: validId,
          domain: cfg.fallbackDomain,
          player: cfg.defaultPlayer,
          colorHex: cfg.defaultColorHex,
          mediaType: params.mediaType,
          seasonNumber: season,
          episodeNumber: episode,
        })
      : null;

  const hasCustomWatchaflix = normalizeWatchaFlixBaseUrl(cfg.watchaflixBaseUrl) !== DEFAULT_WATCHAFLIX_BASE_URL;
  const hasCustomMyembed = normalizeMyEmbedBaseUrl(cfg.myembedBaseUrl) !== DEFAULT_MYEMBED_BASE_URL;

  const rawList: SourceCascadeCandidate[] = [];

  const pushCustomTemplate = () => {
    if (customTemplateUrl) {
      rawList.push({
        sourceId: 'custom_template',
        label: 'Template Customizado',
        url: customTemplateUrl,
        isCustomConfigured: true,
      });
    }
  };
  const pushWatchaflix = () => {
    rawList.push({
      sourceId: 'watchaflix',
      label: hasCustomWatchaflix ? 'WatchaFlix Custom' : 'WatchaFlix API',
      url: watchaflixUrl,
      isCustomConfigured: hasCustomWatchaflix,
    });
  };
  const pushMyembed = () => {
    rawList.push({
      sourceId: 'myembed',
      label: hasCustomMyembed ? 'MyEmbed Custom' : 'MyEmbed / EmbedMovies',
      url: myembedUrl,
      isCustomConfigured: hasCustomMyembed,
    });
  };
  const pushMegaembed = () => {
    rawList.push({
      sourceId: 'megaembed',
      label: `MegaEmbed (${cfg.defaultDomain})`,
      url: megaPrimaryUrl,
      isCustomConfigured: false,
    });
    if (megaFallbackUrl) {
      rawList.push({
        sourceId: 'megaembed',
        label: `MegaEmbed (${cfg.fallbackDomain})`,
        url: megaFallbackUrl,
        isCustomConfigured: false,
      });
    }
  };
  const pushNative = () => {
    rawList.push({
      sourceId: 'native_watcha',
      label: 'MegaStream Nativo (WatchPlay / EmbedPlayer / PlayerFlix)',
      isCustomConfigured: false,
    });
  };

  if (cfg.sourceMode === 'custom_template') {
    pushCustomTemplate();
    pushNative();
    if (hasCustomWatchaflix) pushWatchaflix();
    if (hasCustomMyembed) pushMyembed();
    if (!hasCustomMyembed) pushMyembed();
    if (!hasCustomWatchaflix) pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === 'watchaflix') {
    pushWatchaflix();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushMegaembed();
  } else if (cfg.sourceMode === 'myembed') {
    if (hasCustomMyembed) {
      pushMyembed();
      pushNative();
    } else {
      pushMyembed();
      pushNative();
    }
    pushCustomTemplate();
    pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === 'megaembed') {
    pushMegaembed();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushWatchaflix();
  } else {
    // Default 'megastream_watcha'
    pushNative();
    pushCustomTemplate();
    if (hasCustomWatchaflix) pushWatchaflix();
    if (hasCustomMyembed) pushMyembed();
    if (!hasCustomMyembed) pushMyembed();
    if (!hasCustomWatchaflix) pushWatchaflix();
    pushMegaembed();
  }

  const seen = new Set<string>();
  const deduped: SourceCascadeCandidate[] = [];
  for (const item of rawList) {
    const key = `${item.sourceId}:${item.url || 'native'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

