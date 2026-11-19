import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import {
  buildCustomEmbedUrl,
  buildOrderedSourceCascade,
  consolidateAudioOptionsByLanguage,
  DEFAULT_PLAYER_CONFIG,
  formatSourceLanguageOptionLabel,
  getCustomSourceLangMeta,
  hasUrlTemplatePlaceholder,
  sanitizeCustomVideoSources,
} from '../../shared/playerUrl.ts';
import {
  buildHlsProxyPlaylist,
  convertSrtToVtt,
  decodeSubtitleBuffer,
  detectMediaKindFromBytesOrHeaders,
  extractEmbedPlayerHash,
  extractNestedEmbedUrls,
  extractPlayableStreamsFromBody,
  extractPlaylistHosts,
  formatSubtitleLangLabel,
  hasAdOrAntiSandboxTraps,
  isAdOrTrackerHost,
  isAllowedSubtitleHost,
  isCloudflareChallengeHtml,
  isSafePublicHost,
  parseBuzzQPayload,
  parsePlayerFlixStyleUrl,
  resolveSegmentMimeType,
} from '../../shared/subtitleUtils.ts';
import type {
  CustomSourceTestResult,
  CustomVideoSource,
  MediaType,
  PlayerAudioOption,
  PlayerConfig,
  SubtitleTrack,
} from '../../shared/types.ts';
import {
  signSegmentUrl,
  signStreamSessionToken,
  signSubtitleToken,
  verifySegmentUrl,
  verifyStreamSessionToken,
  verifySubtitleToken,
} from '../utils/proxyToken.ts';

const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface HlsProxySession {
  id: string;
  upstreamUrl: string;
  allowedHost: string;
  allowedHosts: Set<string>;
  referer: string;
  origin: string;
  sendReferer: boolean;
  streamKind: 'hls' | 'video';
  userAgent: string;
  createdAt: number;
}

interface SubtitleRegistryEntry {
  id: string;
  url: string;
  lang: string;
  encoding?: string;
  vttCache?: string;
  createdAt: number;
}

interface CachedNativeStreamResult {
  audioOptions: PlayerAudioOption[];
  posterUrl: string | null;
  cloudflareOnly: boolean;
  resolvedSource?: string;
  expiresAt: number;
}

interface ExtractedStreamCandidate {
  streamUrl: string;
  streamKind: 'hls' | 'video' | 'iframe';
  audioLabel: string;
  langCode?: string;
  sourceName?: string;
  languageLabel?: string;
  isCustomSource?: boolean;
  posterUrl: string | null;
  referer: string;
  origin: string;
  sendReferer?: boolean;
  useDirectClientUrl?: boolean;
  sourceKind: 'watchplay' | 'embedplayer' | 'vidsrcbuzz' | 'custom';
}

interface CachedSubtitleListResult {
  subtitles: SubtitleTrack[];
  expiresAt: number;
}

interface PlayerFlixAjaxOption {
  embed?: string;
  lang?: string;
  label?: string;
  id?: string;
}

interface PlayerFlixAjaxResponse {
  status?: boolean;
  data?: {
    bgImage?: string;
    options?: PlayerFlixAjaxOption[];
  };
}

interface OpenSubtitlesEntry {
  id?: string;
  url?: string;
  lang?: string;
  SubEncoding?: string;
  subtitleFileName?: string;
}

class StreamResolverServiceImpl {
  private readonly hlsSessions = new Map<string, HlsProxySession>();
  private readonly subtitleRegistry = new Map<string, SubtitleRegistryEntry>();
  private readonly streamCache = new Map<string, CachedNativeStreamResult>();
  private readonly subtitleCache = new Map<string, CachedSubtitleListResult>();

  clearCache(): void {
    this.streamCache.clear();
  }

  private registerHlsSession(params: {
    upstreamUrl: string;
    referer: string;
    origin: string;
    sendReferer?: boolean;
    streamKind?: 'hls' | 'video';
  }): string {
    const parsed = new URL(params.upstreamUrl);
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !isSafePublicHost(parsed.hostname)
    ) {
      throw new Error('Origem de stream não permitida.');
    }

    const streamKind = params.streamKind === 'video' ? 'video' : 'hls';
    const sendReferer = params.sendReferer !== false;

    const token = signStreamSessionToken({
      u: params.upstreamUrl,
      r: params.referer || undefined,
      o: params.origin || undefined,
      sr: sendReferer,
      k: streamKind,
    });

    if (this.hlsSessions.size > 400) {
      const oldestKey = this.hlsSessions.keys().next().value;
      if (oldestKey) this.hlsSessions.delete(oldestKey);
    }

    const primaryHost = parsed.hostname.toLowerCase();
    this.hlsSessions.set(token, {
      id: token,
      upstreamUrl: params.upstreamUrl,
      allowedHost: primaryHost,
      allowedHosts: new Set([primaryHost]),
      referer: params.referer,
      origin: params.origin,
      sendReferer,
      streamKind,
      userAgent: DESKTOP_CHROME_UA,
      createdAt: Date.now(),
    });
    return token;
  }

  private resolveHlsSession(token: string): HlsProxySession | null {
    const cached = this.hlsSessions.get(token);
    if (cached) return cached;

    const decoded = verifyStreamSessionToken(token);
    if (!decoded) return null;

    let primaryHost = '';
    try {
      const parsed = new URL(decoded.u);
      if (
        (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
        !isSafePublicHost(parsed.hostname)
      ) {
        return null;
      }
      primaryHost = parsed.hostname.toLowerCase();
    } catch {
      return null;
    }

    const session: HlsProxySession = {
      id: token,
      upstreamUrl: decoded.u,
      allowedHost: primaryHost,
      allowedHosts: new Set([primaryHost]),
      referer: decoded.r || '',
      origin: decoded.o || '',
      sendReferer: decoded.sr,
      streamKind: decoded.k === 'video' ? 'video' : 'hls',
      userAgent: DESKTOP_CHROME_UA,
      createdAt: Date.now(),
    };
    if (this.hlsSessions.size > 400) {
      const oldestKey = this.hlsSessions.keys().next().value;
      if (oldestKey) this.hlsSessions.delete(oldestKey);
    }
    this.hlsSessions.set(token, session);
    return session;
  }

  private buildProxyPlaybackUrl(sessionId: string, streamKind: 'hls' | 'video'): string {
    return streamKind === 'video'
      ? `/api/player/video/${sessionId}`
      : `/api/player/hls/${sessionId}/playlist.m3u8`;
  }

  private async readHeadBytes(
    res: globalThis.Response,
    maxBytes = 65_536
  ): Promise<Uint8Array> {
    if (!res.body) return new Uint8Array(0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const remaining = maxBytes - total;
        const slice = value.length > remaining ? value.subarray(0, remaining) : value;
        chunks.push(slice);
        total += slice.length;
        if (total >= maxBytes) break;
      }
    } catch {
      // Ignore partial read failures
    } finally {
      reader.cancel().catch(() => {});
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  private registerSubtitleEntry(entry: {
    url: string;
    lang: string;
    encoding?: string;
  }): string {
    const token = signSubtitleToken({
      u: entry.url,
      l: entry.lang,
      e: entry.encoding,
    });

    if (!this.subtitleRegistry.has(token)) {
      if (this.subtitleRegistry.size > 800) {
        const oldestKey = this.subtitleRegistry.keys().next().value;
        if (oldestKey) this.subtitleRegistry.delete(oldestKey);
      }
      this.subtitleRegistry.set(token, {
        id: token,
        url: entry.url,
        lang: entry.lang,
        encoding: entry.encoding,
        createdAt: Date.now(),
      });
    }
    return token;
  }

  private resolveSubtitleEntry(subId: string): SubtitleRegistryEntry | null {
    const cached = this.subtitleRegistry.get(subId);
    if (cached) return cached;

    const verified = verifySubtitleToken(subId);
    if (!verified) return null;

    const entry: SubtitleRegistryEntry = {
      id: subId,
      url: verified.u,
      lang: verified.l,
      encoding: verified.e,
      createdAt: Date.now(),
    };
    this.subtitleRegistry.set(subId, entry);
    return entry;
  }

  private async probeDirectMediaUrl(params: {
    url: string;
    referer: string;
    origin: string;
    expectedKind: 'hls' | 'video';
    signal?: AbortSignal;
  }): Promise<{
    ok: boolean;
    kind: 'hls' | 'video';
    finalUrl?: string;
    sendReferer: boolean;
    cloudflareBlocked?: boolean;
  }> {
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      return { ok: false, kind: params.expectedKind, sendReferer: true };
    }
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !isSafePublicHost(parsed.hostname) ||
      isAdOrTrackerHost(parsed.hostname)
    ) {
      return { ok: false, kind: params.expectedKind, sendReferer: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    const runAttempt = async (withReferer: boolean) => {
      const headers: Record<string, string> = {
        'User-Agent': DESKTOP_CHROME_UA,
        Range: 'bytes=0-65535',
      };
      if (withReferer && params.referer) {
        headers.Referer = params.referer;
        if (params.origin) headers.Origin = params.origin;
      }
      return fetch(params.url, {
        redirect: 'follow',
        signal: controller.signal,
        headers,
      });
    };

    try {
      let sendReferer = Boolean(params.referer);
      let res = await runAttempt(sendReferer);

      if ((res.status === 401 || res.status === 403) && sendReferer) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        if (isCloudflareChallengeHtml(errSample, res.status)) {
          return {
            ok: false,
            kind: params.expectedKind,
            sendReferer,
            cloudflareBlocked: true,
          };
        }
        sendReferer = false;
        res = await runAttempt(false);
      }

      if (!res.ok && res.status !== 206) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        return {
          ok: false,
          kind: params.expectedKind,
          sendReferer,
          cloudflareBlocked: isCloudflareChallengeHtml(errSample, res.status),
        };
      }

      const finalUrl = res.url || params.url;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const disp = res.headers.get('content-disposition');
      const headBytes = await this.readHeadBytes(res, 65_536);

      if (ct.includes('text/html')) {
        const htmlSample = new TextDecoder('utf-8', { fatal: false }).decode(headBytes);
        if (isCloudflareChallengeHtml(htmlSample, res.status)) {
          return {
            ok: false,
            kind: params.expectedKind,
            finalUrl,
            sendReferer,
            cloudflareBlocked: true,
          };
        }
        if (/^\s*#EXTM3U/i.test(htmlSample)) {
          return { ok: true, kind: 'hls', finalUrl, sendReferer };
        }
        return { ok: false, kind: params.expectedKind, finalUrl, sendReferer };
      }

      const detected = detectMediaKindFromBytesOrHeaders({
        url: finalUrl,
        contentType: ct,
        contentDisposition: disp,
        sniffBytes: headBytes,
      });
      if (detected) {
        return { ok: true, kind: detected, finalUrl, sendReferer };
      }

      if (
        params.expectedKind === 'video' &&
        (!ct || ct.includes('octet-stream')) &&
        headBytes.length > 0
      ) {
        return { ok: true, kind: 'video', finalUrl, sendReferer };
      }

      return { ok: false, kind: params.expectedKind, finalUrl, sendReferer };
    } catch {
      return { ok: false, kind: params.expectedKind, sendReferer: false };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractWatchPlayStream(
    embedUrl: string,
    signal?: AbortSignal
  ): Promise<ExtractedStreamCandidate | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const res = await fetch(embedUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: 'https://playerflix.ink/',
        },
      });
      if (!res.ok) return null;

      const finalUrl = res.url || embedUrl;
      const finalOrigin = new URL(finalUrl).origin;
      const html = await res.text();
      if (isCloudflareChallengeHtml(html, res.status)) return null;

      const urlMatch = html.match(/url\s*:\s*["']([^"']+)["']/);
      let rawStreamUrl = urlMatch?.[1]?.replace(/\\\//g, '/').trim() || '';
      let fallbackPoster: string | null = null;
      let fallbackKind: 'hls' | 'video' | null = null;

      if (!rawStreamUrl || !/^https?:\/\//i.test(rawStreamUrl)) {
        const fallback = extractPlayableStreamsFromBody(html, finalUrl)[0];
        if (!fallback) return null;
        rawStreamUrl = fallback.streamUrl;
        fallbackPoster = fallback.posterUrl;
        fallbackKind = fallback.streamKind;
      }

      const isMp4 =
        fallbackKind === 'video' || /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(rawStreamUrl);
      const probe = await this.probeDirectMediaUrl({
        url: rawStreamUrl,
        referer: finalUrl,
        origin: finalOrigin,
        expectedKind: isMp4 ? 'video' : 'hls',
        signal: controller.signal,
      });
      if (!probe.ok) {
        return null;
      }

      const audioMatch = html.match(/MyPlayerAudio\s*=\s*["']([^"']+)["']/);
      const posterMatch = html.match(/data-poster=["']([^"']+)["']/);

      return {
        streamUrl: probe.finalUrl || rawStreamUrl,
        streamKind: probe.kind,
        audioLabel: audioMatch?.[1]?.trim() || 'Dublado',
        posterUrl: posterMatch?.[1]?.trim() || fallbackPoster,
        referer: probe.sendReferer ? finalUrl : '',
        origin: probe.sendReferer ? finalOrigin : '',
        sendReferer: probe.sendReferer,
        sourceKind: 'watchplay',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractEmbedPlayerStream(
    embedUrl: string,
    langHint?: string,
    signal?: AbortSignal
  ): Promise<ExtractedStreamCandidate | null> {
    const parsed = extractEmbedPlayerHash(embedUrl);
    if (!parsed) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const endpoint = `${parsed.origin}/player/index.php?data=${encodeURIComponent(parsed.hash)}&do=getVideo`;
      const body = `hash=${encodeURIComponent(parsed.hash)}&r=${encodeURIComponent('https://playerflix.ink/')}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Origin: parsed.origin,
          Referer: embedUrl,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) return null;

      const payload = (await res.json()) as {
        hls?: boolean;
        videoImage?: string | null;
        videoSource?: string;
        securedLink?: string;
      };
      const rawUrl = (payload.securedLink || payload.videoSource || '').trim();
      if (!/^https?:\/\//i.test(rawUrl)) return null;

      const isMp4 = /\.mp4(?:$|[?#])/i.test(rawUrl) && payload.hls !== true;
      const probe = await this.probeDirectMediaUrl({
        url: rawUrl,
        referer: `${parsed.origin}/`,
        origin: parsed.origin,
        expectedKind: isMp4 ? 'video' : 'hls',
        signal: controller.signal,
      });
      if (!probe.ok) {
        return null;
      }

      const isPt = (langHint || '').toLowerCase().startsWith('pt');
      return {
        streamUrl: probe.finalUrl || rawUrl,
        streamKind: probe.kind,
        audioLabel: isPt ? 'Dublado' : 'Legendado',
        posterUrl: payload.videoImage || null,
        referer: probe.sendReferer ? `${parsed.origin}/` : '',
        origin: probe.sendReferer ? parsed.origin : '',
        sendReferer: probe.sendReferer,
        sourceKind: 'embedplayer',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async resolveBuzzQServersFromHtml(params: {
    html: string;
    finalPageUrl: string;
    langHint?: string;
    signal: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    const parsedQ = parseBuzzQPayload(params.html, params.finalPageUrl);
    if (!parsedQ) return [];

    const pageOrigin = new URL(params.finalPageUrl).origin;
    const scoreServerLang = (lang?: string | null): number => {
      const l = (lang || '').trim().toLowerCase();
      if (!l) return 2;
      if (/^(?:pt|portugu)/i.test(l)) return 0;
      if (/^(?:en|eng)/i.test(l)) return 0;
      if (/^(?:es|span|espa|fr|french|de|germ|it|ital|ja|jap|ko|kor)/i.test(l)) return 1;
      return 4;
    };
    const servers = [...parsedQ.servers].sort(
      (a, b) => scoreServerLang(a.lang) - scoreServerLang(b.lang)
    );
    const hasPrimaryWesternServer = servers.some((s) =>
      /^(?:pt|portugu|en|eng|es|span|espa)/i.test((s.lang || '').trim())
    );

    const results = await Promise.all(
      servers.slice(0, 6).map(async (srv): Promise<ExtractedStreamCandidate | null> => {
        if (!srv.ref) return null;
        const rawLangClean = (srv.lang || '').trim().toLowerCase();
        if (
          hasPrimaryWesternServer &&
          /^(?:hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi)$/i.test(rawLangClean)
        ) {
          return null;
        }
        try {
          let playJson: { url?: string; type?: string } | null = null;
          for (const baseEndpoint of parsedQ.playApiBases) {
            const apiUrl = `${baseEndpoint}?a=play&ref=${encodeURIComponent(srv.ref)}&t=${encodeURIComponent(parsedQ.token)}`;
            const apiRes = await fetch(apiUrl, {
              signal: params.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Referer: params.finalPageUrl,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json, text/javascript, */*; q=0.01',
              },
            });
            if (!apiRes.ok) continue;
            const json = (await apiRes.json().catch(() => null)) as {
              url?: string;
              type?: string;
            } | null;
            if (json?.url) {
              playJson = json;
              break;
            }
          }
          if (!playJson?.url) return null;

          const resolvedStreamUrl = new URL(playJson.url, params.finalPageUrl).toString();
          const expectedKind: 'hls' | 'video' =
            playJson.type === 'mp4' || playJson.type === 'video' ? 'video' : 'hls';

          const probe = await this.probeDirectMediaUrl({
            url: resolvedStreamUrl,
            referer: `${pageOrigin}/`,
            origin: pageOrigin,
            expectedKind,
            signal: params.signal,
          });
          if (!probe.ok) return null;

          const srvLangRaw = (srv.lang || params.langHint || '').trim().toLowerCase();
          let langCode = 'en-us';
          let languageLabel = 'Inglês / Original';
          if (/^(?:pt|portugu)/i.test(srvLangRaw)) {
            langCode = 'pt-br';
            languageLabel = 'Dublado (PT-BR)';
          } else if (/^(?:es|span|espa)/i.test(srvLangRaw)) {
            langCode = 'es-es';
            languageLabel = 'Espanhol';
          } else if (/^(?:fr|french|fran)/i.test(srvLangRaw)) {
            langCode = 'fr';
            languageLabel = 'Francês';
          } else if (/^(?:de|germ|alem)/i.test(srvLangRaw)) {
            langCode = 'de';
            languageLabel = 'Alemão';
          } else if (/^(?:it|ital)/i.test(srvLangRaw)) {
            langCode = 'it';
            languageLabel = 'Italiano';
          } else if (/^(?:ja|jap)/i.test(srvLangRaw)) {
            langCode = 'ja';
            languageLabel = 'Japonês';
          } else if (/^(?:ko|kor)/i.test(srvLangRaw)) {
            langCode = 'ko';
            languageLabel = 'Coreano';
          } else if (/^(?:hi|hin)/i.test(srvLangRaw)) {
            langCode = 'hi';
            languageLabel = 'Hindi';
          }

          return {
            streamUrl: probe.finalUrl || resolvedStreamUrl,
            streamKind: probe.kind,
            audioLabel: languageLabel,
            languageLabel,
            langCode,
            posterUrl: null,
            referer: probe.sendReferer ? `${pageOrigin}/` : '',
            origin: probe.sendReferer ? pageOrigin : '',
            sendReferer: probe.sendReferer,
            sourceKind: 'vidsrcbuzz',
          };
        } catch {
          return null;
        }
      })
    );

    return results.filter((r): r is ExtractedStreamCandidate => r !== null);
  }

  private async extractVidSrcBuzzFromEmbedUrl(
    embedUrl: string,
    opts: { langHint?: string; signal?: AbortSignal } = {}
  ): Promise<ExtractedStreamCandidate[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const pageRes = await fetch(embedUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: 'https://www.2embed.cc/',
        },
      });
      if (!pageRes.ok) return [];

      const finalPageUrl = pageRes.url || embedUrl;
      const html = await pageRes.text();
      if (isCloudflareChallengeHtml(html, pageRes.status)) return [];

      return await this.resolveBuzzQServersFromHtml({
        html,
        finalPageUrl,
        langHint: opts.langHint,
        signal: controller.signal,
      });
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractVidSrcBuzzStreams(params: {
    tmdbId: number;
    imdbId: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    preferredLang: 'pt' | 'en';
    signal: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    const buildBuzzMirrorUrls = (id: string | number) => {
      const path =
        params.mediaType === 'tv'
          ? `/embed/tv/${id}/${params.season ?? 1}/${params.episode ?? 1}`
          : `/embed/movie/${id}`;
      return [
        `https://vidsrc.buzz${path}`,
        `https://videm.buzz${path}`,
        `https://videm.cc${path}`,
      ];
    };

    const [vidsrcUrl, videmBuzzUrl, videmCcUrl] = buildBuzzMirrorUrls(params.tmdbId);
    const [vidsrcRes, videmRes] = await Promise.all([
      this.extractVidSrcBuzzFromEmbedUrl(vidsrcUrl, {
        langHint: 'en',
        signal: params.signal,
      }),
      this.extractVidSrcBuzzFromEmbedUrl(videmBuzzUrl, {
        langHint: 'en',
        signal: params.signal,
      }),
    ]);

    const combined = [...vidsrcRes, ...videmRes];
    if (combined.length > 0) return combined;

    const ccRes = await this.extractVidSrcBuzzFromEmbedUrl(videmCcUrl, {
      langHint: 'en',
      signal: params.signal,
    });
    if (ccRes.length > 0) return ccRes;

    if (params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId)) {
      const imdbMirrors = buildBuzzMirrorUrls(params.imdbId);
      const imdbResults = await Promise.all(
        imdbMirrors.slice(0, 2).map((u) =>
          this.extractVidSrcBuzzFromEmbedUrl(u, {
            langHint: 'en',
            signal: params.signal,
          })
        )
      );
      return imdbResults.flat();
    }

    return [];
  }

  private async extractFromConfiguredUrl(
    targetUrl: string,
    opts: {
      langHint?: string;
      hasExplicitLang?: boolean;
      sourceName?: string;
      isCustomSource?: boolean;
      allowIframeFallback?: boolean;
      depth?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<{
    candidate: ExtractedStreamCandidate | null;
    extraCandidates?: ExtractedStreamCandidate[];
    cloudflareBlocked: boolean;
    blockedByAds?: boolean;
    directBrowserFallback?: ExtractedStreamCandidate;
    iframeFallback?: ExtractedStreamCandidate;
  }> {
    const depth = opts.depth ?? 0;
    let parsed: URL;
    try {
      parsed = new URL((targetUrl || '').trim());
    } catch {
      return { candidate: null, cloudflareBlocked: false };
    }

    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !isSafePublicHost(parsed.hostname) ||
      isAdOrTrackerHost(parsed.hostname)
    ) {
      return { candidate: null, cloudflareBlocked: false };
    }

    const resolveCustomMeta = (detectedLangCode?: string) => {
      const effectiveLang =
        opts.hasExplicitLang && opts.langHint && opts.langHint !== 'auto'
          ? opts.langHint
          : detectedLangCode || opts.langHint || 'auto';
      return formatSourceLanguageOptionLabel(opts.sourceName, effectiveLang);
    };

    const initialMeta = resolveCustomMeta();
    const defaultLabel = initialMeta.languageLabel;

    // Resolve MyEmbed / PlayerFlix / EmbedMovies URLs directly into clean native HLS/MP4 streams
    const pfParsed = parsePlayerFlixStyleUrl(targetUrl);
    if (pfParsed) {
      const numericTmdb = /^\d+$/.test(pfParsed.id) ? Number(pfParsed.id) : 0;
      const imdbStr = /^tt\d{5,12}$/i.test(pfParsed.id) ? pfParsed.id : null;
      const pfController = new AbortController();
      const pfTimer = setTimeout(() => pfController.abort(), 7000);
      const onParentAbort = () => pfController.abort();
      opts.signal?.addEventListener('abort', onParentAbort, { once: true });

      try {
        const pfRes = await this.resolvePlayerFlixAndWatchPlay({
          tmdbId: numericTmdb,
          imdbId: imdbStr,
          mediaType: pfParsed.mediaType,
          season: pfParsed.season,
          episode: pfParsed.episode,
          signal: pfController.signal,
        });
        if (pfRes.candidates.length > 0) {
          const picked = pfRes.candidates.map((item) => {
            const detLang = item.langCode.startsWith('pt')
              ? 'pt'
              : item.langCode.startsWith('en')
                ? 'sub'
                : 'auto';
            const meta = resolveCustomMeta(detLang);
            return {
              ...item.extracted,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              languageLabel: meta.languageLabel,
              posterUrl: item.extracted.posterUrl || pfRes.bgImage,
              isCustomSource: opts.isCustomSource,
            } satisfies ExtractedStreamCandidate;
          });
          return {
            candidate: picked[0],
            extraCandidates: picked.slice(1),
            cloudflareBlocked: false,
          };
        }
        return {
          candidate: null,
          cloudflareBlocked: pfRes.cloudflareOnly,
        };
      } finally {
        clearTimeout(pfTimer);
        opts.signal?.removeEventListener('abort', onParentAbort);
      }
    }

    if (/(?:vidsrc\.buzz|videm\.buzz|videm\.cc)/i.test(parsed.hostname)) {
      const buzzList = await this.extractVidSrcBuzzFromEmbedUrl(targetUrl, {
        langHint: opts.langHint,
        signal: opts.signal,
      });
      if (buzzList.length > 0) {
        const mapped = buzzList.map((item) => {
          const meta = resolveCustomMeta(item.langCode);
          return {
            ...item,
            audioLabel: meta.languageLabel,
            langCode: meta.langCode,
            languageLabel: meta.languageLabel,
            isCustomSource: opts.isCustomSource,
          };
        });
        return {
          candidate: mapped[0],
          extraCandidates: mapped.slice(1),
          cloudflareBlocked: false,
        };
      }
      return { candidate: null, cloudflareBlocked: false };
    }

    if (extractEmbedPlayerHash(targetUrl)) {
      const candidate = await this.extractEmbedPlayerStream(targetUrl, opts.langHint, opts.signal);
      if (candidate) {
        const meta = resolveCustomMeta(candidate.langCode);
        if (opts.sourceName) {
          candidate.audioLabel = meta.label;
          candidate.sourceName = meta.sourceName;
        }
        candidate.langCode = meta.langCode;
        candidate.languageLabel = meta.languageLabel;
        candidate.isCustomSource = opts.isCustomSource;
      }
      return { candidate, cloudflareBlocked: false };
    }
    if (/watchplay\.shop/i.test(parsed.hostname)) {
      const candidate = await this.extractWatchPlayStream(targetUrl, opts.signal);
      if (candidate) {
        const detectedLang = /leg|en/i.test(candidate.audioLabel) ? 'sub' : 'pt';
        const meta = resolveCustomMeta(candidate.langCode || detectedLang);
        if (opts.sourceName) {
          candidate.audioLabel = meta.label;
          candidate.sourceName = meta.sourceName;
        }
        candidate.langCode = meta.langCode;
        candidate.languageLabel = meta.languageLabel;
        candidate.isCustomSource = opts.isCustomSource;
      }
      return { candidate, cloudflareBlocked: false };
    }

    const cleanPath = parsed.pathname.toLowerCase();
    const looksDirectHls =
      cleanPath.endsWith('.m3u8') || /format=m3u8|type=hls/i.test(parsed.search);
    const looksDirectVideo = /\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath);
    if (looksDirectHls || looksDirectVideo) {
      const probe = await this.probeDirectMediaUrl({
        url: targetUrl,
        referer: `${parsed.origin}/`,
        origin: parsed.origin,
        expectedKind: looksDirectVideo ? 'video' : 'hls',
        signal: opts.signal,
      });
      if (!probe.ok) {
        if (probe.cloudflareBlocked) {
          return { candidate: null, cloudflareBlocked: true };
        }
        return {
          candidate: null,
          cloudflareBlocked: false,
          directBrowserFallback: {
            streamUrl: targetUrl,
            streamKind: looksDirectVideo ? 'video' : 'hls',
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            sourceName: initialMeta.sourceName,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: '',
            origin: '',
            sendReferer: false,
            useDirectClientUrl: true,
            sourceKind: 'custom',
          },
        };
      }
      return {
        cloudflareBlocked: false,
        candidate: {
          streamUrl: probe.finalUrl || targetUrl,
          streamKind: probe.kind,
          audioLabel: defaultLabel,
          langCode: initialMeta.langCode,
          sourceName: initialMeta.sourceName,
          languageLabel: initialMeta.languageLabel,
          isCustomSource: opts.isCustomSource,
          posterUrl: null,
          referer: probe.sendReferer ? `${parsed.origin}/` : '',
          origin: probe.sendReferer ? parsed.origin : '',
          sendReferer: probe.sendReferer,
          sourceKind: 'custom',
        },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onParentAbort, { once: true });

    const fetchPage = async (withReferer: boolean) => {
      const headers: Record<string, string> = {
        'User-Agent': DESKTOP_CHROME_UA,
        Accept: 'application/json, text/html, */*',
        Range: 'bytes=0-131071',
      };
      if (withReferer) {
        headers.Referer = `${parsed.origin}/`;
      }
      return fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers,
      });
    };

    try {
      let sendReferer = true;
      let res = await fetchPage(true);

      const cfHeaderMitigated = (res.headers.get('cf-mitigated') || '').toLowerCase() === 'challenge';

      if (res.status === 401 || res.status === 403) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        if (cfHeaderMitigated || isCloudflareChallengeHtml(errSample, res.status)) {
          return { candidate: null, cloudflareBlocked: true };
        }
        sendReferer = false;
        res = await fetchPage(false);
      }

      const finalUrl = res.url || targetUrl;
      const finalOrigin = new URL(finalUrl).origin;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const disp = res.headers.get('content-disposition');
      const finalCfMitigated = (res.headers.get('cf-mitigated') || '').toLowerCase() === 'challenge';

      if (!res.ok && res.status !== 206) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        return {
          candidate: null,
          cloudflareBlocked: finalCfMitigated || isCloudflareChallengeHtml(errSample, res.status),
        };
      }

      const headBytes = await this.readHeadBytes(res, 131_072);
      const sniffedKind = detectMediaKindFromBytesOrHeaders({
        url: finalUrl,
        contentType: ct,
        contentDisposition: disp,
        sniffBytes: headBytes,
      });

      if (sniffedKind) {
        return {
          cloudflareBlocked: false,
          candidate: {
            streamUrl: finalUrl,
            streamKind: sniffedKind,
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            sourceName: initialMeta.sourceName,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: sendReferer ? `${finalOrigin}/` : '',
            origin: sendReferer ? finalOrigin : '',
            sendReferer,
            sourceKind: 'custom',
          },
        };
      }

      if (ct.includes('octet-stream')) {
        return { candidate: null, cloudflareBlocked: false };
      }

      const body = new TextDecoder('utf-8', { fatal: false }).decode(headBytes);
      if (finalCfMitigated || isCloudflareChallengeHtml(body, res.status)) {
        return { candidate: null, cloudflareBlocked: true };
      }

      const extractedList = extractPlayableStreamsFromBody(body, finalUrl);
      if (extractedList.length > 0) {
        const probedList = await Promise.all(
          extractedList.slice(0, 4).map(async (item) => {
            const meta = resolveCustomMeta(item.detectedLang);
            const probe = await this.probeDirectMediaUrl({
              url: item.streamUrl,
              referer: finalUrl,
              origin: finalOrigin,
              expectedKind: item.streamKind,
              signal: opts.signal,
            });
            return { item, meta, probe };
          })
        );

        const verifiedCandidates: ExtractedStreamCandidate[] = [];
        let firstFallback: ExtractedStreamCandidate | undefined;
        let sawCfInStreams = false;

        for (const { item, meta, probe } of probedList) {
          if (probe.ok) {
            verifiedCandidates.push({
              streamUrl: probe.finalUrl || item.streamUrl,
              streamKind: probe.kind,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              sourceName: meta.sourceName,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource,
              posterUrl: item.posterUrl,
              referer: probe.sendReferer ? finalUrl : '',
              origin: probe.sendReferer ? finalOrigin : '',
              sendReferer: probe.sendReferer,
              sourceKind: 'custom',
            });
          } else if (probe.cloudflareBlocked) {
            sawCfInStreams = true;
          } else if (!firstFallback) {
            firstFallback = {
              streamUrl: item.streamUrl,
              streamKind: item.streamKind,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              sourceName: meta.sourceName,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource,
              posterUrl: item.posterUrl,
              referer: '',
              origin: '',
              sendReferer: false,
              useDirectClientUrl: true,
              sourceKind: 'custom',
            };
          }
        }

        if (verifiedCandidates.length > 0) {
          return {
            cloudflareBlocked: false,
            candidate: verifiedCandidates[0],
            extraCandidates: verifiedCandidates.slice(1),
          };
        }
        if (!sawCfInStreams && firstFallback) {
          return {
            candidate: null,
            cloudflareBlocked: false,
            directBrowserFallback: firstFallback,
          };
        }
      }

      const buzzMirrorList = await this.resolveBuzzQServersFromHtml({
        html: body,
        finalPageUrl: finalUrl,
        langHint: opts.langHint,
        signal: controller.signal,
      });
      if (buzzMirrorList.length > 0) {
        const mapped = buzzMirrorList.map((item) => {
          const meta = resolveCustomMeta(item.langCode);
          return {
            ...item,
            audioLabel: meta.languageLabel,
            langCode: meta.langCode,
            languageLabel: meta.languageLabel,
            isCustomSource: opts.isCustomSource,
          };
        });
        return {
          candidate: mapped[0],
          extraCandidates: mapped.slice(1),
          cloudflareBlocked: false,
        };
      }

      if (depth < 2) {
        const nestedUrls = extractNestedEmbedUrls(body, finalUrl)
          .filter((u) => !/(?:superflixapi|embedplayabyss)/i.test(u))
          .sort((a, b) => {
            const score = (urlItem: string) =>
              /(?:vidsrc\.buzz|videm\.buzz|videm\.cc|watchplay\.shop|embedplayer\d*\.xyz|playerflix\.ink|myembed\.biz)/i.test(
                urlItem
              )
                ? 0
                : 1;
            return score(a) - score(b);
          });
        for (const nestedUrl of nestedUrls.slice(0, 5)) {
          const nested = await this.extractFromConfiguredUrl(nestedUrl, {
            langHint: opts.langHint,
            hasExplicitLang: opts.hasExplicitLang,
            sourceName: opts.sourceName,
            isCustomSource: opts.isCustomSource,
            allowIframeFallback: false,
            depth: depth + 1,
            signal: opts.signal,
          });
          if (nested.candidate || nested.directBrowserFallback) {
            return nested;
          }
        }
      }

      const adBlocked = hasAdOrAntiSandboxTraps(body);
      if (adBlocked) {
        return { candidate: null, cloudflareBlocked: false, blockedByAds: true };
      }

      if (opts.allowIframeFallback && res.ok && ct.includes('text/html')) {
        return {
          candidate: null,
          cloudflareBlocked: false,
          iframeFallback: {
            streamUrl: finalUrl,
            streamKind: 'iframe',
            audioLabel: defaultLabel,
            langCode: initialMeta.langCode,
            languageLabel: initialMeta.languageLabel,
            isCustomSource: opts.isCustomSource,
            posterUrl: null,
            referer: '',
            origin: '',
            sendReferer: false,
            useDirectClientUrl: true,
            sourceKind: 'custom',
          },
        };
      }

      return { candidate: null, cloudflareBlocked: false };
    } catch {
      return { candidate: null, cloudflareBlocked: false };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractCandidateOption(
    opt: PlayerFlixAjaxOption,
    signal?: AbortSignal
  ): Promise<ExtractedStreamCandidate | null> {
    if (!opt.embed) return null;
    if (opt.id === 'embedplayer' || /embedplayer\d*\.xyz/i.test(opt.embed)) {
      return this.extractEmbedPlayerStream(opt.embed, opt.lang, signal);
    }
    return this.extractWatchPlayStream(opt.embed, signal);
  }

  private async fetchAjaxStreamOptions(params: {
    id: string;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal: AbortSignal;
  }): Promise<{
    bgImage: string | null;
    options: PlayerFlixAjaxOption[];
    cloudflareOnly: boolean;
  }> {
    const qs = new URLSearchParams({
      type: params.mediaType,
      id: params.id,
      season: params.season === null ? 'null' : String(params.season),
      episode: params.episode === null ? 'null' : String(params.episode),
    });
    const refererPath =
      params.mediaType === 'tv'
        ? `https://playerflix.ink/serie/${params.id}/${params.season ?? 1}/${params.episode ?? 1}`
        : `https://playerflix.ink/filme/${params.id}`;

    const ajaxRes = await fetch(`https://playerflix.ink/inc/Ajax.php?${qs.toString()}`, {
      signal: params.signal,
      headers: {
        'User-Agent': DESKTOP_CHROME_UA,
        Referer: refererPath,
        Origin: 'https://playerflix.ink',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    });
    if (!ajaxRes.ok) {
      return { bgImage: null, options: [], cloudflareOnly: false };
    }

    const payload = (await ajaxRes.json()) as PlayerFlixAjaxResponse;
    if (!payload?.status || !Array.isArray(payload.data?.options)) {
      return { bgImage: null, options: [], cloudflareOnly: false };
    }

    const bgImage = payload.data?.bgImage || null;
    const rawOptions = payload.data.options;

    const cleanOptions = rawOptions.filter((opt) => {
      if (!opt.embed) return false;
      const isWatchPlay = opt.id === 'watchplay' || /watchplay\.shop/i.test(opt.embed);
      const isEmbedPlayer =
        opt.id === 'embedplayer' || /embedplayer\d*\.xyz/i.test(opt.embed);
      return isWatchPlay || isEmbedPlayer;
    });

    cleanOptions.sort((a, b) => {
      const aRank = a.id === 'watchplay' || /watchplay\.shop/i.test(a.embed || '') ? 0 : 1;
      const bRank = b.id === 'watchplay' || /watchplay\.shop/i.test(b.embed || '') ? 0 : 1;
      return aRank - bRank;
    });

    const cloudflareOnly =
      cleanOptions.length === 0 &&
      rawOptions.length > 0 &&
      rawOptions.every(
        (opt) => opt.id === 'superflixapi' || /superflixapi/i.test(opt.embed || '')
      );

    return { bgImage, options: cleanOptions, cloudflareOnly };
  }

  private async resolvePlayerFlixAndWatchPlay(params: {
    tmdbId: number;
    imdbId: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal: AbortSignal;
  }): Promise<{
    bgImage: string | null;
    candidates: Array<{ langCode: string; extracted: ExtractedStreamCandidate }>;
    cloudflareOnly: boolean;
  }> {
    const primary = await this.fetchAjaxStreamOptions({
      id: String(params.tmdbId),
      mediaType: params.mediaType,
      season: params.season,
      episode: params.episode,
      signal: params.signal,
    }).catch(() => ({
      bgImage: null,
      options: [] as PlayerFlixAjaxOption[],
      cloudflareOnly: false,
    }));

    let bgImage = primary.bgImage;
    let candidateOptions = primary.options;
    let cloudflareOnly = primary.cloudflareOnly;
    const resolvedImdb = params.imdbId;

    if (candidateOptions.length === 0 && resolvedImdb && /^tt\d{5,12}$/i.test(resolvedImdb)) {
      const imdbAjax = await this.fetchAjaxStreamOptions({
        id: resolvedImdb,
        mediaType: params.mediaType,
        season: params.season,
        episode: params.episode,
        signal: params.signal,
      }).catch(() => ({
        bgImage: null,
        options: [] as PlayerFlixAjaxOption[],
        cloudflareOnly: false,
      }));
      if (!bgImage) bgImage = imdbAjax.bgImage;
      if (imdbAjax.options.length > 0) {
        candidateOptions = imdbAjax.options;
        cloudflareOnly = false;
      } else {
        cloudflareOnly = cloudflareOnly || imdbAjax.cloudflareOnly;
      }
    }

    if (candidateOptions.length === 0) {
      const suffix =
        params.mediaType === 'tv'
          ? `/tvshow/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}`
          : `/movie/${params.tmdbId}`;
      candidateOptions = [
        { id: 'watchplay_v1', embed: `https://v1.watchplay.shop${suffix}`, lang: 'pt-br' },
        { id: 'watchplay_v2', embed: `https://v2.watchplay.shop${suffix}`, lang: 'pt-br' },
      ];
      if (resolvedImdb && /^tt\d{5,12}$/i.test(resolvedImdb)) {
        const imdbSuffix =
          params.mediaType === 'tv'
            ? `/tvshow/${resolvedImdb}/${params.season ?? 1}/${params.episode ?? 1}`
            : `/movie/${resolvedImdb}`;
        candidateOptions.push(
          {
            id: 'watchplay_imdb_v1',
            embed: `https://v1.watchplay.shop${imdbSuffix}`,
            lang: 'pt-br',
          },
          {
            id: 'watchplay_imdb_v2',
            embed: `https://v2.watchplay.shop${imdbSuffix}`,
            lang: 'pt-br',
          }
        );
      }
    }

    const extractedResults = await Promise.all(
      candidateOptions.slice(0, 6).map(async (opt) => {
        const extracted = await this.extractCandidateOption(opt, params.signal);
        if (!extracted) return null;
        const langCode = (opt.lang || 'pt-br').toLowerCase();
        return { langCode, extracted };
      })
    );

    return {
      bgImage,
      cloudflareOnly,
      candidates: extractedResults.filter(
        (item): item is { langCode: string; extracted: ExtractedStreamCandidate } => item !== null
      ),
    };
  }

  private async resolveBuiltInWatchaPipeline(params: {
    tmdbId: number;
    imdbId: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    preferredLang: 'pt' | 'en';
    signal: AbortSignal;
  }): Promise<{
    audioOptions: PlayerAudioOption[];
    upstreamById: Map<string, string>;
    posterUrl: string | null;
    cloudflareOnly: boolean;
  }> {
    const [flixRes, buzzList] = await Promise.all([
      this.resolvePlayerFlixAndWatchPlay(params),
      this.extractVidSrcBuzzStreams(params),
    ]);

    const options: PlayerAudioOption[] = [];
    const upstreamById = new Map<string, string>();
    const seenUrls = new Set<string>();
    let posterUrl: string | null = flixRes.bgImage;

    // 1. Add verified PT-BR Dublado / PlayerFlix / WatchPlay options first
    const byLangGroup = new Map<
      string,
      { langCode: string; extracted: ExtractedStreamCandidate }
    >();
    for (const item of flixRes.candidates) {
      const langGroup = item.langCode.startsWith('pt')
        ? 'pt'
        : item.langCode.startsWith('en')
          ? 'en'
          : item.langCode;
      const existing = byLangGroup.get(langGroup);
      if (existing && (existing.extracted.sourceKind === 'watchplay' || item.extracted.sourceKind !== 'watchplay')) {
        continue;
      }
      byLangGroup.set(langGroup, item);
    }

    let idx = 0;
    for (const { langCode, extracted } of byLangGroup.values()) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      if (!posterUrl && extracted.posterUrl) posterUrl = extracted.posterUrl;

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const isPt = extracted.audioLabel === 'Dublado' || langCode.startsWith('pt');
      const isSub = extracted.audioLabel === 'Legendado' || langCode.startsWith('en');
      const languageLabel = isPt
        ? 'Dublado (PT-BR)'
        : isSub
          ? 'Legendado (PT-BR)'
          : extracted.audioLabel;
      const optId = `audio_native_${idx}_${isPt ? 'pt-br' : isSub ? 'pt-sub' : langCode}`;
      const playbackKind = extracted.streamKind === 'video' ? 'video' : 'hls';

      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: isPt ? 'pt-br' : isSub ? 'pt-sub' : langCode,
        streamUrl: this.buildProxyPlaybackUrl(sessionId, playbackKind),
        streamKind: playbackKind,
        isCustomSource: false,
      });
      idx += 1;
    }

    // 2. Add verified VidSrcBuzz servers (work reliably across movies & series like The Big Bang Theory)
    for (const extracted of buzzList) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const langCode = extracted.langCode || 'en-us';
      const languageLabel =
        extracted.languageLabel ||
        (langCode.startsWith('pt')
          ? 'Dublado (PT-BR)'
          : langCode.startsWith('es')
            ? 'Espanhol'
            : 'Inglês / Original');
      const optId = `audio_buzz_${idx}_${langCode}`;
      const playbackKind = extracted.streamKind === 'video' ? 'video' : 'hls';

      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: langCode,
        streamUrl: this.buildProxyPlaybackUrl(sessionId, playbackKind),
        streamKind: playbackKind,
        isCustomSource: false,
      });
      idx += 1;
    }

    if (params.preferredLang === 'en') {
      options.sort((a, b) => (a.lang.startsWith('en') ? 0 : 1) - (b.lang.startsWith('en') ? 0 : 1));
    } else {
      options.sort((a, b) => (a.lang.startsWith('pt') ? 0 : 1) - (b.lang.startsWith('pt') ? 0 : 1));
    }

    return {
      audioOptions: options,
      upstreamById,
      posterUrl,
      cloudflareOnly: options.length === 0 && flixRes.cloudflareOnly,
    };
  }

  private buildCandidateOption(
    id: string,
    c: ExtractedStreamCandidate,
    preferredLang: string
  ): PlayerAudioOption {
    const meta = getCustomSourceLangMeta(c.langCode || preferredLang);
    const lang = c.langCode || meta.langCode;
    const cleanLanguageLabel = c.languageLabel || meta.label;
    const baseOption: Omit<PlayerAudioOption, 'streamUrl'> = {
      id,
      label: cleanLanguageLabel,
      languageLabel: cleanLanguageLabel,
      lang,
      streamKind: c.streamKind,
      isCustomSource: c.isCustomSource,
    };
    if (c.useDirectClientUrl || c.streamKind === 'iframe') {
      return {
        ...baseOption,
        streamUrl: c.streamUrl,
      };
    }
    const proxyKind = c.streamKind === 'video' ? 'video' : 'hls';
    const sessionId = this.registerHlsSession({
      upstreamUrl: c.streamUrl,
      referer: c.referer,
      origin: c.origin,
      sendReferer: c.sendReferer,
      streamKind: proxyKind,
    });
    return {
      ...baseOption,
      streamUrl: this.buildProxyPlaybackUrl(sessionId, proxyKind),
    };
  }

  async resolvePlayableStreams(params: {
    tmdbId: number;
    imdbId?: string | null;
    imdbIdPromise?: Promise<string | null>;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
    preferredLang?: 'pt' | 'en';
    playerConfig?: PlayerConfig;
    customStreamUrl?: string | null;
  }): Promise<{
    audioOptions: PlayerAudioOption[];
    posterUrl: string | null;
    cloudflareOnly: boolean;
    resolvedSource?: string;
  }> {
    const cfg = params.playerConfig ?? DEFAULT_PLAYER_CONFIG;
    const preferredLang = params.preferredLang ?? cfg.watchaflixLang ?? 'pt';
    const season = params.mediaType === 'tv' ? params.seasonNumber ?? 1 : null;
    const episode = params.mediaType === 'tv' ? params.episodeNumber ?? 1 : null;

    const activeCustomSources = sanitizeCustomVideoSources(cfg.customSources).filter((s) => s.active);

    const configFingerprint = crypto
      .createHash('sha1')
      .update(
        JSON.stringify({
          sourceMode: cfg.sourceMode,
          defaultDomain: cfg.defaultDomain,
          fallbackDomain: cfg.fallbackDomain,
          myembedBaseUrl: cfg.myembedBaseUrl,
          watchaflixBaseUrl: cfg.watchaflixBaseUrl,
          customEmbedMovieTemplate: cfg.customEmbedMovieTemplate,
          customEmbedTvTemplate: cfg.customEmbedTvTemplate,
          customSources: activeCustomSources,
          preferImdbForMovies: cfg.preferImdbForMovies,
          customStreamUrl: params.customStreamUrl || '',
          updatedAt: cfg.updatedAt || '',
        })
      )
      .digest('hex')
      .slice(0, 12);

    const cacheKey = `${params.mediaType}:${params.tmdbId}:${season ?? 0}:${episode ?? 0}:${configFingerprint}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.audioOptions.length > 0) {
      return {
        audioOptions: [...cached.audioOptions],
        posterUrl: cached.posterUrl,
        cloudflareOnly: cached.cloudflareOnly,
        resolvedSource: cached.resolvedSource,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14_000);

    try {
      let resolvedImdb = params.imdbId ?? null;
      if (!resolvedImdb && params.imdbIdPromise) {
        resolvedImdb = await params.imdbIdPromise.catch(() => null);
      }

      let sawCloudflare = false;
      let fallbackPoster: string | null = null;
      const upstreamById = new Map<string, string>();
      const collectedOptions: PlayerAudioOption[] = [];
      const resolvedCustomDirectOptions: PlayerAudioOption[] = [];
      const resolvedCustomIframeOptions: PlayerAudioOption[] = [];
      const directFallbacks: Array<{
        option: PlayerAudioOption;
        posterUrl: string | null;
        source: string;
        upstreamUrl: string;
      }> = [];

      // 1. Per-title customStreamUrl from Catalog Override
      if (params.customStreamUrl) {
        const customRes = await this.extractFromConfiguredUrl(params.customStreamUrl, {
          langHint: preferredLang,
          hasExplicitLang: false,
          sourceName: 'Fonte do Catálogo',
          isCustomSource: true,
          allowIframeFallback: true,
          signal: controller.signal,
        });
        if (customRes.cloudflareBlocked) sawCloudflare = true;
        if (customRes.candidate) {
          const opt = this.buildCandidateOption(
            `custom_item_${preferredLang}`,
            customRes.candidate,
            preferredLang
          );
          upstreamById.set(opt.id, customRes.candidate.streamUrl);
          const result = {
            audioOptions: [opt],
            posterUrl: customRes.candidate.posterUrl,
            cloudflareOnly: false,
            resolvedSource: 'custom_catalog_item',
          };
          this.saveCache(cacheKey, result);
          return result;
        }
        const catalogFb = customRes.directBrowserFallback || customRes.iframeFallback;
        if (catalogFb) {
          const opt = this.buildCandidateOption(
            `custom_item_${preferredLang}`,
            catalogFb,
            preferredLang
          );
          upstreamById.set(opt.id, catalogFb.streamUrl);
          directFallbacks.push({
            option: opt,
            posterUrl: catalogFb.posterUrl,
            source: 'custom_catalog_item_direct',
            upstreamUrl: catalogFb.streamUrl,
          });
          if (catalogFb.posterUrl) {
            fallbackPoster = catalogFb.posterUrl;
          }
        }
      }

      // 2. Ordered multi-source cascade across ALL custom APIs/embeds + configured templates + native pipelines
      const cascade = buildOrderedSourceCascade(cfg, {
        tmdbId: params.tmdbId,
        imdbId: resolvedImdb,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber,
      });

      const customSourceStages = cascade.filter((s) => s.sourceId === 'custom_source' && Boolean(s.url));
      const nonCustomStages = cascade.filter((s) => s.sourceId !== 'custom_source');
      const hasNativeStage = nonCustomStages.some((s) => s.sourceId === 'native_watcha');

      // Run all active custom sources AND built-in native extraction in parallel for fast startup
      const [customBatchResults, nativeParallelRes] = await Promise.all([
        customSourceStages.length > 0
          ? Promise.all(
              customSourceStages.slice(0, 20).map(async (stage, idx) => {
                const hasExplicitLang = Boolean(stage.preferredLang && stage.preferredLang !== 'auto');
                const langHint = hasExplicitLang ? stage.preferredLang! : 'auto';
                const extractedRes = await this.extractFromConfiguredUrl(stage.url!, {
                  langHint,
                  hasExplicitLang,
                  sourceName: stage.label,
                  isCustomSource: true,
                  allowIframeFallback: stage.sourceKindHint === 'embed',
                  signal: controller.signal,
                });
                if (extractedRes.cloudflareBlocked) sawCloudflare = true;
                if (extractedRes.candidate) {
                  const allCandidates = [
                    extractedRes.candidate,
                    ...(extractedRes.extraCandidates || []),
                  ];
                  const built = allCandidates.map((cand, subIdx) => {
                    if (!fallbackPoster && cand.posterUrl) {
                      fallbackPoster = cand.posterUrl;
                    }
                    const opt = this.buildCandidateOption(
                      `custom_src_${stage.customSourceId || idx}_${subIdx}_${cand.langCode || langHint}`,
                      cand,
                      langHint
                    );
                    upstreamById.set(opt.id, cand.streamUrl);
                    return opt;
                  });
                  return { kind: 'direct' as const, opts: built };
                }
                if (extractedRes.directBrowserFallback) {
                  const fb = extractedRes.directBrowserFallback;
                  const opt = this.buildCandidateOption(
                    `custom_src_direct_${stage.customSourceId || idx}_${langHint}`,
                    fb,
                    langHint
                  );
                  upstreamById.set(opt.id, fb.streamUrl);
                  return { kind: 'direct' as const, opts: [opt] };
                }
                if (extractedRes.iframeFallback) {
                  const ifb = extractedRes.iframeFallback;
                  const opt = this.buildCandidateOption(
                    `custom_src_embed_${stage.customSourceId || idx}_${langHint}`,
                    ifb,
                    langHint
                  );
                  upstreamById.set(opt.id, ifb.streamUrl);
                  return { kind: 'iframe' as const, opts: [opt] };
                }
                return null;
              })
            )
          : Promise.resolve([]),
        hasNativeStage
          ? this.resolveBuiltInWatchaPipeline({
              tmdbId: params.tmdbId,
              imdbId: resolvedImdb,
              mediaType: params.mediaType,
              season,
              episode,
              preferredLang,
              signal: controller.signal,
            })
          : Promise.resolve(null),
      ]);

      for (const item of customBatchResults) {
        if (!item) continue;
        if (item.kind === 'iframe') {
          resolvedCustomIframeOptions.push(...item.opts);
        } else {
          resolvedCustomDirectOptions.push(...item.opts);
        }
      }

      let resolvedSourceTag: string | undefined;

      // Put admin-added working direct/API custom sources first so admin language & priority order takes effect cleanly
      if (resolvedCustomDirectOptions.length > 0) {
        collectedOptions.push(...resolvedCustomDirectOptions);
        resolvedSourceTag = 'custom_source';
      }

      for (const stage of nonCustomStages) {
        if (controller.signal.aborted) break;

        if (stage.sourceId === 'native_watcha') {
          if (nativeParallelRes) {
            if (nativeParallelRes.posterUrl && !fallbackPoster) {
              fallbackPoster = nativeParallelRes.posterUrl;
            }
            if (nativeParallelRes.cloudflareOnly) sawCloudflare = true;
            for (const [k, v] of nativeParallelRes.upstreamById.entries()) {
              upstreamById.set(k, v);
            }
            if (nativeParallelRes.audioOptions.length > 0) {
              collectedOptions.push(...nativeParallelRes.audioOptions);
              if (!resolvedSourceTag) resolvedSourceTag = stage.sourceId;
              break;
            }
          }
          continue;
        }

        if (!stage.url) continue;

        const isDefaultWrapperOnly =
          !stage.isCustomConfigured &&
          (stage.sourceId === 'myembed' || stage.sourceId === 'watchaflix' || stage.sourceId === 'megaembed');

        if (isDefaultWrapperOnly && stage.sourceId !== cfg.sourceMode) {
          continue;
        }

        const extractedRes = await this.extractFromConfiguredUrl(stage.url, {
          langHint: preferredLang,
          hasExplicitLang: true,
          sourceName: stage.label,
          isCustomSource: stage.isCustomConfigured,
          allowIframeFallback: stage.sourceId === 'custom_template',
          signal: controller.signal,
        });
        if (extractedRes.cloudflareBlocked) sawCloudflare = true;
        if (extractedRes.candidate) {
          const allCandidates = [
            extractedRes.candidate,
            ...(extractedRes.extraCandidates || []),
          ];
          for (let subIdx = 0; subIdx < allCandidates.length; subIdx++) {
            const cand = allCandidates[subIdx];
            const opt = this.buildCandidateOption(
              `${stage.sourceId}_${subIdx}_${cand.langCode || preferredLang}`,
              cand,
              preferredLang
            );
            upstreamById.set(opt.id, cand.streamUrl);
            if (!fallbackPoster && cand.posterUrl) {
              fallbackPoster = cand.posterUrl;
            }
            collectedOptions.push(opt);
          }
          if (!resolvedSourceTag) resolvedSourceTag = stage.sourceId;
          break;
        }
        if (extractedRes.directBrowserFallback) {
          const fb = extractedRes.directBrowserFallback;
          const opt = this.buildCandidateOption(
            `${stage.sourceId}_${preferredLang}`,
            fb,
            preferredLang
          );
          upstreamById.set(opt.id, fb.streamUrl);
          directFallbacks.push({
            option: opt,
            posterUrl: fb.posterUrl,
            source: `${stage.sourceId}_direct`,
            upstreamUrl: fb.streamUrl,
          });
        }
      }

      if (resolvedCustomIframeOptions.length > 0) {
        collectedOptions.push(...resolvedCustomIframeOptions);
        if (!resolvedSourceTag) resolvedSourceTag = 'custom_source';
      }

      for (const fb of directFallbacks) {
        collectedOptions.push(fb.option);
        if (!fallbackPoster && fb.posterUrl) fallbackPoster = fb.posterUrl;
        if (!resolvedSourceTag) resolvedSourceTag = fb.source;
      }

      if (collectedOptions.length > 0) {
        const deduped: PlayerAudioOption[] = [];
        const seenKeys = new Set<string>();
        const seenNativeUpstreams = new Set<string>();
        const customUpstreams = new Set<string>();

        for (const opt of collectedOptions) {
          if (opt.isCustomSource) {
            const up = upstreamById.get(opt.id);
            if (up) customUpstreams.add(up);
          }
        }

        for (const opt of collectedOptions) {
          const upstream = upstreamById.get(opt.id) || opt.streamUrl;
          if (!opt.isCustomSource) {
            if (customUpstreams.has(upstream) || seenNativeUpstreams.has(upstream)) continue;
            seenNativeUpstreams.add(upstream);
          } else {
            const customKey = `${opt.id}:${upstream}`;
            if (seenKeys.has(customKey)) continue;
            seenKeys.add(customKey);
          }
          deduped.push(opt);
        }

        // Consolidate cleanly by available language: hide server names, drop iframe if direct HLS/MP4 exists, keep backupStreams per language
        const consolidated = consolidateAudioOptionsByLanguage(deduped);

        const result = {
          audioOptions: consolidated,
          posterUrl: fallbackPoster,
          cloudflareOnly: false,
          resolvedSource: resolvedSourceTag,
        };
        this.saveCache(cacheKey, result);
        return result;
      }

      return {
        audioOptions: [],
        posterUrl: fallbackPoster,
        cloudflareOnly: sawCloudflare,
      };
    } catch {
      return { audioOptions: [], posterUrl: null, cloudflareOnly: false };
    } finally {
      clearTimeout(timer);
    }
  }

  private saveCache(
    cacheKey: string,
    result: {
      audioOptions: PlayerAudioOption[];
      posterUrl: string | null;
      cloudflareOnly: boolean;
      resolvedSource?: string;
    }
  ): void {
    if (this.streamCache.size > 200) {
      const firstKey = this.streamCache.keys().next().value;
      if (firstKey) this.streamCache.delete(firstKey);
    }
    this.streamCache.set(cacheKey, {
      ...result,
      expiresAt: Date.now() + 5 * 60_000,
    });
  }

  async testCustomSources(sources: CustomVideoSource[]): Promise<CustomSourceTestResult[]> {
    const cleanSources = sanitizeCustomVideoSources(sources);
    if (cleanSources.length === 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11_000);

    try {
      return await Promise.all(
        cleanSources.slice(0, 20).map(async (src): Promise<CustomSourceTestResult> => {
          const started = Date.now();
          const mediaType: MediaType = src.movieTemplate ? 'movie' : 'tv';
          const template = mediaType === 'movie' ? src.movieTemplate : src.tvTemplate;
          const testedUrl =
            buildCustomEmbedUrl({
              template,
              tmdbId: mediaType === 'movie' ? 693134 : 1396,
              imdbId: mediaType === 'movie' ? 'tt15239678' : 'tt0903747',
              mediaType,
              seasonNumber: 1,
              episodeNumber: 1,
            }) || template;

          if (src.kind !== 'direct' && !hasUrlTemplatePlaceholder(template)) {
            return {
              id: src.id,
              name: src.name,
              status: 'missing_placeholders',
              detectedLanguages: [],
              testedUrl,
              message:
                'Template sem variável ({tmdbId}, {id} ou {imdbId}). Esta fonte sempre carregará o mesmo título fixo.',
              latencyMs: Date.now() - started,
            };
          }

          const hasExplicitLang = Boolean(src.lang && src.lang !== 'auto');
          const langHint = hasExplicitLang ? src.lang : 'auto';
          const res = await this.extractFromConfiguredUrl(testedUrl, {
            langHint,
            hasExplicitLang,
            sourceName: src.name,
            isCustomSource: true,
            allowIframeFallback: src.kind === 'embed',
            signal: controller.signal,
          });

          const latencyMs = Date.now() - started;

          if (res.candidate) {
            const allCands = [res.candidate, ...(res.extraCandidates || [])];
            const langs = Array.from(
              new Set(
                allCands
                  .map((c) => getCustomSourceLangMeta(c.langCode).label)
                  .filter((l) => l && l !== 'Automático')
              )
            );
            return {
              id: src.id,
              name: src.name,
              status: 'ok_direct',
              detectedLanguages:
                langs.length > 0 ? langs : [getCustomSourceLangMeta(src.lang).label],
              streamKind: res.candidate.streamKind,
              testedUrl,
              message: `Reprodução direta pronta no player nativo (${res.candidate.streamKind.toUpperCase()}) · Idiomas: ${langs.join(', ') || getCustomSourceLangMeta(src.lang).label}`,
              latencyMs,
            };
          }

          if (res.cloudflareBlocked) {
            return {
              id: src.id,
              name: src.name,
              status: 'blocked_cloudflare',
              detectedLanguages: [],
              testedUrl,
              message:
                'Bloqueada pelo Cloudflare (HTTP 403 / Verificação humana). Provedores com desafio Cloudflare ou X-Frame-Options bloqueiam a extração direta para o player sem anúncios.',
              latencyMs,
            };
          }

          if (res.blockedByAds) {
            return {
              id: src.id,
              name: src.name,
              status: 'blocked_ads',
              detectedLanguages: [],
              testedUrl,
              message:
                'Bloqueada automaticamente: esta fonte injeta popups, captchas ou scripts anti-sandbox.',
              latencyMs,
            };
          }

          if (res.directBrowserFallback) {
            const label = getCustomSourceLangMeta(res.directBrowserFallback.langCode).label;
            return {
              id: src.id,
              name: src.name,
              status: 'ok_direct',
              detectedLanguages: [label],
              streamKind: res.directBrowserFallback.streamKind,
              testedUrl,
              message: `Fluxo direto detectado (${res.directBrowserFallback.streamKind.toUpperCase()}) · Idioma: ${label}`,
              latencyMs,
            };
          }

          return {
            id: src.id,
            name: src.name,
            status: 'unavailable',
            detectedLanguages: [],
            testedUrl,
            message:
              'Nenhum stream direto (.m3u8/.mp4) encontrado para o título de teste (HTTP 404, timeout ou página protegida).',
            latencyMs,
          };
        })
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async resolveNativeStreams(params: {
    tmdbId: number;
    imdbId?: string | null;
    imdbIdPromise?: Promise<string | null>;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
    preferredLang?: 'pt' | 'en';
  }): Promise<{ audioOptions: PlayerAudioOption[]; posterUrl: string | null; cloudflareOnly?: boolean }> {
    const res = await this.resolvePlayableStreams(params);
    return {
      audioOptions: res.audioOptions,
      posterUrl: res.posterUrl,
      cloudflareOnly: res.cloudflareOnly,
    };
  }

  async resolveSubtitles(params: {
    imdbId?: string | null;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
  }): Promise<SubtitleTrack[]> {
    const cleanImdb = (params.imdbId || '').trim().toLowerCase();
    if (!/^tt\d{5,12}$/.test(cleanImdb)) {
      return [];
    }

    const season = params.mediaType === 'tv' ? params.seasonNumber ?? 1 : 0;
    const episode = params.mediaType === 'tv' ? params.episodeNumber ?? 1 : 0;
    const cacheKey = `${cleanImdb}:${params.mediaType}:${season}:${episode}`;

    const cached = this.subtitleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.subtitles;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const endpoint =
        params.mediaType === 'tv'
          ? `https://opensubtitles-v3.strem.io/subtitles/series/${cleanImdb}:${season}:${episode}.json`
          : `https://opensubtitles-v3.strem.io/subtitles/movie/${cleanImdb}.json`;

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': DESKTOP_CHROME_UA },
      });
      if (!res.ok) return [];

      const json = (await res.json()) as { subtitles?: OpenSubtitlesEntry[] };
      const rawSubs = Array.isArray(json.subtitles) ? json.subtitles : [];

      const priorityLangs = ['pob', 'por', 'eng', 'spa', 'fre', 'ita', 'ger', 'jpn'];
      const perLangCount = new Map<string, number>();
      const selected: SubtitleTrack[] = [];

      const ordered = [...rawSubs].sort((a, b) => {
        const ai = priorityLangs.indexOf((a.lang || '').toLowerCase());
        const bi = priorityLangs.indexOf((b.lang || '').toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      for (const item of ordered) {
        if (!item.url || !isAllowedSubtitleHost(item.url)) continue;
        const lang = (item.lang || 'und').toLowerCase();
        if (!priorityLangs.includes(lang)) continue;
        const count = perLangCount.get(lang) ?? 0;
        if (count >= 2) continue;
        perLangCount.set(lang, count + 1);

        const subId = this.registerSubtitleEntry({
          url: item.url,
          lang,
          encoding: item.SubEncoding,
        });
        const baseLabel = formatSubtitleLangLabel(lang);
        const suffix = count > 0 ? ` #${count + 1}` : '';

        selected.push({
          id: subId,
          lang,
          label: `${baseLabel}${suffix}`,
          url: `/api/player/subtitle/${subId}.vtt`,
          isDefault: lang === 'pob' && count === 0,
        });

        if (selected.length >= 10) break;
      }

      if (this.subtitleCache.size > 300) {
        const firstKey = this.subtitleCache.keys().next().value;
        if (firstKey) this.subtitleCache.delete(firstKey);
      }
      this.subtitleCache.set(cacheKey, {
        subtitles: selected,
        expiresAt: Date.now() + 30 * 60_000,
      });

      return selected;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async handleHlsManifestRequest(
    token: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const session = this.resolveHlsSession(token);
    if (!session) {
      res.status(404).json({ error: 'Sessão de stream expirada. Recarregue o player.' });
      return;
    }
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    await this.proxyHlsResource(session, session.upstreamUrl, range, res);
  }

  async handleHlsSegmentRequest(
    token: string,
    targetUrl: string,
    sig: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const session = this.resolveHlsSession(token);
    if (!session) {
      res.status(404).json({ error: 'Sessão de stream expirada. Recarregue o player.' });
      return;
    }

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: 'URL de segmento inválida.' });
      return;
    }

    const targetHost = parsedTarget.hostname.toLowerCase();
    const sessionRoot = session.allowedHost.split('.').slice(-2).join('.');
    const hasValidSig = Boolean(sig && verifySegmentUrl(token, parsedTarget.toString(), sig));
    const isAllowed =
      (parsedTarget.protocol === 'https:' || parsedTarget.protocol === 'http:') &&
      isSafePublicHost(targetHost) &&
      (hasValidSig ||
        session.allowedHosts.has(targetHost) ||
        targetHost === session.allowedHost ||
        targetHost.endsWith(`.${sessionRoot}`));
    if (!isAllowed) {
      res.status(403).json({ error: 'Origem de segmento não autorizada.' });
      return;
    }

    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    await this.proxyHlsResource(session, parsedTarget.toString(), range, res);
  }

  private async proxyHlsResource(
    session: HlsProxySession,
    targetUrl: string,
    rangeHeader: string | undefined,
    res: Response
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    let activeStream: Readable | null = null;
    const onClientClose = () => {
      controller.abort();
      activeStream?.destroy();
    };
    res.on('close', onClientClose);

    const runFetch = async (withReferer: boolean) => {
      const headers: Record<string, string> = {
        'User-Agent': session.userAgent,
      };
      if (withReferer && session.referer) {
        headers.Referer = session.referer;
        if (session.origin) headers.Origin = session.origin;
      }
      if (rangeHeader) {
        headers.Range = rangeHeader;
      }
      return fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers,
      });
    };

    try {
      let upstreamRes = await runFetch(session.sendReferer);

      if ((upstreamRes.status === 401 || upstreamRes.status === 403) && session.sendReferer) {
        const retryRes = await runFetch(false);
        if (retryRes.ok || retryRes.status === 206) {
          await upstreamRes.body?.cancel().catch(() => {});
          session.sendReferer = false;
          upstreamRes = retryRes;
        } else {
          await retryRes.body?.cancel().catch(() => {});
        }
      }

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        await upstreamRes.body?.cancel().catch(() => {});
        res.status(upstreamRes.status).end();
        return;
      }

      const effectiveUrl = upstreamRes.url || targetUrl;
      try {
        const effectiveHost = new URL(effectiveUrl).hostname.toLowerCase();
        if (isSafePublicHost(effectiveHost)) {
          session.allowedHosts.add(effectiveHost);
        }
      } catch {
        // Ignore malformed redirect URL
      }

      const upstreamContentType = (
        upstreamRes.headers.get('content-type') || ''
      ).toLowerCase();
      const isPlaylist =
        upstreamContentType.includes('mpegurl') ||
        /\.m3u8(?:$|\?)/i.test(effectiveUrl);

      if (isPlaylist) {
        const rawManifest = await upstreamRes.text();
        for (const host of extractPlaylistHosts(rawManifest, effectiveUrl)) {
          if (isSafePublicHost(host)) {
            session.allowedHosts.add(host);
          }
        }
        const rewritten = buildHlsProxyPlaylist(
          rawManifest,
          effectiveUrl,
          `/api/player/hls/${session.id}/seg`,
          (resolvedUrl) => signSegmentUrl(session.id, resolvedUrl)
        );
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(rewritten);
        return;
      }

      let resolvedMime = resolveSegmentMimeType(effectiveUrl, upstreamContentType);
      if (session.streamKind === 'video' && resolvedMime === 'application/octet-stream') {
        resolvedMime = 'video/mp4';
      }

      res.setHeader('Content-Type', resolvedMime);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const acceptRanges = upstreamRes.headers.get('accept-ranges');
      const contentRange = upstreamRes.headers.get('content-range');
      const contentLength = upstreamRes.headers.get('content-length');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (contentLength) res.setHeader('Content-Length', contentLength);

      res.status(upstreamRes.status);
      if (upstreamRes.body) {
        const nodeStream = Readable.fromWeb(
          upstreamRes.body as unknown as import('node:stream/web').ReadableStream
        );
        activeStream = nodeStream;
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Falha ao transmitir segmento de vídeo.' });
      }
    } finally {
      clearTimeout(timer);
      res.off('close', onClientClose);
    }
  }

  async handleSubtitleVttRequest(subId: string, res: Response): Promise<void> {
    const entry = this.resolveSubtitleEntry(subId);
    if (!entry || !isAllowedSubtitleHost(entry.url)) {
      res.status(404).send('WEBVTT\n\n');
      return;
    }

    if (entry.vttCache) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(entry.vttCache);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const upstream = await fetch(entry.url, {
        signal: controller.signal,
        headers: { 'User-Agent': DESKTOP_CHROME_UA },
      });
      if (!upstream.ok) {
        res.status(404).send('WEBVTT\n\n');
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const rawText = decodeSubtitleBuffer(buf);
      const vtt = convertSrtToVtt(rawText);
      entry.vttCache = vtt;
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(vtt);
    } catch {
      res.status(502).send('WEBVTT\n\n');
    } finally {
      clearTimeout(timer);
    }
  }
}

export const StreamResolverService = new StreamResolverServiceImpl();
