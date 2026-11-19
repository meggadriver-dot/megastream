import type {
  CustomVideoSource,
  CustomVideoSourceKind,
  CustomVideoSourceLang,
  IframeSandboxPolicy,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  MediaType,
  PlayerAspectMode,
  PlayerAudioOption,
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
  customSources: [],
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

export interface CustomSourceLangMeta {
  value: CustomVideoSourceLang;
  label: string;
  shortTag: string;
  langCode: string;
}

export const CUSTOM_SOURCE_LANG_OPTIONS: readonly CustomSourceLangMeta[] = [
  { value: 'pt', label: 'Dublado (PT-BR)', shortTag: 'PT-BR', langCode: 'pt-br' },
  { value: 'sub', label: 'Legendado (PT-BR)', shortTag: 'LEG', langCode: 'pt-sub' },
  { value: 'en', label: 'Inglês / Original', shortTag: 'EN', langCode: 'en-us' },
  { value: 'es', label: 'Espanhol', shortTag: 'ES', langCode: 'es-es' },
  { value: 'auto', label: 'Automático', shortTag: 'AUTO', langCode: 'auto' },
] as const;

export function sanitizeCustomVideoSourceLang(input: unknown): CustomVideoSourceLang {
  if (
    input === 'pt' ||
    input === 'sub' ||
    input === 'en' ||
    input === 'es' ||
    input === 'auto'
  ) {
    return input;
  }
  return 'auto';
}

export function hasUrlTemplatePlaceholder(template?: string | null): boolean {
  if (!template || typeof template !== 'string') return false;
  return /\{(?:tmdbId|tmdb_id|TMDB_ID|id|imdbId|imdb_id|IMDB_ID)\}/.test(template);
}

const EXTENDED_LANG_META: Record<string, { label: string; shortTag: string; langCode: string }> = {
  fr: { label: 'Francês', shortTag: 'FR', langCode: 'fr' },
  fre: { label: 'Francês', shortTag: 'FR', langCode: 'fr' },
  fra: { label: 'Francês', shortTag: 'FR', langCode: 'fr' },
  french: { label: 'Francês', shortTag: 'FR', langCode: 'fr' },
  de: { label: 'Alemão', shortTag: 'DE', langCode: 'de' },
  ger: { label: 'Alemão', shortTag: 'DE', langCode: 'de' },
  deu: { label: 'Alemão', shortTag: 'DE', langCode: 'de' },
  german: { label: 'Alemão', shortTag: 'DE', langCode: 'de' },
  it: { label: 'Italiano', shortTag: 'IT', langCode: 'it' },
  ita: { label: 'Italiano', shortTag: 'IT', langCode: 'it' },
  italian: { label: 'Italiano', shortTag: 'IT', langCode: 'it' },
  ja: { label: 'Japonês', shortTag: 'JA', langCode: 'ja' },
  jpn: { label: 'Japonês', shortTag: 'JA', langCode: 'ja' },
  japanese: { label: 'Japonês', shortTag: 'JA', langCode: 'ja' },
  ko: { label: 'Coreano', shortTag: 'KO', langCode: 'ko' },
  kor: { label: 'Coreano', shortTag: 'KO', langCode: 'ko' },
  korean: { label: 'Coreano', shortTag: 'KO', langCode: 'ko' },
  hi: { label: 'Hindi', shortTag: 'HI', langCode: 'hi' },
  hin: { label: 'Hindi', shortTag: 'HI', langCode: 'hi' },
  hindi: { label: 'Hindi', shortTag: 'HI', langCode: 'hi' },
};

export function getCustomSourceLangMeta(lang?: string | null): CustomSourceLangMeta {
  const normalized = (lang || '').trim().toLowerCase();
  if (normalized === 'sub' || normalized === 'pt-sub' || normalized === 'legendado') {
    return CUSTOM_SOURCE_LANG_OPTIONS[1];
  }
  if (normalized === 'pt' || normalized === 'pt-br' || normalized === 'dublado' || normalized === 'portuguese') {
    return CUSTOM_SOURCE_LANG_OPTIONS[0];
  }
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'original' || normalized === 'english') {
    return CUSTOM_SOURCE_LANG_OPTIONS[2];
  }
  if (normalized === 'es' || normalized === 'es-es' || normalized === 'espanhol' || normalized === 'spanish') {
    return CUSTOM_SOURCE_LANG_OPTIONS[3];
  }
  const extended = EXTENDED_LANG_META[normalized];
  if (extended) {
    return {
      value: 'auto',
      label: extended.label,
      shortTag: extended.shortTag,
      langCode: extended.langCode,
    };
  }
  return CUSTOM_SOURCE_LANG_OPTIONS[4];
}

export function formatSourceLanguageOptionLabel(
  sourceName?: string | null,
  lang?: string | null
): {
  label: string;
  languageLabel: string;
  sourceName: string;
  langCode: string;
} {
  const cleanName = (sourceName || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  const meta = getCustomSourceLangMeta(lang);

  if (!cleanName) {
    return {
      label: meta.label,
      languageLabel: meta.label,
      sourceName: '',
      langCode: meta.langCode,
    };
  }

  const label =
    meta.value === 'auto' && meta.langCode === 'auto'
      ? `${cleanName} (Auto)`
      : `${meta.label} · ${cleanName}`;

  return {
    label,
    languageLabel: meta.label,
    sourceName: cleanName,
    langCode: meta.langCode,
  };
}

export function consolidateAudioOptionsByLanguage(
  options: PlayerAudioOption[]
): PlayerAudioOption[] {
  if (!Array.isArray(options) || options.length === 0) return [];

  const hasDirectStream = options.some(
    (opt) => opt.streamKind === 'hls' || opt.streamKind === 'video'
  );
  const filtered = hasDirectStream
    ? options.filter((opt) => opt.streamKind === 'hls' || opt.streamKind === 'video')
    : options;

  // Prefer direct HLS/MP4 before iframe within the same priority tier
  const ordered = [...filtered].sort((a, b) => {
    const aDirect = a.streamKind === 'iframe' ? 1 : 0;
    const bDirect = b.streamKind === 'iframe' ? 1 : 0;
    return aDirect - bDirect;
  });

  const grouped = new Map<string, PlayerAudioOption>();
  const seenUrlsByGroup = new Map<string, Set<string>>();

  for (const opt of ordered) {
    const meta = getCustomSourceLangMeta(opt.lang);
    const hasSpecificLang = meta.langCode !== 'auto';
    const isUnknownAuto =
      !hasSpecificLang &&
      (!opt.languageLabel || opt.languageLabel === 'Automático');
    const cleanLanguageLabel = isUnknownAuto
      ? 'Áudio Original'
      : hasSpecificLang
        ? meta.label
        : opt.languageLabel!;
    const groupKey = hasSpecificLang ? meta.langCode : 'auto';
    const canonicalLang = hasSpecificLang ? meta.langCode : 'auto';

    const existing = grouped.get(groupKey);
    const candidateBackups: Array<{ streamUrl: string; streamKind: StreamKind }> = [
      { streamUrl: opt.streamUrl, streamKind: opt.streamKind },
      ...(Array.isArray(opt.backupStreams) ? opt.backupStreams : []),
    ];

    if (!existing) {
      const seenUrls = new Set<string>([opt.streamUrl]);
      const dedupedBackups: Array<{ streamUrl: string; streamKind: StreamKind }> = [];
      for (const b of candidateBackups.slice(1)) {
        if (!b?.streamUrl || seenUrls.has(b.streamUrl)) continue;
        seenUrls.add(b.streamUrl);
        dedupedBackups.push({ streamUrl: b.streamUrl, streamKind: b.streamKind });
      }
      seenUrlsByGroup.set(groupKey, seenUrls);
      grouped.set(groupKey, {
        id: opt.id,
        label: cleanLanguageLabel,
        languageLabel: cleanLanguageLabel,
        lang: canonicalLang,
        streamUrl: opt.streamUrl,
        streamKind: opt.streamKind,
        ...(dedupedBackups.length > 0 ? { backupStreams: dedupedBackups } : {}),
        isCustomSource: opt.isCustomSource,
      });
    } else {
      const seenUrls = seenUrlsByGroup.get(groupKey)!;
      const backups = existing.backupStreams ? [...existing.backupStreams] : [];
      for (const b of candidateBackups) {
        if (!b?.streamUrl || seenUrls.has(b.streamUrl)) continue;
        seenUrls.add(b.streamUrl);
        backups.push({ streamUrl: b.streamUrl, streamKind: b.streamKind });
      }
      if (backups.length > 0) {
        existing.backupStreams = backups;
      }
    }
  }

  return Array.from(grouped.values());
}

export function sanitizeCustomVideoSources(input: unknown): CustomVideoSource[] {
  if (!Array.isArray(input)) return [];
  const result: CustomVideoSource[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < input.length && result.length < 50; i++) {
    const raw = input[i];
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;

    const rawId = typeof obj.id === 'string' ? obj.id.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) : '';
    const id = rawId || `src_${i + 1}`;
    if (seenIds.has(id)) continue;

    const name = typeof obj.name === 'string'
      ? obj.name.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
      : '';
    if (!name) continue;

    const kind: CustomVideoSourceKind =
      obj.kind === 'api' || obj.kind === 'embed' || obj.kind === 'direct' ? obj.kind : 'api';

    const lang = sanitizeCustomVideoSourceLang(obj.lang);

    const movieTemplate = sanitizeEmbedTemplate(typeof obj.movieTemplate === 'string' ? obj.movieTemplate : '');
    const tvTemplate = sanitizeEmbedTemplate(typeof obj.tvTemplate === 'string' ? obj.tvTemplate : '');
    if (!movieTemplate && !tvTemplate) continue;

    const rawPriority = typeof obj.priority === 'number' ? obj.priority : Number(obj.priority);
    const priority = Number.isFinite(rawPriority)
      ? Math.max(1, Math.min(999, Math.round(rawPriority)))
      : i + 1;

    const active = typeof obj.active === 'boolean' ? obj.active : true;

    seenIds.add(id);
    result.push({
      id,
      name,
      kind,
      movieTemplate,
      tvTemplate,
      lang,
      priority,
      active,
    });
  }

  return result.sort((a, b) => a.priority - b.priority);
}

export const RECOMMENDED_CUSTOM_SOURCES: readonly CustomVideoSource[] = [
  {
    id: 'rec_myembed_pt',
    name: 'MyEmbed / EmbedMovies (PT-BR)',
    kind: 'embed',
    lang: 'pt',
    movieTemplate: 'https://myembed.biz/filme/{tmdbId}',
    tvTemplate: 'https://myembed.biz/serie/{tmdbId}/{season}/{episode}',
    priority: 1,
    active: true,
  },
  {
    id: 'rec_playerflix_pt',
    name: 'PlayerFlix (PT-BR / Legendado)',
    kind: 'embed',
    lang: 'auto',
    movieTemplate: 'https://playerflix.ink/filme/{tmdbId}',
    tvTemplate: 'https://playerflix.ink/serie/{tmdbId}/{season}/{episode}',
    priority: 2,
    active: true,
  },
  {
    id: 'rec_watchplay1_pt',
    name: 'WatchPlay v1 (PT-BR)',
    kind: 'embed',
    lang: 'pt',
    movieTemplate: 'https://v1.watchplay.shop/movie/{tmdbId}',
    tvTemplate: 'https://v1.watchplay.shop/tvshow/{tmdbId}/{season}/{episode}',
    priority: 3,
    active: true,
  },
  {
    id: 'rec_watchplay2_pt',
    name: 'WatchPlay v2 (PT-BR)',
    kind: 'embed',
    lang: 'pt',
    movieTemplate: 'https://v2.watchplay.shop/movie/{tmdbId}',
    tvTemplate: 'https://v2.watchplay.shop/tvshow/{tmdbId}/{season}/{episode}',
    priority: 4,
    active: true,
  },
  {
    id: 'rec_videm_buzz_en',
    name: 'VidEm Buzz (Inglês / Multi)',
    kind: 'embed',
    lang: 'auto',
    movieTemplate: 'https://videm.buzz/embed/movie/{tmdbId}',
    tvTemplate: 'https://videm.buzz/embed/tv/{tmdbId}/{season}/{episode}',
    priority: 5,
    active: true,
  },
  {
    id: 'rec_videm_cc_en',
    name: 'VidEm CC (Inglês / Multi)',
    kind: 'embed',
    lang: 'auto',
    movieTemplate: 'https://videm.cc/embed/movie/{tmdbId}',
    tvTemplate: 'https://videm.cc/embed/tv/{tmdbId}/{season}/{episode}',
    priority: 6,
    active: true,
  },
  {
    id: 'rec_vidsrc_buzz_en',
    name: 'VidSrc Buzz (Inglês / Multi)',
    kind: 'embed',
    lang: 'auto',
    movieTemplate: 'https://vidsrc.buzz/embed/movie/{tmdbId}',
    tvTemplate: 'https://vidsrc.buzz/embed/tv/{tmdbId}/{season}/{episode}',
    priority: 7,
    active: true,
  },
  {
    id: 'rec_2embed_cc_en',
    name: '2Embed (Inglês / Multi)',
    kind: 'embed',
    lang: 'auto',
    movieTemplate: 'https://www.2embed.cc/embed/{tmdbId}',
    tvTemplate: 'https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}',
    priority: 8,
    active: true,
  },
] as const;

const KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE =
  /(?:embedmaster\.link|api\.watcha\.one|superflixapi\.(?:lat|boats)|mgeb\.(?:lat|space))/i;

function normalizeTemplateKey(url?: string | null): string {
  return (url || '').trim().toLowerCase().replace(/\/+$/, '');
}

export function mergeRecommendedCustomSources(existingInput: unknown): {
  sources: CustomVideoSource[];
  addedCount: number;
  pausedBrokenCount: number;
} {
  const existing = sanitizeCustomVideoSources(existingInput);
  const recommendedByKey = new Map<string, CustomVideoSource>();
  for (const rec of RECOMMENDED_CUSTOM_SOURCES) {
    if (rec.movieTemplate) recommendedByKey.set(normalizeTemplateKey(rec.movieTemplate), rec);
    if (rec.tvTemplate) recommendedByKey.set(normalizeTemplateKey(rec.tvTemplate), rec);
  }

  let pausedBrokenCount = 0;
  const matchedRecIds = new Set<string>();

  const updatedExisting = existing.map((src) => {
    const movieKey = normalizeTemplateKey(src.movieTemplate);
    const tvKey = normalizeTemplateKey(src.tvTemplate);
    const rec =
      (movieKey ? recommendedByKey.get(movieKey) : undefined) ||
      (tvKey ? recommendedByKey.get(tvKey) : undefined);

    if (rec) {
      matchedRecIds.add(rec.id);
      return {
        ...src,
        active: true,
      };
    }

    const combinedUrls = `${src.movieTemplate} ${src.tvTemplate}`;
    const isKnownBlocked = KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE.test(combinedUrls);
    const missingTemplateVar =
      src.kind !== 'direct' &&
      !hasUrlTemplatePlaceholder(src.movieTemplate) &&
      !hasUrlTemplatePlaceholder(src.tvTemplate);

    if (src.active && (isKnownBlocked || missingTemplateVar)) {
      pausedBrokenCount += 1;
      return {
        ...src,
        active: false,
      };
    }

    return src;
  });

  const existingIds = new Set(updatedExisting.map((s) => s.id));
  const toAppend: CustomVideoSource[] = [];
  for (const rec of RECOMMENDED_CUSTOM_SOURCES) {
    if (matchedRecIds.has(rec.id)) continue;
    const uniqueId = existingIds.has(rec.id)
      ? `${rec.id}_${Math.random().toString(36).slice(2, 6)}`
      : rec.id;
    existingIds.add(uniqueId);
    toAppend.push({
      ...rec,
      id: uniqueId,
    });
  }

  const combined = [...updatedExisting, ...toAppend].map((item, idx) => ({
    ...item,
    priority: idx + 1,
  }));

  return {
    sources: sanitizeCustomVideoSources(combined),
    addedCount: toAppend.length,
    pausedBrokenCount,
  };
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
  sourceId: PlayerSourceMode | 'native_watcha' | 'custom_source';
  label: string;
  url?: string;
  isCustomConfigured: boolean;
  customSourceId?: string;
  sourceKindHint?: CustomVideoSourceKind;
  preferredLang?: CustomVideoSourceLang;
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

  const customSources = sanitizeCustomVideoSources(cfg.customSources).filter((s) => s.active);

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

  const pushCustomSources = () => {
    for (const src of customSources) {
      const template =
        params.mediaType === 'tv'
          ? src.tvTemplate || src.movieTemplate
          : src.movieTemplate || src.tvTemplate;
      if (!template) continue;
      const builtUrl = buildCustomEmbedUrl({
        template,
        tmdbId: validId,
        imdbId: params.imdbId,
        mediaType: params.mediaType,
        seasonNumber: season,
        episodeNumber: episode,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
      });
      if (!builtUrl) continue;
      rawList.push({
        sourceId: 'custom_source',
        customSourceId: src.id,
        label: src.name,
        url: builtUrl,
        isCustomConfigured: true,
        sourceKindHint: src.kind,
        preferredLang: src.lang,
      });
    }
  };

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
      label: 'MegaStream Nativo (WatchPlay / VidSrc / EmbedPlayer)',
      isCustomConfigured: false,
    });
  };

  if (cfg.sourceMode === 'custom_template') {
    pushCustomSources();
    pushCustomTemplate();
    pushNative();
    if (hasCustomWatchaflix) pushWatchaflix();
    if (hasCustomMyembed) pushMyembed();
    if (!hasCustomMyembed) pushMyembed();
    if (!hasCustomWatchaflix) pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === 'watchaflix') {
    pushWatchaflix();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushMegaembed();
  } else if (cfg.sourceMode === 'myembed') {
    pushMyembed();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushWatchaflix();
    pushMegaembed();
  } else if (cfg.sourceMode === 'megaembed') {
    pushMegaembed();
    pushCustomSources();
    pushNative();
    pushCustomTemplate();
    pushMyembed();
    pushWatchaflix();
  } else {
    // Default 'megastream_watcha'
    pushNative();
    pushCustomSources();
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
    const key = `${item.sourceId}:${item.customSourceId || ''}:${item.url || 'native'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}


