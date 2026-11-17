import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLAYER_CONFIG,
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildMyEmbedUrl,
  buildOrderedSourceCascade,
  buildTmdbImageUrl,
  buildWatchaFlixEmbedUrl,
  detectStreamKind,
  extractPlayerBranding,
  normalizeMyEmbedBaseUrl,
  normalizeTmdbId,
  normalizeWatchaFlixBaseUrl,
  resolveHydratedSourceMode,
  resolveSandboxPolicy,
  sanitizeAutoNextCountdownSeconds,
  sanitizeEmbedTemplate,
  sanitizeEmbedTimeoutSeconds,
  sanitizeHexColor,
  sanitizeImdbId,
  sanitizeWatermarkLogoUrl,
  sanitizeWatermarkOpacity,
  sanitizeWatermarkText,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
  validatePlayerAspectMode,
  validatePlayerSourceMode,
  validateSubtitleBg,
  validateSubtitleColor,
  validateSubtitleSize,
  validateWatchaFlixLang,
  validateWatermarkPosition,
  validateWatermarkSize,
} from './playerUrl.ts';
import {
  DEFAULT_SYSTEM_SETTINGS,
  extractPublicRuntimeSettings,
  maskSecretValue,
  sanitizeSecretToken,
  sanitizeSystemSettings,
} from './systemSettingsUtils.ts';
import {
  deduplicateMediaByTmdbId,
  filterAndSortMedia,
  formatRuntimeMinutes,
  getPlanById,
  isValidStreamUrl,
  sanitizePlainText,
} from './catalogUtils.ts';
import { normalizeVercelApiUrl } from './vercelUtils.ts';
import {
  PROFILE_AVATAR_PRESETS,
  canDeleteProfile,
  createDefaultProfiles,
  deduplicateProfilesById,
  hashProfilePin,
  sanitizeAvatarUrl,
  sanitizeProfileName,
  sanitizeProfileTheme,
  shouldShowProfileGate,
  toPublicStreamProfile,
  validateProfilePin,
  verifyProfilePin,
} from './profileUtils.ts';
import {
  DEFAULT_SITE_CONFIG,
  mergeCustomCatalogIntoList,
  sanitizeCustomMediaInput,
  sanitizeSiteConfig,
  toIsoTimestamp,
} from './siteConfigUtils.ts';
import {
  buildFavoriteRecord,
  buildHistoryRecord,
  mergeFavoriteLists,
  mergeHistoryLists,
} from './userLibraryUtils.ts';
import {
  SKIP_NEXT_FINAL_WINDOW_SECONDS,
  isPlayerRoute,
  isTrackableNonPlayerRoute,
  parsePlayerPostMessageEvent,
  resolveNextEpisode,
  resolvePlayerBackTarget,
  shouldShowSkipNextInPlayer,
} from './playerNavigation.ts';
import {
  buildHlsProxyPlaylist,
  convertSrtToVtt,
  decodeSubtitleBuffer,
  detectMediaKindFromBytesOrHeaders,
  extractEmbedPlayerHash,
  extractNestedEmbedUrls,
  extractPlayableStreamFromBody,
  extractPlaylistHosts,
  formatSubtitleLangLabel,
  isAllowedSubtitleHost,
  isCloudflareChallengeHtml,
  isSafePublicHost,
  parseVttCues,
  resolveSegmentMimeType,
} from './subtitleUtils.ts';
import type { MediaItem } from './types.ts';

test('buildFavoriteRecord and buildHistoryRecord clamp values and preserve order on merge', () => {
  const favA = buildFavoriteRecord('user_1', {
    tmdbId: 693134,
    mediaType: 'movie',
    title: '',
    voteAverage: 14.2,
    releaseYear: '2024',
    createdAt: '2026-10-01T10:00:00.000Z',
  });
  assert.equal(favA.title, 'Título');
  assert.equal(favA.voteAverage, 10);
  assert.equal(favA.id, 'movie_693134');

  const favB = buildFavoriteRecord('user_1', {
    tmdbId: 82856,
    mediaType: 'tv',
    title: 'The Mandalorian',
    createdAt: '2026-11-01T10:00:00.000Z',
  });
  const mergedFavs = mergeFavoriteLists([favA], [favB, favA]);
  assert.equal(mergedFavs.length, 2);
  assert.equal(mergedFavs[0].id, 'tv_82856');

  const histOld = buildHistoryRecord('user_1', {
    tmdbId: 1399,
    mediaType: 'tv',
    title: 'Game of Thrones',
    progressPercent: 25,
    seasonNumber: 1,
    episodeNumber: 1,
    watchedAt: '2026-10-01T10:00:00.000Z',
  });
  const histNew = buildHistoryRecord('user_1', {
    tmdbId: 1399,
    mediaType: 'tv',
    title: 'Game of Thrones',
    progressPercent: 130,
    seasonNumber: 1,
    episodeNumber: 2,
    watchedAt: '2026-11-10T10:00:00.000Z',
  });
  assert.equal(histNew.progressPercent, 100);
  const mergedHist = mergeHistoryLists([histOld], [histNew]);
  assert.equal(mergedHist.length, 1);
  assert.equal(mergedHist[0].episodeNumber, 2);
});

test('toIsoTimestamp handles ISO strings, numbers, and Firestore-like Timestamp objects', () => {
  assert.equal(toIsoTimestamp('2026-11-14T12:00:00Z'), '2026-11-14T12:00:00.000Z');
  assert.equal(toIsoTimestamp({ seconds: 1700000000 }), new Date(1700000000 * 1000).toISOString());
  assert.equal(
    toIsoTimestamp({ toDate: () => new Date('2026-05-01T10:30:00.000Z') }),
    '2026-05-01T10:30:00.000Z'
  );
  assert.equal(toIsoTimestamp('invalid-date', 'fallback'), 'fallback');

  const preserved = sanitizeSiteConfig(
    { siteName: 'CineAdmin', updatedAt: '2026-05-01T10:30:00.000Z' },
    DEFAULT_SITE_CONFIG,
    true
  );
  assert.equal(preserved.siteName, 'CineAdmin');
  assert.equal(preserved.updatedAt, '2026-05-01T10:30:00.000Z');
});

test('buildMegaEmbedUrl generates valid mgeb.lat URL with player and color fragment', () => {
  const url = buildMegaEmbedUrl({
    tmdbId: 1439930,
    domain: 'mgeb.lat',
    player: 'vidstack',
    colorHex: '#fb542b',
  });
  assert.equal(url, 'https://mgeb.lat/embed/1439930?player=vidstack#color:fb542b');
});

test('buildMegaEmbedUrl includes season and episode path segments for TV episodes', () => {
  const ep1 = buildMegaEmbedUrl({
    tmdbId: 1399,
    mediaType: 'tv',
    seasonNumber: 1,
    episodeNumber: 1,
    domain: 'mgeb.lat',
    player: 'vidstack',
    colorHex: '00a8ff',
  });
  const ep2 = buildMegaEmbedUrl({
    tmdbId: 1399,
    mediaType: 'tv',
    seasonNumber: 1,
    episodeNumber: 2,
    domain: 'mgeb.lat',
    player: 'vidstack',
    colorHex: '00a8ff',
  });
  const s2ep5 = buildMegaEmbedUrl({
    tmdbId: 1399,
    mediaType: 'tv',
    seasonNumber: 2,
    episodeNumber: 5,
    domain: 'mgeb.space',
    player: 'megaplay',
    colorHex: '#fb542b',
  });
  const specialEp = buildMegaEmbedUrl({
    tmdbId: 1399,
    mediaType: 'tv',
    seasonNumber: 0,
    episodeNumber: 3,
  });

  assert.equal(ep1, 'https://mgeb.lat/embed/1399/1/1?player=vidstack#color:00a8ff');
  assert.equal(ep2, 'https://mgeb.lat/embed/1399/1/2?player=vidstack#color:00a8ff');
  assert.notEqual(ep1, ep2);
  assert.equal(s2ep5, 'https://mgeb.space/embed/1399/2/5?player=megaplay#color:fb542b');
  assert.equal(specialEp, 'https://mgeb.lat/embed/1399/0/3?player=vidstack#color:00a8ff');
});

test('buildMegaEmbedUrl supports mgeb.space and falls back safely on invalid inputs', () => {
  const url = buildMegaEmbedUrl({
    tmdbId: 693134,
    domain: 'mgeb.space',
    player: 'unknown_player',
    colorHex: 'invalid',
  });
  assert.equal(url, 'https://mgeb.space/embed/693134?player=vidstack#color:00a8ff');

  const tvFallback = buildMegaEmbedUrl({
    tmdbId: 82856,
    mediaType: 'tv',
    seasonNumber: -3,
    episodeNumber: 0,
  });
  assert.equal(tvFallback, 'https://mgeb.lat/embed/82856/1/1?player=vidstack#color:00a8ff');
});

test('buildMegaEmbedUrl rejects invalid TMDB IDs', () => {
  assert.throws(() => buildMegaEmbedUrl({ tmdbId: -5 }), /ID TMDB inválido/);
  assert.equal(normalizeTmdbId('abc'), null);
  assert.equal(normalizeTmdbId('693134'), 693134);
});

test('sanitizeHexColor normalizes 3-char and 6-char hex values', () => {
  assert.equal(sanitizeHexColor('#0af'), '00aaff');
  assert.equal(sanitizeHexColor('FB542B'), 'fb542b');
  assert.equal(sanitizeHexColor('xyz', '00a8ff'), '00a8ff');
});

test('validateMegaEmbedDomain and validateMegaEmbedPlayer enforce allowlists', () => {
  assert.equal(validateMegaEmbedDomain('evil.com'), 'mgeb.lat');
  assert.equal(validateMegaEmbedDomain('mgeb.space'), 'mgeb.space');
  assert.equal(validateMegaEmbedPlayer('clappr'), 'clappr');
  assert.equal(validateMegaEmbedPlayer('hacked'), 'vidstack');
});

test('buildTmdbImageUrl handles TMDB paths and local assets cleanly', () => {
  assert.equal(
    buildTmdbImageUrl('/abc123.jpg', 'w500'),
    'https://image.tmdb.org/t/p/w500/abc123.jpg'
  );
  assert.equal(
    buildTmdbImageUrl('/src/assets/images/poster.jpg', 'w500'),
    '/src/assets/images/poster.jpg'
  );
  assert.equal(buildTmdbImageUrl(null), null);
});

const SAMPLE_ITEMS: MediaItem[] = [
  {
    id: 1,
    tmdbId: 693134,
    mediaType: 'movie',
    title: 'Duna: Parte Dois',
    originalTitle: 'Dune: Part Two',
    overview: 'Paul Atreides une-se a Chani.',
    posterPath: '/poster1.jpg',
    backdropPath: '/back1.jpg',
    releaseDate: '2024-02-27',
    releaseYear: '2024',
    voteAverage: 8.3,
    voteCount: 5400,
    popularity: 950,
    genreIds: [878, 12],
    originalLanguage: 'en',
    originCountry: ['US'],
    source: 'demo',
  },
  {
    id: 2,
    tmdbId: 82856,
    mediaType: 'tv',
    title: 'The Mandalorian',
    originalTitle: 'The Mandalorian',
    overview: 'Um caçador de recompensas na galáxia.',
    posterPath: '/poster2.jpg',
    backdropPath: '/back2.jpg',
    releaseDate: '2019-11-12',
    releaseYear: '2019',
    voteAverage: 8.5,
    voteCount: 9800,
    popularity: 800,
    genreIds: [10765, 10759],
    originalLanguage: 'en',
    originCountry: ['US'],
    source: 'demo',
  },
  {
    id: 3,
    tmdbId: 693134,
    mediaType: 'movie',
    title: 'Duna: Parte Dois (Duplicado)',
    originalTitle: 'Dune: Part Two',
    overview: 'Duplicado',
    posterPath: '/poster1.jpg',
    backdropPath: '/back1.jpg',
    releaseDate: '2024-02-27',
    releaseYear: '2024',
    voteAverage: 8.3,
    voteCount: 5400,
    popularity: 950,
    genreIds: [878],
    originalLanguage: 'en',
    originCountry: ['US'],
    source: 'demo',
  },
];

test('deduplicateMediaByTmdbId removes duplicates preserving first entry', () => {
  const deduped = deduplicateMediaByTmdbId(SAMPLE_ITEMS);
  assert.equal(deduped.length, 2);
});

test('filterAndSortMedia filters by mediaType, genre, rating, and sorts properly', () => {
  const deduped = deduplicateMediaByTmdbId(SAMPLE_ITEMS);
  const moviesOnly = filterAndSortMedia(deduped, { mediaType: 'movie' });
  assert.equal(moviesOnly.totalResults, 1);
  assert.equal(moviesOnly.items[0].tmdbId, 693134);

  const byRating = filterAndSortMedia(deduped, { sortBy: 'rating' });
  assert.equal(byRating.items[0].tmdbId, 82856);
});

test('validation and formatting helpers work accurately', () => {
  assert.equal(formatRuntimeMinutes(166), '2h 46min');
  assert.equal(formatRuntimeMinutes(45), '45min');
  assert.equal(isValidStreamUrl('https://stream.example.com/live.m3u8'), true);
  assert.equal(isValidStreamUrl('javascript:alert(1)'), false);
  assert.equal(sanitizePlainText('<script>Oi</script>  Mundo  '), 'scriptOi/script Mundo');
  assert.equal(getPlanById('quarterly')?.priceBrl, 59.9);
});

test('normalizeVercelApiUrl reconstructs /api/* paths from Vercel rewrites cleanly', () => {
  assert.equal(normalizeVercelApiUrl('/api/index?__path=catalog/home'), '/api/catalog/home');
  assert.equal(
    normalizeVercelApiUrl('/api/index?__path=series/82856/seasons&season=1'),
    '/api/series/82856/seasons?season=1'
  );
  assert.equal(
    normalizeVercelApiUrl('/api/index?__path=discover&type=movie&page=2&q=duna'),
    '/api/discover?type=movie&page=2&q=duna'
  );
  assert.equal(normalizeVercelApiUrl('/api/catalog/home'), '/api/catalog/home');
  assert.equal(normalizeVercelApiUrl('/api/index'), '/api');
});

test('profile sanitization and validation helpers enforce constraints', () => {
  assert.equal(sanitizeProfileName('  <b>Ana</b>  '), 'bAna/b');
  assert.equal(sanitizeProfileName('   ', 'Fallback'), 'Fallback');
  assert.equal(sanitizeProfileTheme('neon-roxo'), 'neon-roxo');
  assert.equal(sanitizeProfileTheme('invalid-theme', 'minimalista'), 'minimalista');
  assert.equal(validateProfilePin('1234'), true);
  assert.equal(validateProfilePin('abc99'), true);
  assert.equal(validateProfilePin('123'), false);
  assert.equal(validateProfilePin('12 34'), false);
  assert.equal(validateProfilePin('1234567890123'), false);
});

test('sanitizeAvatarUrl accepts safe asset paths, base64 images, and HTTP(S) URLs only', () => {
  const defaultAvatar = PROFILE_AVATAR_PRESETS[7].fallbackPath;
  assert.equal(sanitizeAvatarUrl('/src/assets/images/avatar_kids_dino_1794675753063.jpg'), '/src/assets/images/avatar_kids_dino_1794675753063.jpg');
  assert.equal(sanitizeAvatarUrl('https://cdn.example.com/avatar.png'), 'https://cdn.example.com/avatar.png');
  assert.equal(sanitizeAvatarUrl('data:image/jpeg;base64,ABCD1234'), 'data:image/jpeg;base64,ABCD1234');
  assert.equal(sanitizeAvatarUrl('javascript:alert(1)'), defaultAvatar);
  assert.equal(sanitizeAvatarUrl('   '), defaultAvatar);
});

test('hashProfilePin and verifyProfilePin hash securely and verify against profileId', async () => {
  const hash = await hashProfilePin('profile_kids', '4321');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, '4321');
  assert.equal(await verifyProfilePin('profile_kids', '4321', hash), true);
  assert.equal(await verifyProfilePin('profile_kids', '9999', hash), false);
  assert.equal(await verifyProfilePin('profile_other', '4321', hash), false);
  await assert.rejects(() => hashProfilePin('profile_kids', '12'), /entre 4 e 12 caracteres/);
});

test('createDefaultProfiles and toPublicStreamProfile strip pinHash from public payloads', () => {
  const defaults = createDefaultProfiles('user_1', 'Lucas');
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, 'profile_main');
  assert.equal(defaults[0].name, 'Lucas');
  assert.equal(defaults[0].hasPin, false);

  const pub = toPublicStreamProfile({ ...defaults[0], hasPin: true, pinHash: 'secret_sha256' });
  assert.equal('pinHash' in pub, false);
  assert.equal(pub.hasPin, true);
});

test('shouldShowProfileGate appears only when authenticated and profile not yet chosen', () => {
  assert.equal(
    shouldShowProfileGate({ isAuthenticated: false, isAuthLoading: false, profileSelectedForSession: false }),
    false
  );
  assert.equal(
    shouldShowProfileGate({ isAuthenticated: true, isAuthLoading: true, profileSelectedForSession: false }),
    false
  );
  assert.equal(
    shouldShowProfileGate({ isAuthenticated: true, isAuthLoading: false, profileSelectedForSession: false }),
    true
  );
  assert.equal(
    shouldShowProfileGate({ isAuthenticated: true, isAuthLoading: false, profileSelectedForSession: true }),
    false
  );
});

test('sanitizeSiteConfig validates site name, theme, accent color, and feature flags', () => {
  const updated = sanitizeSiteConfig(
    {
      siteName: '<b>CineMega</b>',
      siteSlogan: '  O melhor cinema  ',
      defaultTheme: 'gold-premium',
      accentColorHex: '#ff5500',
      announcementEnabled: true,
      announcementText: '<script>Aviso</script> Manutenção hoje',
      enableChannels: false,
      logoUrl: 'javascript:alert(1)',
    },
    DEFAULT_SITE_CONFIG
  );

  assert.equal(updated.siteName, 'bCineMega/b');
  assert.equal(updated.siteSlogan, 'O melhor cinema');
  assert.equal(updated.defaultTheme, 'gold-premium');
  assert.equal(updated.accentColorHex, 'ff5500');
  assert.equal(updated.announcementEnabled, true);
  assert.equal(updated.announcementText, 'scriptAviso/script Manutenção hoje');
  assert.equal(updated.enableChannels, false);
  assert.equal(updated.logoUrl, '');
});

test('sanitizeCustomMediaInput and mergeCustomCatalogIntoList support adding and overriding media', () => {
  const customOverride = sanitizeCustomMediaInput({
    tmdbId: 693134,
    mediaType: 'movie',
    title: 'Duna: Edição Especial Admin',
    releaseYear: '2024',
    voteAverage: 9.8,
    featured: true,
    customStreamUrl: 'https://cdn.example.com/dune-special',
  });

  const brandNew = sanitizeCustomMediaInput({
    tmdbId: 900123,
    mediaType: 'movie',
    title: 'Documentário Exclusivo',
    overview: 'Produção especial.',
  });

  const merged = mergeCustomCatalogIntoList(SAMPLE_ITEMS, [customOverride, brandNew], 'movie');
  assert.equal(merged.some((m) => m.title === 'Documentário Exclusivo'), true);
  const overridden = merged.find((m) => m.tmdbId === 693134 && m.mediaType === 'movie');
  assert.equal(overridden?.title, 'Duna: Edição Especial Admin');
  assert.equal(overridden?.voteAverage, 9.8);
});

test('player navigation helpers never return another player route on back', () => {
  assert.equal(isPlayerRoute('/watch/movie/550'), true);
  assert.equal(isPlayerRoute('/watch/tv/1396?season=2&episode=3'), true);
  assert.equal(isPlayerRoute('/series/1396'), false);

  assert.equal(isTrackableNonPlayerRoute('/series/1396'), true);
  assert.equal(isTrackableNonPlayerRoute('/explore'), true);
  assert.equal(isTrackableNonPlayerRoute('/watch/tv/1396'), false);
  assert.equal(isTrackableNonPlayerRoute('/profiles'), false);

  assert.equal(
    resolvePlayerBackTarget({
      lastNonPlayerRoute: '/explore?type=tv',
      mediaType: 'tv',
      tmdbId: 1396,
    }),
    '/explore?type=tv'
  );
  assert.equal(
    resolvePlayerBackTarget({
      lastNonPlayerRoute: '/watch/movie/999',
      mediaType: 'tv',
      tmdbId: 1396,
    }),
    '/series/1396'
  );
  assert.equal(
    resolvePlayerBackTarget({
      lastNonPlayerRoute: null,
      mediaType: 'movie',
      tmdbId: 238,
    }),
    '/movie/238'
  );
  assert.equal(
    resolvePlayerBackTarget({
      lastNonPlayerRoute: '//evil.example.com',
      mediaType: 'movie',
      tmdbId: null,
    }),
    '/'
  );
});

test('deduplicateProfilesById and canDeleteProfile handle duplicates and enforce minimum one profile', () => {
  const deduped = deduplicateProfilesById([
    { id: 'profile_main', name: 'A' },
    { id: 'prof_2', name: 'B' },
    { id: 'profile_main', name: 'A duplicado' },
  ]);
  assert.equal(deduped.length, 2);
  assert.deepEqual(
    deduped.map((p) => p.id),
    ['profile_main', 'prof_2']
  );

  assert.equal(canDeleteProfile(deduped, 'prof_2').allowed, true);
  assert.equal(canDeleteProfile(deduped, 'missing').allowed, false);
  assert.equal(canDeleteProfile([{ id: 'profile_main' }], 'profile_main').allowed, false);
});

test('buildCustomEmbedUrl and embed sanitization support custom templates safely', () => {
  assert.equal(sanitizeEmbedTemplate('javascript:alert(1)'), '');
  assert.equal(sanitizeEmbedTimeoutSeconds(2), 5);
  assert.equal(sanitizeEmbedTimeoutSeconds(99), 30);

  const movieUrl = buildCustomEmbedUrl({
    template: 'https://embed.example.com/v1/movie/{tmdbId}?engine={player}&accent={color}',
    tmdbId: 693134,
    mediaType: 'movie',
    player: 'megaplay',
    colorHex: '#fb542b',
  });
  assert.equal(movieUrl, 'https://embed.example.com/v1/movie/693134?engine=megaplay&accent=fb542b');

  const tvUrl = buildCustomEmbedUrl({
    template: 'https://embed.example.com/tv/{tmdbId}/{season}/{episode}',
    tmdbId: 1399,
    mediaType: 'tv',
    seasonNumber: 3,
    episodeNumber: 9,
  });
  assert.equal(tvUrl, 'https://embed.example.com/tv/1399/3/9');
});

test('sanitizeSystemSettings, extractPublicRuntimeSettings, and secret masking enforce bounds', () => {
  const updated = sanitizeSystemSettings(
    {
      catalogSource: 'custom_only',
      tmdbBaseUrl: 'https://proxy.tmdb.example/3/',
      tmdbImageBaseUrl: 'https://img.example.com/t/p',
      tmdbLanguage: 'en-US',
      tmdbImageQuality: 'w780',
      cacheTtlMinutes: 9999,
      aiMode: 'disabled',
      aiMaxRecommendations: 2,
      maxProfilesPerAccount: 15,
      allowRegistration: false,
      requireAuthForPlayer: true,
      allowGuestFavorites: false,
      defaultUserPlan: 'monthly',
    },
    DEFAULT_SYSTEM_SETTINGS
  );

  assert.equal(updated.catalogSource, 'custom_only');
  assert.equal(updated.tmdbBaseUrl, 'https://proxy.tmdb.example/3');
  assert.equal(updated.tmdbImageBaseUrl, 'https://img.example.com/t/p/');
  assert.equal(updated.cacheTtlMinutes, 1440);
  assert.equal(updated.aiMaxRecommendations, 4);
  assert.equal(updated.maxProfilesPerAccount, 8);
  assert.equal(updated.defaultUserPlan, 'monthly');

  const publicRuntime = extractPublicRuntimeSettings(updated, 25);
  assert.equal(publicRuntime.allowRegistration, false);
  assert.equal(publicRuntime.requireAuthForPlayer, true);
  assert.equal(publicRuntime.allowGuestFavorites, false);
  assert.equal(publicRuntime.aiEnabled, false);
  assert.equal(publicRuntime.embedTimeoutSeconds, 25);
  assert.equal('tmdbBaseUrl' in publicRuntime, false);

  assert.equal(maskSecretValue('abcdef1234567890'), 'abcd••••7890');
  assert.equal(maskSecretValue('short'), '••••••••');
  assert.equal(sanitizeSecretToken('  tok_123 \n\t abc '), 'tok_123abc');
});

test('WatchaFlix URL normalization, embed building, and source mode validation work cleanly', () => {
  assert.equal(normalizeWatchaFlixBaseUrl('https://watchaflixapi.watcha.one/'), 'https://api.watcha.one');
  assert.equal(normalizeWatchaFlixBaseUrl('watchaflixapi.watcha.one/embed/movie/260514'), 'https://api.watcha.one');
  assert.equal(normalizeWatchaFlixBaseUrl('https://watcha.one'), 'https://api.watcha.one');
  assert.equal(normalizeWatchaFlixBaseUrl('https://api.watcha.one/embed/tv/1396/1/1'), 'https://api.watcha.one');
  assert.equal(normalizeWatchaFlixBaseUrl('javascript:alert(1)'), 'https://api.watcha.one');
  assert.equal(normalizeWatchaFlixBaseUrl('https://proxy.watcha.example/'), 'https://proxy.watcha.example');

  assert.equal(validatePlayerSourceMode('watchaflix'), 'watchaflix');
  assert.equal(validatePlayerSourceMode('unknown', 'megaembed'), 'megaembed');
  assert.equal(validateWatchaFlixLang('en'), 'en');
  assert.equal(validateWatchaFlixLang('fr', 'pt'), 'pt');

  assert.equal(
    buildWatchaFlixEmbedUrl({
      tmdbId: 260514,
      mediaType: 'movie',
      baseUrl: 'https://watchaflixapi.watcha.one/',
      colorHex: '#e50914',
      lang: 'pt',
    }),
    'https://api.watcha.one/embed/movie/260514?color=e50914&lang=pt'
  );

  assert.equal(
    buildWatchaFlixEmbedUrl({
      tmdbId: 1396,
      mediaType: 'tv',
      seasonNumber: 2,
      episodeNumber: 5,
      baseUrl: 'https://api.watcha.one',
      colorHex: '00a8ff',
      lang: 'en',
    }),
    'https://api.watcha.one/embed/tv/1396/2/5?color=00a8ff&lang=en'
  );

  assert.equal(
    buildCustomEmbedUrl({
      template: 'https://api.watcha.one/embed/tv/{tmdb_id}/{temporada}/{episódio}?color={color}',
      tmdbId: 1396,
      mediaType: 'tv',
      seasonNumber: 1,
      episodeNumber: 4,
      colorHex: '#00a8ff',
    }),
    'https://api.watcha.one/embed/tv/1396/1/4?color=00a8ff'
  );
});

test('megastream_watcha primary player, myembed fast source, streamKind detection, and anti-ad sandbox policy work cleanly', () => {
  assert.equal(DEFAULT_PLAYER_CONFIG.sourceMode, 'megastream_watcha');
  assert.equal(DEFAULT_PLAYER_CONFIG.antiAdSandbox, true);
  assert.equal(validatePlayerSourceMode('megastream_watcha'), 'megastream_watcha');
  assert.equal(validatePlayerSourceMode('myembed'), 'myembed');
  assert.equal(normalizeMyEmbedBaseUrl('https://embedmovies.org/'), 'https://myembed.biz');
  assert.equal(normalizeMyEmbedBaseUrl('https://myembed.biz/filme/693134'), 'https://myembed.biz');
  assert.equal(normalizeMyEmbedBaseUrl('javascript:alert(1)'), 'https://myembed.biz');

  assert.equal(
    buildMyEmbedUrl({ tmdbId: 693134, mediaType: 'movie' }),
    'https://myembed.biz/filme/693134'
  );
  assert.equal(
    buildMyEmbedUrl({
      tmdbId: 1399,
      mediaType: 'tv',
      seasonNumber: 2,
      episodeNumber: 4,
    }),
    'https://myembed.biz/serie/1399/2/4'
  );

  assert.equal(detectStreamKind('https://cdn.example.com/live/master.m3u8?token=abc'), 'hls');
  assert.equal(detectStreamKind('https://cdn.example.com/movie.mp4#t=10'), 'video');
  assert.equal(detectStreamKind('https://myembed.biz/filme/693134'), 'iframe');

  assert.equal(resolveSandboxPolicy({ streamKind: 'iframe', antiAdSandbox: true }), 'strict_no_ads');
  assert.equal(resolveSandboxPolicy({ streamKind: 'iframe', antiAdSandbox: false }), 'none');
  assert.equal(resolveSandboxPolicy({ streamKind: 'hls', antiAdSandbox: true }), 'none');
  assert.equal(resolveSandboxPolicy({ streamKind: 'video', antiAdSandbox: true }), 'none');

  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'watchaflix',
      remoteAntiAdSandbox: undefined,
      fallback: 'myembed',
    }),
    'myembed'
  );
  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'watchaflix',
      remoteAntiAdSandbox: true,
      fallback: 'myembed',
    }),
    'watchaflix'
  );
  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'custom_template',
      remoteAntiAdSandbox: undefined,
      fallback: 'myembed',
    }),
    'custom_template'
  );
  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'myembed',
      remoteAntiAdSandbox: true,
      remoteHasPrincipalFields: false,
      fallback: 'megastream_watcha',
    }),
    'megastream_watcha'
  );
  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'myembed',
      remoteAntiAdSandbox: true,
      remoteHasPrincipalFields: true,
      fallback: 'megastream_watcha',
    }),
    'myembed'
  );
  assert.equal(
    resolveHydratedSourceMode({
      remoteSourceMode: 'megastream_watcha',
      remoteAntiAdSandbox: true,
      remoteHasPrincipalFields: true,
      fallback: 'megastream_watcha',
    }),
    'megastream_watcha'
  );
});

test('resolveNextEpisode handles same-season next, TMDB fallback, cross-season rollover, and series finale', () => {
  const seasons = [
    { id: 1, seasonNumber: 0, name: 'Especiais', overview: '', episodeCount: 3, airDate: '', posterPath: null },
    { id: 2, seasonNumber: 1, name: 'Temporada 1', overview: '', episodeCount: 2, airDate: '2020-01-01', posterPath: null },
    { id: 3, seasonNumber: 2, name: 'Temporada 2', overview: '', episodeCount: 5, airDate: '2021-01-01', posterPath: null },
  ];
  const s1Episodes = [
    {
      id: 101,
      episodeNumber: 1,
      seasonNumber: 1,
      name: 'Piloto',
      overview: '',
      stillPath: null,
      airDate: '2020-01-01',
      runtime: 45,
      voteAverage: 8.1,
    },
    {
      id: 102,
      episodeNumber: 2,
      seasonNumber: 1,
      name: 'O Despertar',
      overview: '',
      stillPath: null,
      airDate: '2020-01-08',
      runtime: 48,
      voteAverage: 8.5,
    },
  ];

  // Next episode in same season
  assert.deepEqual(
    resolveNextEpisode({
      currentSeason: 1,
      currentEpisode: 1,
      seasons,
      episodes: s1Episodes,
    }),
    {
      seasonNumber: 1,
      episodeNumber: 2,
      title: 'O Despertar',
      isNewSeason: false,
    }
  );

  // Cross-season rollover at end of season 1
  assert.deepEqual(
    resolveNextEpisode({
      currentSeason: 1,
      currentEpisode: 2,
      seasons,
      episodes: s1Episodes,
    }),
    {
      seasonNumber: 2,
      episodeNumber: 1,
      title: 'Temporada 2 · Ep. 1',
      isNewSeason: true,
    }
  );

  // Skipping season 0 specials when moving forward from season 0
  assert.deepEqual(
    resolveNextEpisode({
      currentSeason: 0,
      currentEpisode: 3,
      seasons,
      episodes: [],
    }),
    {
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Temporada 1 · Ep. 1',
      isNewSeason: true,
    }
  );

  // TMDB season metadata fallback when episodes list hasn't loaded yet
  assert.deepEqual(
    resolveNextEpisode({
      currentSeason: 2,
      currentEpisode: 2,
      seasons,
      episodes: [],
    }),
    {
      seasonNumber: 2,
      episodeNumber: 3,
      title: 'Episódio 3',
      isNewSeason: false,
    }
  );

  // Series finale returns null
  assert.equal(
    resolveNextEpisode({
      currentSeason: 2,
      currentEpisode: 5,
      seasons,
      episodes: [],
    }),
    null
  );
});

test('parsePlayerPostMessageEvent detects completion signals safely', () => {
  assert.deepEqual(parsePlayerPostMessageEvent('ended'), { ended: true });
  assert.deepEqual(parsePlayerPostMessageEvent('MEDIA_ENDED'), { ended: true });
  assert.deepEqual(parsePlayerPostMessageEvent('{"event":"complete"}'), { ended: true });
  assert.deepEqual(parsePlayerPostMessageEvent({ type: 'next_episode' }), {
    ended: true,
    nextRequested: true,
  });
  assert.deepEqual(parsePlayerPostMessageEvent({ currentTime: 2519, duration: 2520 }), {
    ended: true,
  });
  assert.deepEqual(parsePlayerPostMessageEvent({ currentTime: 120, duration: 2520 }), {
    ended: false,
  });
  assert.deepEqual(parsePlayerPostMessageEvent('invalid-message'), { ended: false });
  assert.deepEqual(parsePlayerPostMessageEvent(null), { ended: false });
});

test('extractPlayerBranding, watermark sanitizers, and IMDb EmbedMovies building enforce bounds', () => {
  assert.equal(sanitizeWatermarkOpacity(0.05), 0.15);
  assert.equal(sanitizeWatermarkOpacity(2.5), 1);
  assert.equal(sanitizeWatermarkOpacity('invalid', 0.85), 0.85);

  assert.equal(sanitizeAutoNextCountdownSeconds(1), 3);
  assert.equal(sanitizeAutoNextCountdownSeconds(99), 30);
  assert.equal(sanitizeAutoNextCountdownSeconds('bad', 8), 8);

  assert.equal(sanitizeWatermarkLogoUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeWatermarkLogoUrl('/src/assets/images/logo.png'), '/src/assets/images/logo.png');
  assert.equal(sanitizeWatermarkLogoUrl('https://cdn.example.com/logo.svg'), 'https://cdn.example.com/logo.svg');
  assert.equal(sanitizeWatermarkText('  <b>MegaStream</b>  HD  '), 'bMegaStream/b HD');

  assert.equal(validateWatermarkPosition('bottom-right'), 'bottom-right');
  assert.equal(validateWatermarkPosition('center', 'top-left'), 'top-left');
  assert.equal(validateWatermarkSize('lg'), 'lg');
  assert.equal(validateWatermarkSize('xl', 'md'), 'md');

  assert.equal(sanitizeImdbId('TT15239678'), 'tt15239678');
  assert.equal(sanitizeImdbId('not-imdb'), null);

  assert.equal(validatePlayerAspectMode('cinema'), 'cinema');
  assert.equal(validatePlayerAspectMode('invalid', 'contain'), 'contain');
  assert.equal(validateSubtitleSize('lg'), 'lg');
  assert.equal(validateSubtitleSize('bad', 'md'), 'md');
  assert.equal(validateSubtitleColor('yellow'), 'yellow');
  assert.equal(validateSubtitleColor('purple', 'white'), 'white');
  assert.equal(validateSubtitleBg('shadow'), 'shadow');
  assert.equal(validateSubtitleBg('unknown', 'box'), 'box');

  const branding = extractPlayerBranding({
    defaultColorHex: '#e50914',
    watchaflixLang: 'en',
    defaultAspectMode: 'cinema',
    autoEnableSubtitles: true,
    defaultSubtitleSize: 'lg',
    defaultSubtitleColor: 'yellow',
    defaultSubtitleBg: 'shadow',
    allowTvCast: false,
    allowPipMode: true,
    allowTheaterMode: false,
    watermarkEnabled: true,
    watermarkText: 'MegaStream VIP',
    watermarkLogoUrl: 'https://cdn.example.com/ms.png',
    watermarkPosition: 'bottom-left',
    watermarkOpacity: 0.7,
    watermarkSize: 'lg',
    autoNextEpisode: true,
    autoNextCountdownSeconds: 5,
  });

  assert.deepEqual(branding, {
    colorHex: 'e50914',
    preferredLang: 'en',
    defaultAspectMode: 'cinema',
    autoEnableSubtitles: true,
    defaultSubtitleSize: 'lg',
    defaultSubtitleColor: 'yellow',
    defaultSubtitleBg: 'shadow',
    allowTvCast: false,
    allowPipMode: true,
    allowTheaterMode: false,
    watermarkEnabled: true,
    watermarkText: 'MegaStream VIP',
    watermarkLogoUrl: 'https://cdn.example.com/ms.png',
    watermarkPosition: 'bottom-left',
    watermarkOpacity: 0.7,
    watermarkSize: 'lg',
    autoNextEpisode: true,
    autoNextCountdownSeconds: 5,
  });

  assert.equal(
    buildMyEmbedUrl({
      tmdbId: 693134,
      imdbId: 'tt15239678',
      preferImdbForMovies: true,
      mediaType: 'movie',
    }),
    'https://myembed.biz/filme/tt15239678'
  );
  assert.equal(
    buildMyEmbedUrl({
      tmdbId: 693134,
      imdbId: 'invalid',
      preferImdbForMovies: true,
      mediaType: 'movie',
    }),
    'https://myembed.biz/filme/693134'
  );
  assert.equal(
    buildMyEmbedUrl({
      tmdbId: 693134,
      imdbId: 'tt15239678',
      preferImdbForMovies: false,
      mediaType: 'movie',
    }),
    'https://myembed.biz/filme/693134'
  );
  assert.equal(
    buildCustomEmbedUrl({
      template: 'https://embed.example.com/filme/{imdbId}',
      tmdbId: 693134,
      imdbId: 'tt15239678',
      mediaType: 'movie',
    }),
    'https://embed.example.com/filme/tt15239678'
  );
});

test('subtitle utilities, HLS proxy rewriter, and clean watermark defaults work accurately', () => {
  assert.equal(DEFAULT_PLAYER_CONFIG.watermarkEnabled, false);
  assert.equal(formatSubtitleLangLabel('pob'), 'Português (BR)');
  assert.equal(formatSubtitleLangLabel('eng'), 'Inglês');
  assert.equal(formatSubtitleLangLabel('spa'), 'Espanhol');

  assert.equal(isAllowedSubtitleHost('https://subs5.strem.io/en/download/sub.srt'), true);
  assert.equal(isAllowedSubtitleHost('http://subs5.strem.io/en/download/sub.srt'), false);
  assert.equal(isAllowedSubtitleHost('https://evil.example.com/sub.srt'), false);

  const rawSrt =
    '\uFEFF1\r\n00:00:01,500 --> 00:00:04,000\r\n{\\an8}<font color="#fff">Olá, mundo!</font>\r\nSegunda linha\r\n\r\n2\r\n00:00:05,000 --> 00:00:07,250\r\nTeste de legenda\r\n';
  const vtt = convertSrtToVtt(rawSrt, 1.5);
  assert.equal(vtt.startsWith('WEBVTT'), true);
  assert.equal(vtt.includes('00:00:03.000 --> 00:00:05.500'), true);
  assert.equal(vtt.includes('{\\an8}'), false);
  assert.equal(vtt.includes('<font'), false);

  const cues = parseVttCues(vtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 3);
  assert.equal(cues[0].end, 5.5);
  assert.equal(cues[0].text, 'Olá, mundo!\nSegunda linha');
  assert.equal(cues[1].start, 6.5);
  assert.equal(cues[1].text, 'Teste de legenda');

  const rawPlaylist = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key.bin"',
    '#EXTINF:6.000,',
    '0000.js',
  ].join('\n');
  const rewritten = buildHlsProxyPlaylist(
    rawPlaylist,
    'https://cdn.example.com/stream/playlist.m3u8?md5=abc',
    '/api/player/hls/tok123/seg'
  );
  assert.equal(
    rewritten.includes('#EXT-X-MAP:URI="/api/player/hls/tok123/seg?u=https%3A%2F%2Fcdn.example.com%2Fstream%2Finit.mp4"'),
    true
  );
  assert.equal(
    rewritten.includes('/api/player/hls/tok123/seg?u=https%3A%2F%2Fcdn.example.com%2Fstream%2F0000.js'),
    true
  );

  // Valid UTF-8 accented Portuguese decodes cleanly without CP1252 mojibake
  const utf8Bytes = new TextEncoder().encode('Aqui está a Água da Vida — Ação!');
  assert.equal(decodeSubtitleBuffer(utf8Bytes), 'Aqui está a Água da Vida — Ação!');

  // True CP1252 legacy bytes fall back cleanly to windows-1252
  const cp1252Bytes = new Uint8Array([0x43, 0x6f, 0x72, 0x61, 0xe7, 0xe3, 0x6f]); // "Coração"
  assert.equal(decodeSubtitleBuffer(cp1252Bytes), 'Coração');
});

test('multi-CDN HLS proxy helpers validate public hosts, extract playlist hosts, normalize disguised MIME, and parse embedplayer hash', () => {
  assert.equal(isSafePublicHost('eloialu6.xyz'), true);
  assert.equal(isSafePublicHost('cdn.hclod.qzz.io'), true);
  assert.equal(isSafePublicHost('localhost'), false);
  assert.equal(isSafePublicHost('127.0.0.1'), false);
  assert.equal(isSafePublicHost('10.0.0.5'), false);
  assert.equal(isSafePublicHost('192.168.1.10'), false);
  assert.equal(isSafePublicHost('169.254.169.254'), false);
  assert.equal(isSafePublicHost('172.20.0.1'), false);
  assert.equal(isSafePublicHost('[::1]'), false);
  assert.equal(isSafePublicHost('metadata.google.internal'), false);

  const hosts = extractPlaylistHosts(
    [
      '#EXTM3U',
      '#EXT-X-MAP:URI="https://init.cdn-a.example/map.mp4"',
      '#EXTINF:4.0,',
      'https://eloialu6.xyz/seg1.css',
      '#EXTINF:4.0,',
      'https://eloialu7.xyz/seg2.woff',
      '#EXTINF:4.0,',
      '/hls/relative-chunk.js',
    ].join('\n'),
    'https://embedplayer2.xyz/cdn/hls/abc/master.m3u8'
  );
  assert.deepEqual(hosts, [
    'init.cdn-a.example',
    'eloialu6.xyz',
    'eloialu7.xyz',
    'embedplayer2.xyz',
  ]);

  assert.equal(resolveSegmentMimeType('https://cdn.example/0000.css', 'text/css'), 'application/octet-stream');
  assert.equal(resolveSegmentMimeType('https://cdn.example/0000.woff', 'font/woff'), 'application/octet-stream');
  assert.equal(resolveSegmentMimeType('https://cdn.example/0000.js', 'application/javascript'), 'application/octet-stream');
  assert.equal(resolveSegmentMimeType('https://cdn.example/init.mp4?t=1', 'video/mp4'), 'video/mp4');
  assert.equal(resolveSegmentMimeType('https://cdn.example/seg.ts', 'video/mp2t'), 'video/mp2t');

  assert.deepEqual(
    extractEmbedPlayerHash('https://embedplayer2.xyz/video/26fd45817c0a0bb1e951d17fa7df947c'),
    {
      origin: 'https://embedplayer2.xyz',
      hash: '26fd45817c0a0bb1e951d17fa7df947c',
    }
  );
  assert.equal(extractEmbedPlayerHash('https://superflixapi.boats/serie/1408/1/1'), null);
});

test('shouldShowSkipNextInPlayer shows skip option only at the end of each episode', () => {
  assert.equal(SKIP_NEXT_FINAL_WINDOW_SECONDS, 45);

  // Never shown when there is no next episode (movies or finale)
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: false,
      durationSeconds: 2400,
      currentTimeSeconds: 2395,
      isEnded: true,
    }),
    false
  );

  // Hidden at start & middle of episode
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 2400,
      currentTimeSeconds: 0,
    }),
    false
  );
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 2400,
      currentTimeSeconds: 1800,
    }),
    false
  );
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 2400,
      currentTimeSeconds: 2354,
    }),
    false
  );

  // Visible within final 45 seconds or when ended
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 2400,
      currentTimeSeconds: 2355,
    }),
    true
  );
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 2400,
      currentTimeSeconds: 2399,
      isEnded: true,
    }),
    true
  );

  // Short clips (<= 60s) show only in final 25%
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 40,
      currentTimeSeconds: 10,
    }),
    false
  );
  assert.equal(
    shouldShowSkipNextInPlayer({
      hasNextEpisode: true,
      durationSeconds: 40,
      currentTimeSeconds: 32,
    }),
    true
  );
});

test('buildOrderedSourceCascade prioritizes selected Admin mode first and auto-cascades across all clean sources without duplicates', () => {
  const customCfg = {
    ...DEFAULT_PLAYER_CONFIG,
    sourceMode: 'custom_template' as const,
    customEmbedMovieTemplate: 'https://new-api.example.com/movie/{tmdbId}.m3u8',
    customEmbedTvTemplate: 'https://new-api.example.com/tv/{tmdbId}/{season}/{episode}.m3u8',
    watchaflixBaseUrl: 'https://mirror.watcha.example',
  };

  const customOrder = buildOrderedSourceCascade(customCfg, {
    tmdbId: 693134,
    mediaType: 'movie',
  });
  assert.equal(customOrder[0]?.sourceId, 'custom_template');
  assert.equal(customOrder[0]?.url, 'https://new-api.example.com/movie/693134.m3u8');
  assert.equal(customOrder[1]?.sourceId, 'native_watcha');
  assert.equal(customOrder.some((s) => s.sourceId === 'watchaflix' && s.isCustomConfigured), true);

  const megaOrder = buildOrderedSourceCascade(
    { ...customCfg, sourceMode: 'megaembed' },
    { tmdbId: 1399, mediaType: 'tv', seasonNumber: 1, episodeNumber: 2 }
  );
  assert.equal(megaOrder[0]?.sourceId, 'megaembed');
  assert.equal(megaOrder.some((s) => s.sourceId === 'native_watcha'), true);
  assert.equal(megaOrder.some((s) => s.sourceId === 'custom_template'), true);

  // Deduplication guarantee
  const keys = megaOrder.map((s) => `${s.sourceId}:${s.url || 'native'}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('isCloudflareChallengeHtml, extractPlayableStreamFromBody, and extractNestedEmbedUrls reject CF/ads/SSRF and extract streams cleanly', () => {
  assert.equal(
    isCloudflareChallengeHtml('<html><head><title>Just a moment...</title></head></html>', 403),
    true
  );
  assert.equal(
    isCloudflareChallengeHtml('<html><div class="cf-turnstile"></div></html>', 200),
    true
  );
  // Passive CF bot beacon on a valid 200 embed player page must NOT false-positive
  assert.equal(
    isCloudflareChallengeHtml(
      '<html><body><video src="https://cdn.example/video.mp4"></video><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>',
      200
    ),
    false
  );

  const jsonHls = extractPlayableStreamFromBody(
    JSON.stringify({
      hls: true,
      videoImage: 'https://img.example/poster.jpg',
      securedLink: 'https://cdn.example.com/hls/master.m3u8?token=xyz',
    }),
    'https://api.example.com/getVideo'
  );
  assert.deepEqual(jsonHls, {
    streamUrl: 'https://cdn.example.com/hls/master.m3u8?token=xyz',
    streamKind: 'hls',
    posterUrl: 'https://img.example/poster.jpg',
  });

  const htmlMp4 = extractPlayableStreamFromBody(
    '<div data-poster="https://img.example/p.jpg"><script>var cfg = { url: "https:\\/\\/cdn.example.com\\/movie\\/stream.mp4?md5=1" };</script></div>',
    'https://embed.example.com/movie/1'
  );
  assert.deepEqual(htmlMp4, {
    streamUrl: 'https://cdn.example.com/movie/stream.mp4?md5=1',
    streamKind: 'video',
    posterUrl: 'https://img.example/p.jpg',
  });

  // Rejects ad/tracker domains and SSRF internal hosts
  assert.equal(
    extractPlayableStreamFromBody(
      '<video src="http://127.0.0.1/internal.mp4"></video><script>url: "https://mypopads.com/ad.mp4"</script>',
      'https://embed.example.com/'
    ),
    null
  );

  // Nested iframe extraction filters ad trackers & about:blank cleanly
  assert.deepEqual(
    extractNestedEmbedUrls(
      '<iframe src="about:blank"></iframe><iframe src="https://sinonneurism.com/pop"></iframe><iframe src="https://clean-player.example.com/embed/123"></iframe>',
      'https://wrapper.example.com/'
    ),
    ['https://clean-player.example.com/embed/123']
  );
});

test('detectMediaKindFromBytesOrHeaders and resolveSegmentMimeType detect extensionless direct streams accurately', () => {
  // MP4 ftyp header with extensionless octet-stream URL
  const mp4Header = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://cdn.example.com/play?id=999',
      contentType: 'application/octet-stream',
      sniffBytes: mp4Header,
    }),
    'video'
  );

  // WebM EBML header with extensionless octet-stream URL
  const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://cdn.example.com/stream',
      contentType: 'application/octet-stream',
      sniffBytes: webmHeader,
    }),
    'video'
  );

  // HLS manifest with UTF-8 BOM and text/plain header
  const hlsBomBytes = new TextEncoder().encode('\uFEFF#EXTM3U\n#EXT-X-VERSION:3\n');
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://cdn.example.com/manifest?token=1',
      contentType: 'text/plain',
      sniffBytes: hlsBomBytes,
    }),
    'hls'
  );

  // Content-Disposition filename detection
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://cdn.example.com/download?file=1',
      contentType: 'application/octet-stream',
      contentDisposition: 'inline; filename="movie_hd.mp4"',
    }),
    'video'
  );

  // Reject HTML document disguised behind unknown endpoint
  const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html><body>Just a moment</body></html>');
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://cdn.example.com/embed/123',
      contentType: 'application/octet-stream',
      sniffBytes: htmlBytes,
    }),
    null
  );

  assert.equal(detectStreamKind('https://cdn.example.com/video.m4v?auth=1'), 'video');
  assert.equal(detectStreamKind('https://cdn.example.com/stream?format=m3u8'), 'hls');
  assert.equal(resolveSegmentMimeType('https://cdn.example.com/clip.webm'), 'video/webm');
  assert.equal(resolveSegmentMimeType('https://cdn.example.com/clip.m4v'), 'video/mp4');
});





