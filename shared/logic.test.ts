import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildTmdbImageUrl,
  buildWatchaFlixEmbedUrl,
  normalizeTmdbId,
  normalizeWatchaFlixBaseUrl,
  sanitizeEmbedTemplate,
  sanitizeEmbedTimeoutSeconds,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
  validatePlayerSourceMode,
  validateWatchaFlixLang,
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
  isPlayerRoute,
  isTrackableNonPlayerRoute,
  resolvePlayerBackTarget,
} from './playerNavigation.ts';
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
