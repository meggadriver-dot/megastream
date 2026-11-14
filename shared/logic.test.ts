import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMegaEmbedUrl,
  buildTmdbImageUrl,
  normalizeTmdbId,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from './playerUrl.ts';
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
  createDefaultProfiles,
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
import type { MediaItem } from './types.ts';

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



