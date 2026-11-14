import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMegaEmbedUrl,
  buildTmdbImageUrl,
  normalizeTmdbId,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from './playerUrl';
import {
  deduplicateMediaByTmdbId,
  filterAndSortMedia,
  formatRuntimeMinutes,
  getPlanById,
  isValidStreamUrl,
  sanitizePlainText,
} from './catalogUtils';
import { normalizeVercelApiUrl } from './vercelUtils';
import type { MediaItem } from './types';

test('buildMegaEmbedUrl generates valid mgeb.lat URL with player and color fragment', () => {
  const url = buildMegaEmbedUrl({
    tmdbId: 1439930,
    domain: 'mgeb.lat',
    player: 'vidstack',
    colorHex: '#fb542b',
  });
  assert.equal(url, 'https://mgeb.lat/embed/1439930?player=vidstack#color:fb542b');
});

test('buildMegaEmbedUrl supports mgeb.space and falls back safely on invalid inputs', () => {
  const url = buildMegaEmbedUrl({
    tmdbId: 693134,
    domain: 'mgeb.space',
    player: 'unknown_player',
    colorHex: 'invalid',
  });
  assert.equal(url, 'https://mgeb.space/embed/693134?player=vidstack#color:00a8ff');
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
