import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildM3uPlaylistContent,
  buildAndroidIntentUrl,
  buildVlcStreamUrl,
  isLocalhostOrigin,
  resolveLanShareUrl,
  toAbsoluteStreamUrl,
  sanitizeM3uFileName,
} from './castUtils.ts';
import {
  DEFAULT_PLAYER_CONFIG,
  RECOMMENDED_CUSTOM_SOURCES,
  buildCustomEmbedUrl,
  sanitizeCustomVideoSources,
  buildOrderedSourceCascade,
  consolidateAudioOptionsByLanguage,
  detectStreamKind,
  formatSourceLanguageOptionLabel,
  getCustomSourceLangMeta,
  hasUrlTemplatePlaceholder,
  mergeRecommendedCustomSources,
  parseM3uPlaylistText,
} from './playerUrl.ts';
import {
  buildHlsProxyPlaylist,
  convertSrtToVtt,
  detectMediaKindFromBytesOrHeaders,
  extractNestedEmbedUrls,
  extractPlayableStreamFromBody,
  extractPlayableStreamsFromBody,
  hasAdOrAntiSandboxTraps,
  isAggregatorOrWrapperHtml,
  isAllowedSubtitleHost,
  isCloudflareChallengeHtml,
  mergeAndDisambiguateSubtitles,
  parseBuzzQPayload,
  parseNovelasCdnOrFshdHtml,
  parsePlayerFlixStyleUrl,
  resolveSegmentMimeType,
  selectBestVidLinkMedia,
  selectVidLinkCandidates,
  unpackFirePlayerScript,
} from './subtitleUtils.ts';
import {
  detectArchiveDocLanguage,
  extractChapterOrEpisodeFromTitle,
  matchArchiveEpisodeFile,
  resolveFreeApiUrl,
  scoreArchiveSearchDoc,
  selectBestDailymotionVideos,
  selectBestFreeApiAnimeMatch,
  selectBestFreeApiMovieMatch,
  stripDatesFromEpisodeTitle,
} from './openMediaMatchers.ts';
import {
  filterAndSortMedia,
  mergeUnifiedTmdbGenres,
  parseCatalogSearchTarget,
  resolveTmdbGenreForMediaType,
} from './catalogUtils.ts';
import {
  hasNextPlayableCandidate,
  pickNextPlayableCandidate,
  shouldAutoRetryMutedOnPlayError,
} from './playerFailover.ts';
import {
  buildStreamBetter451Candidates,
  buildStreamBetterCanonicalUrl,
  buildStreamBetterV1StreamUrl,
  extractStreamBetterSlugFromUrl,
  extractStreamFlashMp4FromHtml,
  isStreamBetterHost,
  mapStreamBetterChannelCategory,
  parseStreamBetterV1Sources,
  slugifyStreamBetterParam,
} from './streamBetterUtils.ts';
import {
  buildChannelMatchKeys,
  cleanDirectChannelDisplayName,
  isDirectM3uChannelBlocked,
  mapIptvGroupToChannelCategory,
  normalizeChannelMatchKey,
  parseDirectChannelM3u,
} from './directChannelUtils.ts';

test('castUtils generates absolute URLs, M3U playlists, Android intent URLs, and VLC links', () => {
  assert.equal(
    toAbsoluteStreamUrl('/api/player/hls/abc/playlist.m3u8', 'https://megastream.vercel.app'),
    'https://megastream.vercel.app/api/player/hls/abc/playlist.m3u8'
  );

  const m3u = buildM3uPlaylistContent({
    title: 'Big Bang: A Teoria T01E01',
    streamUrl: '/api/player/hls/abc/playlist.m3u8',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    origin: 'https://megastream.vercel.app',
  });
  assert.match(m3u, /^#EXTM3U\n/);
  assert.match(m3u, /tvg-name="Big Bang: A Teoria T01E01"/);
  assert.match(m3u, /tvg-logo="https:\/\/image\.tmdb\.org\/t\/p\/w500\/poster\.jpg"/);
  assert.match(m3u, /https:\/\/megastream\.vercel\.app\/api\/player\/hls\/abc\/playlist\.m3u8/);

  const intent = buildAndroidIntentUrl(
    '/api/player/hls/abc/playlist.m3u8',
    'Big Bang',
    'https://megastream.vercel.app'
  );
  assert.equal(
    intent,
    'intent://megastream.vercel.app/api/player/hls/abc/playlist.m3u8#Intent;scheme=https;type=video/*;action=android.intent.action.VIEW;S.title=Big%20Bang;end'
  );

  assert.equal(
    buildVlcStreamUrl('/api/player/video/xyz', 'https://megastream.vercel.app'),
    'vlc://https://megastream.vercel.app/api/player/video/xyz'
  );

  assert.equal(sanitizeM3uFileName('Café & Ação: T01E01'), 'cafe-acao-t01e01.m3u');
});

test('sanitizeCustomVideoSources validates, clamps, deduplicates, and sorts by priority', () => {
  const cleaned = sanitizeCustomVideoSources([
    {
      id: 's2',
      name: 'Fonte B',
      kind: 'embed',
      movieTemplate: 'https://api-b.example.com/movie/{tmdbId}',
      tvTemplate: 'https://api-b.example.com/tv/{tmdbId}/{season}/{episode}',
      lang: 'en',
      priority: 20,
      active: true,
    },
    {
      id: 's1',
      name: 'Fonte A <script>',
      kind: 'api',
      movieTemplate: 'https://api-a.example.com/m/{imdbId}',
      tvTemplate: '',
      lang: 'pt',
      priority: 5,
      active: true,
    },
    {
      id: 's3_sub',
      name: 'Servidor Legendado',
      kind: 'api',
      movieTemplate: 'https://api-sub.example.com/m/{tmdbId}',
      tvTemplate: 'https://api-sub.example.com/tv/{tmdbId}/{season}/{episode}',
      lang: 'sub',
      priority: 15,
      active: true,
    },
    {
      id: 's4_es',
      name: 'Servidor Latino',
      kind: 'direct',
      movieTemplate: 'https://cdn-es.example.com/{tmdbId}.m3u8',
      tvTemplate: '',
      lang: 'es',
      priority: 25,
      active: true,
    },
    {
      id: 's_invalid_js',
      name: 'Invalid',
      kind: 'direct',
      movieTemplate: 'javascript:alert(1)',
      tvTemplate: '',
      lang: 'auto',
      priority: 1,
      active: true,
    },
  ]);

  assert.equal(cleaned.length, 4);
  assert.equal(cleaned[0].id, 's1');
  assert.equal(cleaned[0].name, 'Fonte A script');
  assert.equal(cleaned[1].id, 's3_sub');
  assert.equal(cleaned[1].lang, 'sub');
  assert.equal(cleaned[2].id, 's2');
  assert.equal(cleaned[3].id, 's4_es');
  assert.equal(cleaned[3].lang, 'es');
});

test('formatSourceLanguageOptionLabel and getCustomSourceLangMeta format language + server labels cleanly', () => {
  assert.deepEqual(formatSourceLanguageOptionLabel('Servidor VIP', 'pt'), {
    label: 'Dublado (PT-BR) · Servidor VIP',
    languageLabel: 'Dublado (PT-BR)',
    sourceName: 'Servidor VIP',
    langCode: 'pt-br',
  });
  assert.deepEqual(formatSourceLanguageOptionLabel('Fonte 2', 'sub'), {
    label: 'Legendado (PT-BR) · Fonte 2',
    languageLabel: 'Legendado (PT-BR)',
    sourceName: 'Fonte 2',
    langCode: 'pt-sub',
  });
  assert.deepEqual(formatSourceLanguageOptionLabel('Global', 'en'), {
    label: 'Inglês / Original · Global',
    languageLabel: 'Inglês / Original',
    sourceName: 'Global',
    langCode: 'en-us',
  });
  assert.deepEqual(formatSourceLanguageOptionLabel('Latam', 'es'), {
    label: 'Espanhol · Latam',
    languageLabel: 'Espanhol',
    sourceName: 'Latam',
    langCode: 'es-es',
  });
  assert.deepEqual(formatSourceLanguageOptionLabel('Mirror X', 'auto'), {
    label: 'Mirror X (Auto)',
    languageLabel: 'Automático',
    sourceName: 'Mirror X',
    langCode: 'auto',
  });
  assert.equal(getCustomSourceLangMeta('pt-sub').shortTag, 'LEG');
  assert.equal(getCustomSourceLangMeta('es-es').shortTag, 'ES');
});

test('buildOrderedSourceCascade includes active customSources sorted by priority', () => {
  const cascade = buildOrderedSourceCascade(
    {
      ...DEFAULT_PLAYER_CONFIG,
      customSources: [
        {
          id: 'inactive_1',
          name: 'Inativa',
          kind: 'api',
          movieTemplate: 'https://dead.example.com/{tmdbId}',
          tvTemplate: 'https://dead.example.com/{tmdbId}/{season}/{episode}',
          lang: 'pt',
          priority: 1,
          active: false,
        },
        {
          id: 'api_pt',
          name: 'API PT Principal',
          kind: 'api',
          movieTemplate: 'https://stream.example.com/m/{tmdbId}',
          tvTemplate: 'https://stream.example.com/tv/{tmdbId}/{season}/{episode}',
          lang: 'pt',
          priority: 2,
          active: true,
        },
      ],
    },
    {
      tmdbId: 1418,
      imdbId: 'tt0898266',
      mediaType: 'tv',
      seasonNumber: 1,
      episodeNumber: 1,
    }
  );

  const customItems = cascade.filter((c) => c.sourceId === 'custom_source');
  assert.equal(customItems.length, 1);
  assert.equal(customItems[0].label, 'API PT Principal');
  assert.equal(customItems[0].url, 'https://stream.example.com/tv/1418/1/1');
});

test('buildHlsProxyPlaylist supports signed segment URLs and subtitleUtils guards Cloudflare', () => {
  const manifest = '#EXTM3U\n#EXT-X-MEDIA:URI="audio/pt.m3u8"\nseg01.jpg?foo=1\n';
  const rewritten = buildHlsProxyPlaylist(
    manifest,
    'https://vidsrc.buzz/stream/master.m3u8',
    '/api/player/hls/tok123/seg',
    (u) => `sig_${u.length}`
  );

  assert.match(rewritten, /URI="\/api\/player\/hls\/tok123\/seg\?u=https%3A%2F%2Fvidsrc\.buzz%2Fstream%2Faudio%2Fpt\.m3u8&s=sig_/);
  assert.match(rewritten, /\/api\/player\/hls\/tok123\/seg\?u=https%3A%2F%2Fvidsrc\.buzz%2Fstream%2Fseg01\.jpg%3Ffoo%3D1&s=sig_/);

  assert.equal(isCloudflareChallengeHtml('<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/"></script>', 403), true);
  assert.equal(isCloudflareChallengeHtml('#EXTM3U\n#EXTINF:10,\nchunk.ts', 200), false);

  const extracted = extractPlayableStreamFromBody(
    JSON.stringify({ url: '/_stream?id=abc123', type: 'hls' }),
    'https://vidsrc.buzz/pl/api.php'
  );
  assert.deepEqual(extracted, {
    streamUrl: 'https://vidsrc.buzz/_stream?id=abc123',
    streamKind: 'hls',
    posterUrl: null,
  });

  const ext3muBytes = new TextEncoder().encode('#EXTM3U\n#EXT-X-VERSION:3\n');
  assert.equal(
    detectMediaKindFromBytesOrHeaders({
      url: 'https://vidsrc.buzz/_stream?id=abc123',
      contentType: 'application/x-mpegurl',
      sniffBytes: ext3muBytes,
    }),
    'hls'
  );
});

test('consolidateAudioOptionsByLanguage hides server names, drops iframes when direct streams exist, and groups backups per language', () => {
  const consolidated = consolidateAudioOptionsByLanguage([
    {
      id: 'embed_pt',
      label: 'Dublado (PT-BR) · MyEmbed',
      languageLabel: 'Dublado (PT-BR)',
      sourceName: 'MyEmbed',
      lang: 'pt-br',
      streamUrl: 'https://myembed.biz/filme/693134',
      streamKind: 'iframe',
    },
    {
      id: 'hls_pt_1',
      label: 'Dublado (PT-BR) · WatchPlay',
      languageLabel: 'Dublado (PT-BR)',
      sourceName: 'WatchPlay',
      lang: 'pt-br',
      streamUrl: '/api/player/hls/pt1/playlist.m3u8',
      streamKind: 'hls',
    },
    {
      id: 'hls_en_1',
      label: 'Inglês / Original · VidSrc 1',
      languageLabel: 'Inglês / Original',
      sourceName: 'VidSrc 1',
      lang: 'en-us',
      streamUrl: '/api/player/hls/en1/playlist.m3u8',
      streamKind: 'hls',
    },
    {
      id: 'hls_en_2',
      label: 'Inglês / Original · VidSrc 2',
      languageLabel: 'Inglês / Original',
      sourceName: 'VidSrc 2',
      lang: 'en-us',
      streamUrl: '/api/player/hls/en2/playlist.m3u8',
      streamKind: 'hls',
    },
  ]);

  assert.equal(consolidated.length, 2);
  assert.equal(consolidated[0].label, 'Dublado (PT-BR)');
  assert.equal(consolidated[0].sourceName, undefined);
  assert.equal(consolidated[0].streamKind, 'hls');
  assert.equal(consolidated[0].streamUrl, '/api/player/hls/pt1/playlist.m3u8');
  assert.equal(consolidated[0].backupStreams, undefined);

  assert.equal(consolidated[1].label, 'Inglês / Original');
  assert.equal(consolidated[1].sourceName, undefined);
  assert.deepEqual(consolidated[1].backupStreams, [
    { streamUrl: '/api/player/hls/en2/playlist.m3u8', streamKind: 'hls' },
  ]);
});

test('hasAdOrAntiSandboxTraps and parsePlayerFlixStyleUrl detect traps and parse MyEmbed/PlayerFlix URLs', () => {
  assert.equal(
    hasAdOrAntiSandboxTraps('<script>if(window.frameElement.hasAttribute("sandbox")){location="/asb.html";}</script>'),
    true
  );
  assert.equal(hasAdOrAntiSandboxTraps('<div class="cst-captcha"></div>'), true);
  assert.equal(hasAdOrAntiSandboxTraps('<html><body><video src="x.mp4"></video></body></html>'), false);

  assert.deepEqual(parsePlayerFlixStyleUrl('https://myembed.biz/serie/1418/1/2'), {
    origin: 'https://playerflix.ink',
    mediaType: 'tv',
    id: '1418',
    season: 1,
    episode: 2,
  });
  assert.deepEqual(parsePlayerFlixStyleUrl('https://myembed.biz/filme/693134'), {
    origin: 'https://playerflix.ink',
    mediaType: 'movie',
    id: '693134',
    season: null,
    episode: null,
  });
  assert.equal(parsePlayerFlixStyleUrl('https://vidsrc.buzz/embed/movie/693134'), null);
});

test('extractPlayableStreamsFromBody extracts multi-language JSON sources and extractNestedEmbedUrls supports go()/data-src', () => {
  const multiJson = JSON.stringify({
    poster: 'https://cdn.example.com/poster.jpg',
    sources: [
      { lang: 'pt-br', label: 'Dublado', url: 'https://cdn.example.com/pt/master.m3u8' },
      { lang: 'es', label: 'Español', url: 'https://cdn.example.com/es/master.m3u8' },
      { lang: 'fr', label: 'French', url: 'https://cdn.example.com/fr/video.mp4' },
    ],
  });
  const streams = extractPlayableStreamsFromBody(multiJson, 'https://api.example.com/play');
  assert.equal(streams.length, 3);
  assert.equal(streams[0].detectedLang, 'pt');
  assert.equal(streams[1].detectedLang, 'es');
  assert.equal(streams[2].detectedLang, 'fr');
  assert.equal(streams[2].streamKind, 'video');

  const html = `
    <iframe data-src="https://player1.example.com/e/1"></iframe>
    <button onclick="go('https://vidsrc.buzz/embed/movie/693134')">Play</button>
    <button onclick="go('https://mypopads.com/ad')">Ad</button>
  `;
  assert.deepEqual(extractNestedEmbedUrls(html, 'https://wrapper.example.com/'), [
    'https://player1.example.com/e/1',
    'https://vidsrc.buzz/embed/movie/693134',
  ]);

  assert.equal(hasUrlTemplatePlaceholder('https://embedmaster.link/movie/{id}'), true);
  assert.equal(hasUrlTemplatePlaceholder('https://vaplayer.ru/embed/movie/1147301'), false);

  const extended = consolidateAudioOptionsByLanguage([
    {
      id: 'pt_1',
      label: 'Dublado (PT-BR) · Servidor A',
      languageLabel: 'Dublado (PT-BR)',
      sourceName: 'Servidor A',
      lang: 'pt-br',
      streamUrl: '/api/player/hls/pt/playlist.m3u8',
      streamKind: 'hls',
    },
    {
      id: 'es_1',
      label: 'Espanhol · Servidor B',
      languageLabel: 'Espanhol',
      sourceName: 'Servidor B',
      lang: 'es-es',
      streamUrl: '/api/player/hls/es/playlist.m3u8',
      streamKind: 'hls',
    },
    {
      id: 'fr_1',
      label: 'Francês · Servidor C',
      languageLabel: 'Francês',
      sourceName: 'Servidor C',
      lang: 'fr',
      streamUrl: '/api/player/hls/fr/playlist.m3u8',
      streamKind: 'hls',
    },
  ]);
  assert.deepEqual(
    extended.map((o) => o.label),
    ['Dublado (PT-BR)', 'Espanhol', 'Francês']
  );
  assert.equal(extended.every((o) => o.sourceName === undefined), true);
});

test('parseBuzzQPayload detects play API bases for videm.buzz/videm.cc and vidsrc.buzz', () => {
  const videmHtml = `
    <html>
      <head><base href="/" /></head>
      <body>
        <script>
          var Q = {"t":"tok_abc","ssr":{"servers":[{"ref":"srv1","name":"FastStream","lang":"English"},{"ref":"srv2","name":"Dub","lang":"Portuguese"}]}};
          fetch('api.php?a=play&ref=srv1&t=' + Q.t);
        </script>
      </body>
    </html>
  `;
  const parsedVidem = parseBuzzQPayload(videmHtml, 'https://videm.buzz/embed/tv/1418/1/1');
  assert.ok(parsedVidem);
  assert.equal(parsedVidem.token, 'tok_abc');
  assert.equal(parsedVidem.playApiBases[0], 'https://videm.buzz/api.php');
  assert.equal(parsedVidem.servers.length, 2);
  assert.equal(parsedVidem.servers[1].lang, 'Portuguese');

  const vidsrcHtml = `
    <html>
      <body>
        <script>
          var Q = {"t":"tok_xyz","ssr":{"servers":[{"ref":"srv9","name":"Alpha","lang":null}]}};
          fetch('/pl/api.php?a=play');
        </script>
      </body>
    </html>
  `;
  const parsedVidsrc = parseBuzzQPayload(vidsrcHtml, 'https://vidsrc.buzz/embed/movie/693134');
  assert.ok(parsedVidsrc);
  assert.equal(parsedVidsrc.playApiBases[0], 'https://vidsrc.buzz/pl/api.php');
  assert.equal(parsedVidsrc.servers[0].ref, 'srv9');
});

test('mergeRecommendedCustomSources appends PT-BR + EN sources without duplicates and pauses broken/placeholderless entries', () => {
  const existing = [
    {
      id: 'old_cf_1',
      name: 'WatchaFlix API',
      kind: 'api' as const,
      lang: 'pt' as const,
      movieTemplate: 'https://api.watcha.one/embed/movie/{tmdbId}',
      tvTemplate: 'https://api.watcha.one/embed/tv/{tmdbId}/{season}/{episode}',
      priority: 1,
      active: true,
    },
    {
      id: 'old_embedmaster',
      name: 'EmbedMaster',
      kind: 'embed' as const,
      lang: 'en' as const,
      movieTemplate: 'https://embedmaster.link/movie/{id}',
      tvTemplate: 'https://embedmaster.link/tv/{id}/{season}/{episode}',
      priority: 2,
      active: true,
    },
    {
      id: 'old_fixed_url',
      name: 'Inglês Fixo',
      kind: 'embed' as const,
      lang: 'en' as const,
      movieTemplate: 'https://vaplayer.ru/embed/movie/1147301',
      tvTemplate: '',
      priority: 3,
      active: true,
    },
    {
      id: 'old_2embed',
      name: '2Embed Antigo',
      kind: 'embed' as const,
      lang: 'auto' as const,
      movieTemplate: 'https://www.2embed.cc/embed/{tmdbId}',
      tvTemplate: 'https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}',
      priority: 4,
      active: true,
    },
    {
      id: 'existing_playerflix',
      name: 'PlayerFlix (PT-BR)',
      kind: 'embed' as const,
      lang: 'auto' as const,
      movieTemplate: 'https://playerflix.ink/filme/{tmdbId}',
      tvTemplate: 'https://playerflix.ink/serie/{tmdbId}/{season}/{episode}',
      priority: 5,
      active: false,
    },
  ];

  const res = mergeRecommendedCustomSources(existing);
  assert.equal(res.pausedBrokenCount, 4);
  assert.equal(res.addedCount, RECOMMENDED_CUSTOM_SOURCES.length - 1);

  const byId = new Map(res.sources.map((s) => [s.id, s]));
  assert.equal(byId.get('old_cf_1')?.active, false);
  assert.equal(byId.get('old_embedmaster')?.active, false);
  assert.equal(byId.get('old_fixed_url')?.active, false);
  assert.equal(byId.get('old_2embed')?.active, false);
  assert.equal(byId.get('existing_playerflix')?.active, true);
  assert.equal(res.sources.some((s) => /vidlink\.pro/i.test(s.tvTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /cinejoy\.pk/i.test(s.tvTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /novelascdn\.link/i.test(s.movieTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /fshd\.link/i.test(s.movieTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /playerflix\.ink/i.test(s.tvTemplate) && s.active), true);

  // Re-running is idempotent
  const second = mergeRecommendedCustomSources(res.sources);
  assert.equal(second.addedCount, 0);
  assert.equal(second.pausedBrokenCount, 0);
  assert.equal(second.sources.length, res.sources.length);
});

test('isAllowedSubtitleHost, isAggregatorOrWrapperHtml, and selectBestVidLinkMedia enforce clean playback rules', () => {
  assert.equal(isAllowedSubtitleHost('https://subs5.strem.io/en/sub.srt'), true);
  assert.equal(isAllowedSubtitleHost('https://cacdn.hakunaymatata.com/sub/pt.srt'), true);
  assert.equal(isAllowedSubtitleHost('https://cache.vdrk.site/v3/tv/2692/1/1/Portuguese.vtt'), true);
  assert.equal(isAllowedSubtitleHost('http://cacdn.hakunaymatata.com/sub/pt.srt'), false);
  assert.equal(isAllowedSubtitleHost('https://evil.example.com/sub.srt'), false);

  assert.equal(
    isAggregatorOrWrapperHtml('<html><script src="disable-devtool.js"></script><button onclick="go(\'https://x\')">Go</button></html>'),
    true
  );
  assert.equal(
    isAggregatorOrWrapperHtml('<html><body><h1>Investidor.blog</h1></body></html>'),
    true
  );
  assert.equal(
    isAggregatorOrWrapperHtml('<html><body><video src="https://cdn.example.com/v.mp4"></video></body></html>'),
    false
  );

  // Prefer 720p H.264 over 1080p HEVC for browser compatibility
  const pickedH264 = selectBestVidLinkMedia({
    qualities: {
      '1080': { url: 'https://bcdn.hakunaymatata.com/1080_hevc.mp4', codecName: 'hevc' },
      '720': { url: 'https://bcdn.hakunaymatata.com/720_h264.mp4', codecName: 'h264' },
      '480': { url: 'https://bcdn.hakunaymatata.com/480_hevc.mp4', codecName: 'hevc' },
    },
  });
  assert.deepEqual(pickedH264, {
    url: 'https://bcdn.hakunaymatata.com/720_h264.mp4',
    streamKind: 'video',
    sendUserAgent: false,
  });

  // Fall back to HLS playlist if only HEVC MP4s exist
  const pickedHls = selectBestVidLinkMedia({
    qualities: {
      '720': { url: 'https://bcdn.hakunaymatata.com/720_hevc.mp4', codecName: 'hevc' },
    },
    playlist: 'https://cdn.example.com/master.m3u8',
  });
  assert.deepEqual(pickedHls, {
    url: 'https://cdn.example.com/master.m3u8',
    streamKind: 'hls',
    sendUserAgent: true,
  });

  const mergedSubs = mergeAndDisambiguateSubtitles([
    { id: 'vidlink_eng', lang: 'eng', label: 'Inglês', url: '/sub/1' },
    { id: 'vidlink_pob', lang: 'pob', label: 'Português (BR)', url: '/sub/2' },
    { id: 'opensub_pob_1', lang: 'pob', label: 'Português (BR)', url: '/sub/3' },
    { id: 'opensub_pob_2', lang: 'pob', label: 'Português (BR) #2', url: '/sub/4' },
    { id: 'opensub_eng_1', lang: 'eng', label: 'Inglês', url: '/sub/5' },
  ]);
  assert.deepEqual(
    mergedSubs.map((s) => ({ id: s.id, label: s.label, isDefault: s.isDefault })),
    [
      { id: 'vidlink_pob', label: 'Português (BR)', isDefault: true },
      { id: 'opensub_pob_1', label: 'Português (BR) #2', isDefault: false },
      { id: 'opensub_pob_2', label: 'Português (BR) #3', isDefault: false },
      { id: 'vidlink_eng', label: 'Inglês', isDefault: false },
      { id: 'opensub_eng_1', label: 'Inglês #2', isDefault: false },
    ]
  );
});

test('unpackFirePlayerScript and parseNovelasCdnOrFshdHtml decode FirePlayer HLS and parse episode metadata', () => {
  const packedHtml = `<script>eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c]);return p}('0(1,{"2":"\\/3\\/4\\/5.6"});',7,7,'FirePlayer|abc123|videoUrl|hls|abc123|master|txt'.split('|'),0,{}))</script>`;
  const unpacked = unpackFirePlayerScript(packedHtml, 'https://112234152.xyz/player/index.php?data=abc123');
  assert.equal(unpacked, 'https://112234152.xyz/hls/abc123/master.txt');

  const extracted = extractPlayableStreamsFromBody(
    packedHtml,
    'https://112234152.xyz/player/index.php?data=abc123'
  );
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].streamUrl, 'https://112234152.xyz/hls/abc123/master.txt');
  assert.equal(extracted[0].streamKind, 'hls');

  const tvHtml = `
    <div class="episodeOption " data-contentid="3897">Ep 0</div>
    <div class="episodeOption active" data-contentid="3898">Ep 1</div>
  `;
  assert.deepEqual(parseNovelasCdnOrFshdHtml(tvHtml, 'tv'), {
    contentId: 3898,
    inlineMovieOptions: [],
  });

  const movieHtml = `
    <div data-id="147900" data-lang="1">Dub</div>
    <div data-lang="2" data-id="147897">Leg</div>
    <script>var CONTENT_INFO = '24966';</script>
  `;
  assert.deepEqual(parseNovelasCdnOrFshdHtml(movieHtml, 'movie'), {
    contentId: 24966,
    inlineMovieOptions: [
      { id: 147900, type: 1 },
      { id: 147897, type: 2 },
    ],
  });
});

test('openMediaMatchers accurately matches Archive.org PT-BR/EN episodes and rejects false years/promos', () => {
  assert.equal(
    detectArchiveDocLanguage({
      identifier: 'e.-p.-c-s-01-e-09-terminando-e-quebrando-720p',
      title: 'Eu, A Patroa e as Crianças - Completo',
      language: 'Portuguese',
    }).langCode,
    'pt-br'
  );

  assert.equal(
    scoreArchiveSearchDoc(
      {
        identifier: 'chiquititas-2008',
        title: 'Chiquititas 2008',
      },
      { titles: ['Chiquititas'], releaseYear: '2013', mediaType: 'tv', season: 1 }
    ),
    -1
  );

  assert.equal(
    scoreArchiveSearchDoc(
      {
        identifier: 'PaixaoFlix-Chaves-3a-Temporada',
        title: 'Chaves - 3ª Temporada 1975',
        downloads: 500,
      },
      { titles: ['Chaves', 'El Chavo del Ocho'], releaseYear: '1971', mediaType: 'tv', season: 3 }
    ) > 100,
    true
  );

  // Spaced "S 02 E 01" Season 2 pack must be rejected when searching Season 1
  assert.equal(
    scoreArchiveSearchDoc(
      {
        identifier: 'eu-a-patroa-e-as-criancas-s-02-e-01',
        title: 'Eu, A Patroa E As Crianças S 02 E 01',
      },
      { titles: ['Eu, a Patroa e as Crianças'], releaseYear: '2001', mediaType: 'tv', season: 1 }
    ),
    -1
  );

  const matchedEp = matchArchiveEpisodeFile(
    [
      { name: 'E.P.C S01E01 - Piloto 720p.mp4', source: 'original', format: 'MPEG4', size: 220_000_000 },
      { name: 'E.P.C S01E01 - Piloto 720p.ia.mp4', source: 'derivative', format: 'h.264 IA', size: 110_000_000 },
      { name: 'E.P.C S01E02 - Verdades.mp4', source: 'original', format: 'MPEG4', size: 215_000_000 },
      { name: 'Teaser.mp4', source: 'original', format: 'MPEG4', size: 2_000_000, length: '30' },
    ],
    {
      mediaType: 'tv',
      season: 1,
      episode: 1,
      docTitle: 'Eu, A Patroa e as Crianças - Completo',
      docIdentifier: 'e.-p.-c-s-01-e-09-terminando-e-quebrando-720p',
    }
  );
  assert.equal(matchedEp?.name, 'E.P.C S01E01 - Piloto 720p.mp4');

  const seasonScopedEp = matchArchiveEpisodeFile(
    [
      { name: '01 - O Julgamento do Chaves.mp4', source: 'original', format: 'MPEG4', size: 180_000_000 },
      { name: '02 - Episodio Dois.mp4', source: 'original', format: 'MPEG4', size: 175_000_000 },
    ],
    {
      mediaType: 'tv',
      season: 3,
      episode: 1,
      docTitle: 'Chaves - 3ª Temporada',
      docIdentifier: 'PaixaoFlix-Chaves-3a-Temporada',
    }
  );
  assert.equal(seasonScopedEp?.name, '01 - O Julgamento do Chaves.mp4');
});

test('selectBestDailymotionVideos strips airing dates before episode matching and blocks clips/wrong years', () => {
  assert.equal(
    stripDatesFromEpisodeTitle('Chiquititas - Capítulo 182 (25-03-14)').trim(),
    'Chiquititas - Capítulo 182'
  );
  assert.equal(extractChapterOrEpisodeFromTitle('Chiquititas - Capítulo 182 (25-03-14)', 1), 182);
  assert.equal(extractChapterOrEpisodeFromTitle('Chiquititas Capítulo 9 (25/07/13)', 1), 9);

  const selected = selectBestDailymotionVideos(
    [
      { id: 'x8np884', title: 'Chiquititas 2007 - Capítulo 25', duration: 2262 },
      { id: 'x4tpe0f', title: 'Chiquititas - Capítulo 182 (25-03-14)', duration: 2197 },
      { id: 'x3e9oub', title: '[Chamada] Chiquititas Capítulo 25 | SBT', duration: 57 },
      { id: 'x120ry3', title: 'Chiquititas 2013 - Capitulo 001 - Completo', duration: 2692 },
    ],
    {
      titles: ['Chiquititas'],
      releaseYear: '2013',
      mediaType: 'tv',
      season: 1,
      episode: 1,
    }
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'x120ry3');
  assert.equal(selected[0].langCode, 'pt-br');
});

test('catalogUtils maps cross-media TMDB genres, parses TMDB/IMDb search IDs, and filters decades', () => {
  assert.deepEqual(resolveTmdbGenreForMediaType(28, 'tv'), { genreId: 10759, compatible: true });
  assert.deepEqual(resolveTmdbGenreForMediaType(878, 'tv'), { genreId: 10765, compatible: true });
  assert.deepEqual(resolveTmdbGenreForMediaType(10766, 'movie'), { genreId: undefined, compatible: false });
  assert.deepEqual(resolveTmdbGenreForMediaType(10766, 'tv'), { genreId: 10766, compatible: true });

  const unified = mergeUnifiedTmdbGenres(
    [{ id: 28, name: 'Ação' }, { id: 16, name: 'Animação' }],
    [{ id: 16, name: 'Animação' }, { id: 10766, name: 'Soap' }]
  );
  assert.equal(unified.some((g) => g.id === 10766 && g.name === 'Novelas (Soap)'), true);
  assert.equal(unified.length, 3);

  assert.deepEqual(parseCatalogSearchTarget('tt0903747'), { kind: 'imdb', imdbId: 'tt0903747' });
  assert.deepEqual(parseCatalogSearchTarget('tv/47'), { kind: 'tmdb_typed', mediaType: 'tv', tmdbId: 47 });
  assert.deepEqual(parseCatalogSearchTarget('https://www.themoviedb.org/movie/550-fight-club'), {
    kind: 'tmdb_typed',
    mediaType: 'movie',
    tmdbId: 550,
  });
  assert.deepEqual(parseCatalogSearchTarget('47'), { kind: 'tmdb_numeric', tmdbId: 47, rawQuery: '47' });

  const filtered = filterAndSortMedia(
    [
      {
        id: 1,
        tmdbId: 1,
        mediaType: 'movie',
        title: 'Clássico 1994',
        originalTitle: 'Classic 1994',
        overview: '',
        posterPath: null,
        backdropPath: null,
        releaseDate: '1994-10-14',
        releaseYear: '1994',
        voteAverage: 8.7,
        voteCount: 12000,
        popularity: 50,
        genreIds: [28],
        originalLanguage: 'en',
        source: 'tmdb',
      },
      {
        id: 2,
        tmdbId: 2,
        mediaType: 'tv',
        title: 'A Série Recente',
        originalTitle: 'Recent Series',
        overview: '',
        posterPath: null,
        backdropPath: null,
        releaseDate: '2024-05-01',
        releaseYear: '2024',
        voteAverage: 7.5,
        voteCount: 500,
        popularity: 90,
        genreIds: [10759],
        originalLanguage: 'pt',
        source: 'tmdb',
      },
    ],
    {
      mediaType: 'all',
      genreId: 28,
      yearFrom: 1990,
      yearTo: 1999,
      sortBy: 'votes',
    }
  );
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].tmdbId, 1);
});

test('playerFailover cycles through same-language backups first, then alternate languages, and detects muted autoplay errors', () => {
  const options = [
    {
      id: 'opt_pt',
      label: 'Dublado (PT-BR)',
      languageLabel: 'Dublado (PT-BR)',
      lang: 'pt-br',
      streamUrl: '/api/player/hls/pt1/playlist.m3u8',
      streamKind: 'hls' as const,
      backupStreams: [
        { streamUrl: '/api/player/video/pt2', streamKind: 'video' as const },
      ],
    },
    {
      id: 'opt_en',
      label: 'Inglês / Original',
      languageLabel: 'Inglês / Original',
      lang: 'en-us',
      streamUrl: '/api/player/hls/en1/playlist.m3u8',
      streamKind: 'hls' as const,
      backupStreams: [
        { streamUrl: '/api/player/hls/en2/playlist.m3u8', streamKind: 'hls' as const },
      ],
    },
  ];

  const failedAudioIds = new Set<string>();
  const failedUrls = new Set<string>(['/api/player/hls/pt1/playlist.m3u8']);

  assert.equal(
    hasNextPlayableCandidate({
      activeOptionId: 'opt_pt',
      activeStreamUrl: '/api/player/hls/pt1/playlist.m3u8',
      audioOptions: options,
      failedAudioIds,
      failedStreamUrls: failedUrls,
    }),
    true
  );

  // Step 1: should pick same-language backup first without switching language
  const firstFallback = pickNextPlayableCandidate({
    activeOptionId: 'opt_pt',
    activeStreamUrl: '/api/player/hls/pt1/playlist.m3u8',
    audioOptions: options,
    failedAudioIds,
    failedStreamUrls: failedUrls,
  });
  assert.deepEqual(firstFallback, {
    kind: 'backup',
    targetOptionId: 'opt_pt',
    streamUrl: '/api/player/video/pt2',
    streamKind: 'video',
    languageLabel: 'Dublado (PT-BR)',
    switchedLanguage: false,
  });

  // Step 2: once same-language backup fails too, should switch to alternate language
  failedUrls.add('/api/player/video/pt2');
  const secondFallback = pickNextPlayableCandidate({
    activeOptionId: 'opt_pt',
    activeStreamUrl: '/api/player/video/pt2',
    audioOptions: options,
    failedAudioIds,
    failedStreamUrls: failedUrls,
  });
  assert.deepEqual(secondFallback, {
    kind: 'audio',
    targetOptionId: 'opt_en',
    streamUrl: '/api/player/hls/en1/playlist.m3u8',
    streamKind: 'hls',
    languageLabel: 'Inglês / Original',
    switchedLanguage: true,
  });

  // Step 3: once all options and backups are exhausted, return null
  failedAudioIds.add('opt_pt');
  failedUrls.add('/api/player/hls/en1/playlist.m3u8');
  failedUrls.add('/api/player/hls/en2/playlist.m3u8');
  assert.equal(
    pickNextPlayableCandidate({
      activeOptionId: 'opt_en',
      activeStreamUrl: '/api/player/hls/en2/playlist.m3u8',
      audioOptions: options,
      failedAudioIds,
      failedStreamUrls: failedUrls,
    }),
    null
  );

  // Autoplay policy error detection
  assert.equal(shouldAutoRetryMutedOnPlayError(new DOMException('Not allowed', 'NotAllowedError')), true);
  assert.equal(
    shouldAutoRetryMutedOnPlayError(new Error("play() failed because the user didn't interact with the document first")),
    true
  );
  assert.equal(shouldAutoRetryMutedOnPlayError(new Error('Network aborted')), false);
});

test('parseM3uPlaylistText, multi-language audio/subs, Chiquititas Ep 25 Dailymotion, and Wi-Fi LAN URL rewriting', () => {
  const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-logo="https://img.example.com/1.jpg" group-title="Filmes HD",Duna Parte Dois (2024)
https://cdn.example.com/movies/duna2.m3u8
#EXTINF:-1 group-title="Séries",Chiquititas Cap 25
https://cdn.example.com/tv/chiquititas-25.mp4`;

  const parsedEntries = parseM3uPlaylistText(sampleM3u);
  assert.equal(parsedEntries.length, 2);
  assert.equal(parsedEntries[0].name, 'Duna Parte Dois (2024)');
  assert.equal(parsedEntries[0].streamUrl, 'https://cdn.example.com/movies/duna2.m3u8');
  assert.equal(parsedEntries[0].groupTitle, 'Filmes HD');
  assert.equal(parsedEntries[0].logoUrl, 'https://img.example.com/1.jpg');
  assert.equal(parsedEntries[1].name, 'Chiquititas Cap 25');
  assert.equal(parsedEntries[1].streamUrl, 'https://cdn.example.com/tv/chiquititas-25.mp4');

  // Expanded language metadata & subtitle hosts
  assert.equal(getCustomSourceLangMeta('ru').label, 'Russo');
  assert.equal(getCustomSourceLangMeta('ar').label, 'Árabe');
  assert.equal(getCustomSourceLangMeta('zh').label, 'Chinês');
  assert.equal(getCustomSourceLangMeta('pl').label, 'Polonês');
  assert.equal(isAllowedSubtitleHost('https://rezesubs.com/subs/movie/693134/pt.vtt'), true);
  assert.equal(isAllowedSubtitleHost('https://sub.mysubsplay.com/en.vtt'), true);

  // Merge >12 different subtitle languages without dropping any
  const manySubs = [
    'pob', 'por', 'eng', 'spa', 'fre', 'ger', 'ita', 'jpn',
    'kor', 'rus', 'ara', 'chi', 'dut', 'pol', 'tur', 'hin',
  ].map((lang, i) => ({
    id: `sub_${lang}`,
    lang,
    label: lang.toUpperCase(),
    url: `/api/player/subtitle/${i}.vtt`,
  }));
  const mergedMany = mergeAndDisambiguateSubtitles(manySubs);
  assert.equal(mergedMany.length, 16);
  assert.equal(mergedMany[0].lang, 'pob');

  // Dailymotion PT-BR novela match with Chiquititas 2007 - Capítulo 25
  const ep25Match = selectBestDailymotionVideos(
    [
      { id: 'x8np884', title: 'Chiquititas 2007 - Capítulo 25', duration: 2262, language: 'pt' },
      { id: 'x4tpe0f', title: 'Chiquititas - Capítulo 182 (25-03-14)', duration: 2197, language: 'pt' },
      { id: 'x3e9oub', title: '[Chamada] Chiquititas Capítulo 25 | SBT', duration: 57, language: 'pt' },
    ],
    {
      titles: ['Chiquititas'],
      releaseYear: '2013',
      mediaType: 'tv',
      season: 1,
      episode: 25,
    }
  );
  assert.equal(ep25Match.length, 1);
  assert.equal(ep25Match[0].id, 'x8np884');
  assert.equal(ep25Match[0].langCode, 'pt-br');

  // Wi-Fi LAN casting URL rewrite
  assert.equal(isLocalhostOrigin('http://localhost:3000'), true);
  assert.equal(isLocalhostOrigin('http://127.0.0.1:3000'), true);
  assert.equal(isLocalhostOrigin('http://192.168.1.45:3000'), false);
  assert.equal(
    resolveLanShareUrl('http://localhost:3000/watch/movie/693134?foo=1', 'http://192.168.1.45:3000'),
    'http://192.168.1.45:3000/watch/movie/693134?foo=1'
  );
  assert.equal(
    resolveLanShareUrl('https://megastream.app/watch/movie/693134', 'http://192.168.1.45:3000'),
    'https://megastream.app/watch/movie/693134'
  );
});

test('MKV container detection, ASS/SSA to WebVTT conversion, OpenSubtitles hosts, and multi-candidate VidLink ranking', () => {
  // 1. MKV support across detectStreamKind, resolveSegmentMimeType, detectMediaKindFromBytesOrHeaders, extractPlayableStreamsFromBody & Archive matcher
  assert.equal(detectStreamKind('https://cdn.example.com/movies/film.mkv?token=1'), 'video');
  assert.equal(resolveSegmentMimeType('https://cdn.example.com/movies/film.mkv'), 'video/x-matroska');
  assert.equal(
    detectMediaKindFromBytesOrHeaders({ url: 'https://cdn.example.com/episode01.mkv' }),
    'video'
  );
  const mkvExtracted = extractPlayableStreamsFromBody(
    JSON.stringify({ url: 'https://cdn.example.com/ep01.mkv', lang: 'pt-br' }),
    'https://api.example.com/'
  );
  assert.equal(mkvExtracted.length, 1);
  assert.equal(mkvExtracted[0].streamKind, 'video');
  assert.equal(mkvExtracted[0].detectedLang, 'pt');

  const pickedArchiveMkvOnly = matchArchiveEpisodeFile(
    [{ name: 'Show.S01E03.mkv', size: '350000000', length: '1800' }],
    { mediaType: 'tv', season: 1, episode: 3 }
  );
  assert.equal(pickedArchiveMkvOnly?.name, 'Show.S01E03.mkv');

  // 2. ASS/SSA to WebVTT conversion
  const assSample = `[Script Info]
Title: Test
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.25,0:00:04.50,Default,,0,0,0,,{\\an8}Olá,\\NMundo!`;
  const vttOut = convertSrtToVtt(assSample);
  assert.match(vttOut, /^WEBVTT/);
  assert.match(vttOut, /00:00:01\.250 --> 00:00:04\.500/);
  assert.match(vttOut, /Olá,\nMundo!/);
  assert.equal(vttOut.includes('\\an8'), false);

  // 3. New subtitle host allowlist (dl.opensubtitles.org + qqqcdn.cloud)
  assert.equal(isAllowedSubtitleHost('https://dl.opensubtitles.org/en/download/subencoding-utf8/file/12345.gz'), true);
  assert.equal(isAllowedSubtitleHost('https://qqqcdn.cloud/interm/2d/NjkzMTM0LUVuZ2xpc2g.vtt'), true);
  assert.equal(isAllowedSubtitleHost('http://dl.opensubtitles.org/file/123.gz'), false);

  // 4. VidLink ordered multi-quality/multi-codec candidate list
  const vlList = selectVidLinkCandidates({
    qualities: {
      '1080': { url: 'https://bcdn.hakunaymatata.com/1080_hevc.mp4', codecName: 'hevc' },
      '720': { url: 'https://bcdn.hakunaymatata.com/720_h264.mp4', codecName: 'h264' },
      '480': { url: 'https://bcdn.hakunaymatata.com/480_h264.mp4', codecName: 'h264' },
    },
    playlist: 'https://cdn.example.com/master.m3u8',
  });
  assert.equal(vlList.length, 4);
  assert.equal(vlList[0].url, 'https://bcdn.hakunaymatata.com/720_h264.mp4');
  assert.equal(vlList[1].url, 'https://bcdn.hakunaymatata.com/480_h264.mp4');
  assert.equal(vlList[2].url, 'https://cdn.example.com/master.m3u8');
  assert.equal(vlList[3].url, 'https://bcdn.hakunaymatata.com/1080_hevc.mp4');
});

test('FreeAPI.Pro matchers, {title}/{year} URL templates, and subtitle host allowlist', () => {
  assert.equal(
    hasUrlTemplatePlaceholder('https://freeapi.pro/api/msearch?q={title}&year={year}'),
    true
  );
  assert.equal(
    buildCustomEmbedUrl({
      template: 'https://freeapi.pro/api/msearch?q={title}&y={year}',
      tmdbId: 27205,
      title: 'Inception',
      releaseYear: '2010',
      mediaType: 'movie',
    }),
    'https://freeapi.pro/api/msearch?q=Inception&y=2010'
  );

  assert.equal(
    resolveFreeApiUrl('/api/anime?action=px&p=%2Fp%2Fabc%2Fmaster.m3u8'),
    'https://freeapi.pro/api/anime?action=px&p=%2Fp%2Fabc%2Fmaster.m3u8'
  );
  assert.equal(
    isAllowedSubtitleHost('https://freeapi.pro/api/anime?action=px&p=%2Fp%2Fsub.vtt'),
    true
  );

  const movieMatch = selectBestFreeApiMovieMatch(
    [
      {
        id: 'tt27535062',
        title: 'City of God: The Fight Rages On',
        type: 'TV Series',
        year: 2024,
        rank: 5000,
        watchUrl: 'https://www.123imdb.com/title/tt27535062/',
      },
      {
        id: 'tt0317248',
        title: 'City of God',
        type: 'Movie',
        year: 2002,
        rank: 400,
        watchUrl: 'https://www.123imdb.com/title/tt0317248/',
      },
    ],
    {
      titles: ['Cidade de Deus', 'City of God'],
      releaseYear: '2002',
      mediaType: 'movie',
    }
  );
  assert.equal(movieMatch?.imdbId, 'tt0317248');
  assert.equal(movieMatch?.watchUrl, 'https://www.123imdb.com/title/tt0317248/');

  const animeMatch = selectBestFreeApiAnimeMatch(
    [
      { id: 110277, title: 'Attack on Titan Final Season', romaji: 'Shingeki no Kyojin', format: 'TV', year: 2021, score: 87 },
      { id: 16498, title: 'Attack on Titan', romaji: 'Shingeki no Kyojin', format: 'TV', year: 2013, score: 85 },
    ],
    {
      titles: ['Attack on Titan', 'Shingeki no Kyojin'],
      releaseYear: '2013',
      mediaType: 'tv',
    }
  );
  assert.equal(animeMatch?.id, 16498);
});

test('streamBetterUtils builds canonical/API/451 URLs, parses v1 JSON sources, and extracts StreamFlash MP4', () => {
  assert.equal(isStreamBetterHost('streambetter.xyz'), true);
  assert.equal(isStreamBetterHost('api.streambetter.xyz'), true);
  assert.equal(isStreamBetterHost('notstreambetter.xyz'), false);

  assert.equal(slugifyStreamBetterParam('Rambo TV!'), 'rambo-tv');
  assert.equal(
    buildStreamBetterCanonicalUrl({ mediaType: 'movie', tmdbId: 550 }),
    'https://streambetter.xyz/filme/550'
  );
  assert.equal(
    buildStreamBetterCanonicalUrl({
      mediaType: 'tv',
      tmdbId: 1396,
      seasonNumber: 2,
      episodeNumber: 5,
      useMirrorPrefix: true,
    }),
    'https://streambetter.xyz/s/1396/2/5'
  );

  assert.equal(
    buildStreamBetterV1StreamUrl({
      tmdbId: 1396,
      mediaType: 'tv',
      seasonNumber: 1,
      episodeNumber: 3,
      fonte: 'Rambo TV',
    }),
    'https://streambetter.xyz/api/v1/stream?tmdb_id=1396&type=tv&season=1&episode=3&fonte=rambo-tv'
  );
  assert.equal(
    buildStreamBetterV1StreamUrl({ channel: 'espn-brasil' }),
    'https://streambetter.xyz/api/v1/stream?channel=espn-brasil'
  );

  const candidates = buildStreamBetter451Candidates(
    'https://streambetter.xyz/filme/155',
    ['/filme/155']
  );
  assert.deepEqual(candidates, [
    'https://streambetter.xyz/filme/155/',
    'https://streambetter.xyz/v/155',
    'https://streambetter.xyz/v/155/',
    'https://streambetter.xyz/filme/155',
  ]);

  assert.deepEqual(extractStreamBetterSlugFromUrl('https://streambetter.xyz/canal/globo-sp/'), {
    kind: 'channel',
    slug: 'globo-sp',
  });
  assert.deepEqual(extractStreamBetterSlugFromUrl('https://streambetter.xyz/jogo/flamengo-x-palmeiras'), {
    kind: 'game',
    slug: 'flamengo-x-palmeiras',
  });
  assert.deepEqual(extractStreamBetterSlugFromUrl('https://streambetter.xyz/evento/ufc-320'), {
    kind: 'event',
    slug: 'ufc-320',
  });

  const sfHtml = `
    <video controls><source src="https://cdn.sf.example.com/play.mp4?a=1&amp;b=2" type="video/mp4"></video>
  `;
  assert.equal(
    extractStreamFlashMp4FromHtml(sfHtml),
    'https://cdn.sf.example.com/play.mp4?a=1&b=2'
  );

  const parsedV1 = parseStreamBetterV1Sources({
    sources: [
      {
        kind: 'stream',
        url: '',
        error: 'extraction_failed',
        audio: 'dublado',
      },
      {
        kind: 'hubby',
        url: 'https://bucket.r2.cloudflarestorage.com/movie.mp4?X-Amz-Signature=abc',
        format: 'mp4',
        audio: 'dublado',
        label: 'Dublado HD',
        expires_at: '2026-11-26T12:00:00Z',
        headers: { Referer: 'https://streambetter.xyz/' },
        subtitle_url: 'https://bucket.r2.cloudflarestorage.com/sub.vtt',
        subtitle_lang: 'pt-BR',
        subtitle_label: 'Português (BR)',
        qualities: [{ quality: '1080p', url: 'https://bucket.r2.cloudflarestorage.com/1080.mp4' }],
      },
      {
        kind: 'vidmoly',
        url: 'https://vidmoly.example.com/master.m3u8',
        audio: 'legendado',
        headers: {
          Referer: 'https://vidmoly.to/',
          Origin: 'https://vidmoly.to',
          'User-Agent': 'CustomUA/1.0',
        },
      },
    ],
  });

  assert.equal(parsedV1.length, 2);
  assert.equal(parsedV1[0].format, 'mp4');
  assert.equal(parsedV1[0].langCode, 'pt-br');
  assert.equal(parsedV1[0].requiresProxyHeaders, false);
  assert.equal(parsedV1[0].subtitleUrl, 'https://bucket.r2.cloudflarestorage.com/sub.vtt');
  assert.equal(parsedV1[0].qualities.length, 1);

  assert.equal(parsedV1[1].format, 'hls');
  assert.equal(parsedV1[1].langCode, 'pt-sub');
  assert.equal(parsedV1[1].requiresProxyHeaders, true);
  assert.equal(parsedV1[1].userAgent, 'CustomUA/1.0');

  assert.equal(mapStreamBetterChannelCategory(['Futebol ao Vivo'], 'Esportes'), 'Esportes');
  assert.equal(mapStreamBetterChannelCategory(['Jornalismo'], ''), 'Notícias');
  assert.equal(mapStreamBetterChannelCategory(['Desenhos 24h'], ''), 'Infantil');
  assert.equal(mapStreamBetterChannelCategory(['Variedades'], ''), 'Variedades');

  assert.equal(
    isAllowedSubtitleHost('https://bucket.r2.cloudflarestorage.com/subs/pt.vtt'),
    true
  );
  assert.equal(isAllowedSubtitleHost('https://streambetter.xyz/subs/550/pt.vtt'), true);
});

test('directChannelUtils parses M3U playlists, deduplicates mirrors by quality, maps categories, and blocks adult/geo streams', () => {
  assert.equal(cleanDirectChannelDisplayName('AXN (Brazil) (720p) [Not 24/7]'), 'AXN');
  assert.equal(normalizeChannelMatchKey('AMC Latin America Brazil (1080p)'), 'amc');
  assert.deepEqual(buildChannelMatchKeys('TV Cultura (720p)'), ['tvcultura', 'cultura']);

  assert.equal(mapIptvGroupToChannelCategory('Sports', 'ESPN'), 'Esportes');
  assert.equal(mapIptvGroupToChannelCategory('News', 'CNN Brasil'), 'Notícias');
  assert.equal(mapIptvGroupToChannelCategory('Kids', 'Box Kids TV'), 'Infantil');
  assert.equal(mapIptvGroupToChannelCategory('Movies', 'Adrenalina Pura'), 'Filmes');

  assert.equal(
    isDirectM3uChannelBlocked('Canal Geo [Geo-blocked]', 'General', 'https://cdn.example.com/a.m3u8', false),
    true
  );
  assert.equal(
    isDirectM3uChannelBlocked('Canal Adulto', 'Adulto', 'https://cdn.example.com/x.m3u8', false),
    true
  );
  assert.equal(
    isDirectM3uChannelBlocked('YouTube Live', 'News', 'https://www.youtube.com/watch?v=abc', false),
    true
  );
  assert.equal(
    isDirectM3uChannelBlocked('StreamBetter Wrap', 'News', 'https://streambetter.xyz/canal/cnn', false),
    true
  );
  assert.equal(
    isDirectM3uChannelBlocked('Rei dos Canais Wrap', 'News', 'https://reidoscanais.si/canal/cnn', false),
    true
  );

  const sampleM3u = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-logo="https://img.example.com/axn.png" group-title="Movies",AXN (Brazil) (480p)',
    'http://170.83.16.50/AXN/index.m3u8',
    '#EXTINF:-1 tvg-logo="https://img.example.com/axn.png" group-title="Movies",AXN (Brazil) (1080p)',
    'https://cdn.example.com/axn/master.m3u8',
    '#EXTINF:-1 group-title="Adult",Playboy TV',
    'https://cdn.example.com/adult/index.m3u8',
    '#EXTINF:-1 tvg-logo="https://img.example.com/cultura.png" group-title="Culture",TV Cultura [Geo-blocked]',
    'https://cdn.example.com/cultura/index.m3u8',
    '#EXTINF:-1 tvg-logo="https://img.example.com/news.png" group-title="News",CNN Brasil (720p)',
    'https://cdn.example.com/cnn/index.m3u8',
  ].join('\n');

  const parsed = parseDirectChannelM3u(sampleM3u, false);
  assert.equal(parsed.length, 2);

  const axn = parsed.find((c) => c.matchKey === 'axn');
  assert.ok(axn);
  assert.equal(axn.name, 'AXN');
  assert.equal(axn.category, 'Filmes');
  assert.equal(axn.candidates.length, 2);
  assert.equal(axn.candidates[0].url, 'https://cdn.example.com/axn/master.m3u8');

  const cnn = parsed.find((c) => c.matchKey === 'cnn');
  assert.ok(cnn);
  assert.equal(cnn.category, 'Notícias');
});








