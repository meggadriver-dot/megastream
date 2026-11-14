import { isValidStreamUrl, sanitizePlainText } from './catalogUtils.ts';
import { sanitizeHexColor } from './playerUrl.ts';
import type { CustomMediaItem, MediaItem, SiteConfig, ThemeId } from './types.ts';

const VALID_THEMES: ThemeId[] = [
  'cinematografico',
  'neon-roxo',
  'minimalista',
  'gold-premium',
  '3d-glass',
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: 'MegaStream',
  siteSlogan: 'Sua diversão em um só lugar!',
  logoUrl: '',
  defaultTheme: 'cinematografico',
  accentColorHex: '',
  announcementEnabled: false,
  announcementText: '',
  enableChannels: true,
  enableAiPage: true,
  enablePlansPage: true,
  maintenanceMode: false,
  footerText: 'MegaStream · Sua diversão em um só lugar!',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function sanitizeOptionalUrl(url: string | null | undefined, maxLength = 500): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) {
    return trimmed.slice(0, maxLength);
  }
  return isValidStreamUrl(trimmed) ? trimmed.slice(0, maxLength) : '';
}

export function sanitizeSiteConfig(
  input: Partial<SiteConfig>,
  current: SiteConfig = DEFAULT_SITE_CONFIG
): SiteConfig {
  const siteName =
    typeof input.siteName === 'string'
      ? sanitizePlainText(input.siteName, 40) || current.siteName
      : current.siteName;

  const siteSlogan =
    typeof input.siteSlogan === 'string'
      ? sanitizePlainText(input.siteSlogan, 100) || current.siteSlogan
      : current.siteSlogan;

  const logoUrl =
    input.logoUrl !== undefined
      ? sanitizeOptionalUrl(input.logoUrl, 500)
      : current.logoUrl;

  const defaultTheme: ThemeId =
    input.defaultTheme && VALID_THEMES.includes(input.defaultTheme)
      ? input.defaultTheme
      : current.defaultTheme;

  let accentColorHex = current.accentColorHex;
  if (input.accentColorHex !== undefined) {
    const raw = input.accentColorHex.trim();
    accentColorHex = raw === '' ? '' : sanitizeHexColor(raw, '');
  }

  const announcementText =
    typeof input.announcementText === 'string'
      ? sanitizePlainText(input.announcementText, 180)
      : current.announcementText;

  const footerText =
    typeof input.footerText === 'string'
      ? sanitizePlainText(input.footerText, 120) || current.footerText
      : current.footerText;

  return {
    siteName,
    siteSlogan,
    logoUrl,
    defaultTheme,
    accentColorHex,
    announcementEnabled:
      typeof input.announcementEnabled === 'boolean'
        ? input.announcementEnabled
        : current.announcementEnabled,
    announcementText,
    enableChannels:
      typeof input.enableChannels === 'boolean' ? input.enableChannels : current.enableChannels,
    enableAiPage:
      typeof input.enableAiPage === 'boolean' ? input.enableAiPage : current.enableAiPage,
    enablePlansPage:
      typeof input.enablePlansPage === 'boolean' ? input.enablePlansPage : current.enablePlansPage,
    maintenanceMode:
      typeof input.maintenanceMode === 'boolean' ? input.maintenanceMode : current.maintenanceMode,
    footerText,
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeCustomMediaInput(
  input: Partial<CustomMediaItem> & { title?: string; mediaType?: string },
  existing?: CustomMediaItem
): CustomMediaItem {
  const mediaType = input.mediaType === 'tv' ? 'tv' : input.mediaType === 'movie' ? 'movie' : existing?.mediaType ?? 'movie';
  const title = sanitizePlainText(input.title ?? existing?.title ?? '', 160);
  if (!title) {
    throw new Error('Título do filme ou série é obrigatório.');
  }

  const rawTmdb = Number(input.tmdbId ?? existing?.tmdbId);
  const tmdbId =
    Number.isInteger(rawTmdb) && rawTmdb > 0
      ? rawTmdb
      : Math.floor(9000000 + (Date.now() % 900000));

  const id =
    existing?.id ||
    (input.id && /^[a-zA-Z0-9_-]{1,64}$/.test(input.id.trim())
      ? input.id.trim()
      : `custom_${mediaType}_${tmdbId}`);

  const overview =
    typeof input.overview === 'string'
      ? sanitizePlainText(input.overview, 1000) || 'Conteúdo adicionado pela administração.'
      : existing?.overview ?? 'Conteúdo adicionado pela administração.';

  const posterRaw =
    input.posterPath !== undefined ? sanitizeOptionalUrl(input.posterPath, 500) : existing?.posterPath ?? null;
  const backdropRaw =
    input.backdropPath !== undefined ? sanitizeOptionalUrl(input.backdropPath, 500) : existing?.backdropPath ?? null;

  const customStreamUrl =
    input.customStreamUrl !== undefined
      ? sanitizeOptionalUrl(input.customStreamUrl, 500) || undefined
      : existing?.customStreamUrl;

  const rawYear =
    typeof input.releaseYear === 'string'
      ? input.releaseYear.replace(/[^0-9]/g, '').slice(0, 4)
      : existing?.releaseYear ?? String(new Date().getFullYear());

  const rawVote = Number(input.voteAverage ?? existing?.voteAverage ?? 8.5);
  const voteAverage = Number.isFinite(rawVote)
    ? Math.max(0, Math.min(10, Number(rawVote.toFixed(1))))
    : 8.5;

  const genreIds = Array.isArray(input.genreIds)
    ? input.genreIds.map((g) => Number(g)).filter((g) => Number.isInteger(g) && g > 0)
    : existing?.genreIds ?? [];

  return {
    id,
    tmdbId,
    mediaType,
    title,
    originalTitle: sanitizePlainText(input.originalTitle ?? existing?.originalTitle ?? title, 160) || title,
    overview,
    posterPath: posterRaw || null,
    backdropPath: backdropRaw || null,
    releaseYear: rawYear || String(new Date().getFullYear()),
    voteAverage,
    genreIds,
    customStreamUrl,
    featured: typeof input.featured === 'boolean' ? input.featured : existing?.featured ?? false,
    active: typeof input.active === 'boolean' ? input.active : existing?.active ?? true,
    updatedAt: new Date().toISOString(),
  };
}

export function customMediaToMediaItem(item: CustomMediaItem): MediaItem {
  return {
    id: item.tmdbId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    title: item.title,
    originalTitle: item.originalTitle || item.title,
    overview: item.overview,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    releaseDate: item.releaseYear ? `${item.releaseYear}-01-01` : '',
    releaseYear: item.releaseYear,
    voteAverage: item.voteAverage,
    voteCount: 100,
    popularity: item.featured ? 9999 : 500,
    genreIds: item.genreIds,
    originalLanguage: 'pt',
    originCountry: ['BR'],
    source: 'tmdb',
  };
}

export function mergeCustomCatalogIntoList(
  baseItems: MediaItem[],
  customItems: CustomMediaItem[],
  mediaTypeFilter?: 'movie' | 'tv'
): MediaItem[] {
  const activeCustom = customItems.filter(
    (c) => c.active && (!mediaTypeFilter || c.mediaType === mediaTypeFilter)
  );
  if (activeCustom.length === 0) return baseItems;

  const overrideMap = new Map<string, MediaItem>();
  for (const c of activeCustom) {
    overrideMap.set(`${c.mediaType}:${c.tmdbId}`, customMediaToMediaItem(c));
  }

  const replaced = baseItems.map((m) => overrideMap.get(`${m.mediaType}:${m.tmdbId}`) ?? m);
  const existingKeys = new Set(replaced.map((m) => `${m.mediaType}:${m.tmdbId}`));

  const newCustoms = activeCustom
    .filter((c) => !existingKeys.has(`${c.mediaType}:${c.tmdbId}`))
    .map(customMediaToMediaItem);

  return [...newCustoms, ...replaced];
}
