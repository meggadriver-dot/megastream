import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildM3uPlaylistContent,
  buildAndroidIntentUrl,
  buildVlcStreamUrl,
  toAbsoluteStreamUrl,
  sanitizeM3uFileName,
} from './castUtils.ts';
import {
  DEFAULT_PLAYER_CONFIG,
  RECOMMENDED_CUSTOM_SOURCES,
  sanitizeCustomVideoSources,
  buildOrderedSourceCascade,
  consolidateAudioOptionsByLanguage,
  formatSourceLanguageOptionLabel,
  getCustomSourceLangMeta,
  hasUrlTemplatePlaceholder,
  mergeRecommendedCustomSources,
} from './playerUrl.ts';
import {
  buildHlsProxyPlaylist,
  detectMediaKindFromBytesOrHeaders,
  extractNestedEmbedUrls,
  extractPlayableStreamFromBody,
  extractPlayableStreamsFromBody,
  hasAdOrAntiSandboxTraps,
  isCloudflareChallengeHtml,
  parseBuzzQPayload,
  parsePlayerFlixStyleUrl,
} from './subtitleUtils.ts';

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

test('mergeRecommendedCustomSources appends PT-BR + EN sources without duplicates and pauses Cloudflare-blocked or placeholderless entries', () => {
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
      id: 'existing_myembed',
      name: 'MyEmbed / EmbedMovies',
      kind: 'embed' as const,
      lang: 'pt' as const,
      movieTemplate: 'https://myembed.biz/filme/{tmdbId}',
      tvTemplate: 'https://myembed.biz/serie/{tmdbId}/{season}/{episode}',
      priority: 4,
      active: false,
    },
  ];

  const res = mergeRecommendedCustomSources(existing);
  assert.equal(res.pausedBrokenCount, 3);
  assert.equal(res.addedCount, RECOMMENDED_CUSTOM_SOURCES.length - 1);

  const byId = new Map(res.sources.map((s) => [s.id, s]));
  assert.equal(byId.get('old_cf_1')?.active, false);
  assert.equal(byId.get('old_embedmaster')?.active, false);
  assert.equal(byId.get('old_fixed_url')?.active, false);
  assert.equal(byId.get('existing_myembed')?.active, true);
  assert.equal(res.sources.some((s) => /videm\.buzz/i.test(s.movieTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /playerflix\.ink/i.test(s.tvTemplate) && s.active), true);
  assert.equal(res.sources.some((s) => /2embed\.cc/i.test(s.tvTemplate) && s.active), true);

  // Re-running is idempotent
  const second = mergeRecommendedCustomSources(res.sources);
  assert.equal(second.addedCount, 0);
  assert.equal(second.pausedBrokenCount, 0);
  assert.equal(second.sources.length, res.sources.length);
});


