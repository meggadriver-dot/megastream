import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
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
  KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE,
  mergeRecommendedCustomSources,
  parseM3uPlaylistText,
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
  isAggregatorOrWrapperHtml,
  isAllowedSubtitleHost,
  isCloudflareChallengeHtml,
  isSafePublicHost,
  parseBuzzQPayload,
  parseNovelasCdnOrFshdHtml,
  parsePlayerFlixStyleUrl,
  resolveSegmentMimeType,
  selectBestVidLinkMedia,
  selectVidLinkCandidates,
  unpackFirePlayerScript,
} from '../../shared/subtitleUtils.ts';
import {
  type ArchiveFileInput,
  type ArchiveSearchDocInput,
  type DailymotionVideoInput,
  detectArchiveDocLanguage,
  matchArchiveEpisodeFile,
  normalizeMediaSearchText,
  scoreArchiveSearchDoc,
  selectBestDailymotionVideos,
  selectBestFreeApiMovieMatch,
} from '../../shared/openMediaMatchers.ts';
import {
  buildStreamBetterCanonicalUrl,
  extractStreamBetterSlugFromUrl,
  isStreamBetterHost,
  type ParsedStreamBetterSource,
} from '../../shared/streamBetterUtils.ts';
import type {
  CustomSourceTestResult,
  CustomVideoSource,
  DiscoveredM3uEntry,
  LivePlayResolution,
  MediaType,
  PlayerAudioOption,
  PlayerConfig,
  SourceDiscoveryResponse,
  StreamKind,
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
import { DirectChannelsService } from './DirectChannelsService.ts';
import { FreeApiProService } from './FreeApiProService.ts';
import { StreamBetterService } from './StreamBetterService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';

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
  sendUserAgent: boolean;
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

interface ExtraCaptionCandidate {
  url: string;
  lang: string;
}

interface CachedNativeStreamResult {
  audioOptions: PlayerAudioOption[];
  extraSubtitles?: SubtitleTrack[];
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
  userAgent?: string;
  sendReferer?: boolean;
  sendUserAgent?: boolean;
  useDirectClientUrl?: boolean;
  sourceKind:
    | 'watchplay'
    | 'embedplayer'
    | 'vidsrcbuzz'
    | 'vidlink'
    | 'vidup'
    | 'cinejoy'
    | 'novelascdn'
    | 'abyss'
    | 'byse'
    | 'hexa'
    | 'meowtv'
    | 'megaplay'
    | 'freeapi'
    | 'archive'
    | 'dailymotion'
    | 'streambetter'
    | 'custom';
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
  private hexaCapCache: { token: string; usesLeft: number; expiresAt: number } | null = null;

  clearCache(): void {
    this.streamCache.clear();
  }

  private registerHlsSession(params: {
    upstreamUrl: string;
    referer: string;
    origin: string;
    userAgent?: string;
    sendReferer?: boolean;
    sendUserAgent?: boolean;
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
    const sendUserAgent = params.sendUserAgent !== false;
    const effectiveUa = params.userAgent?.trim() || DESKTOP_CHROME_UA;

    const token = signStreamSessionToken({
      u: params.upstreamUrl,
      r: params.referer || undefined,
      o: params.origin || undefined,
      ua: effectiveUa !== DESKTOP_CHROME_UA ? effectiveUa : undefined,
      sr: sendReferer,
      sua: sendUserAgent,
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
      sendUserAgent,
      streamKind,
      userAgent: effectiveUa,
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
      sendUserAgent: decoded.sua !== false,
      streamKind: decoded.k === 'video' ? 'video' : 'hls',
      userAgent: decoded.ua || DESKTOP_CHROME_UA,
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
    userAgent?: string;
    expectedKind: 'hls' | 'video';
    sendUserAgent?: boolean;
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

    const useUa = params.sendUserAgent !== false;
    const uaValue = params.userAgent?.trim() || DESKTOP_CHROME_UA;

    const runAttempt = async (withReferer: boolean) => {
      const headers: Record<string, string> = {
        Range: 'bytes=0-65535',
      };
      if (useUa) {
        headers['User-Agent'] = uaValue;
      }
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
      if (detected === 'hls') {
        const manifestText = new TextDecoder('utf-8', { fatal: false }).decode(headBytes);
        const healthy = await this.verifyHlsFirstSegmentHealth({
          manifestText,
          baseUrl: finalUrl,
          referer: params.referer,
          origin: params.origin,
          userAgent: uaValue,
          sendReferer,
          useUa,
          signal: controller.signal,
        });
        if (!healthy.ok) {
          return {
            ok: false,
            kind: 'hls',
            finalUrl,
            sendReferer: healthy.sendReferer,
          };
        }
        return { ok: true, kind: 'hls', finalUrl, sendReferer: healthy.sendReferer };
      }
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

  private extractFirstPlaylistUri(manifestText: string, baseUrl: string): string | null {
    const lines = (manifestText || '').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      try {
        const resolved = new URL(line, baseUrl);
        if (
          (resolved.protocol === 'https:' || resolved.protocol === 'http:') &&
          isSafePublicHost(resolved.hostname)
        ) {
          return resolved.toString();
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private async verifyHlsFirstSegmentHealth(params: {
    manifestText: string;
    baseUrl: string;
    referer: string;
    origin: string;
    userAgent?: string;
    sendReferer: boolean;
    useUa: boolean;
    signal: AbortSignal;
  }): Promise<{ ok: boolean; sendReferer: boolean }> {
    let currentManifest = params.manifestText;
    let currentBase = params.baseUrl;
    let sendReferer = params.sendReferer;

    for (let hop = 0; hop < 2; hop++) {
      const nextUrl = this.extractFirstPlaylistUri(currentManifest, currentBase);
      if (!nextUrl) {
        return { ok: true, sendReferer };
      }

      const fetchChild = async (withRef: boolean) => {
        const headers: Record<string, string> = {
          Range: 'bytes=0-65535',
        };
        if (params.useUa) headers['User-Agent'] = params.userAgent || DESKTOP_CHROME_UA;
        if (withRef && params.referer) {
          headers.Referer = params.referer;
          if (params.origin) headers.Origin = params.origin;
        }
        return fetch(nextUrl, {
          redirect: 'follow',
          signal: params.signal,
          headers,
        });
      };

      try {
        let childRes = await fetchChild(sendReferer);
        if ((childRes.status === 401 || childRes.status === 403) && sendReferer) {
          await childRes.body?.cancel().catch(() => {});
          const retryRes = await fetchChild(false);
          if (retryRes.ok || retryRes.status === 206) {
            sendReferer = false;
            childRes = retryRes;
          } else {
            await retryRes.body?.cancel().catch(() => {});
            return { ok: false, sendReferer };
          }
        }

        if (!childRes.ok && childRes.status !== 206) {
          await childRes.body?.cancel().catch(() => {});
          return { ok: false, sendReferer };
        }

        const childBytes = await this.readHeadBytes(childRes, 65_536);
        const childSample = new TextDecoder('utf-8', { fatal: false }).decode(childBytes);
        if (isCloudflareChallengeHtml(childSample, childRes.status)) {
          return { ok: false, sendReferer };
        }

        if (/^\s*\uFEFF?#EXTM3U/i.test(childSample)) {
          currentManifest = childSample;
          currentBase = childRes.url || nextUrl;
          continue;
        }

        return { ok: childBytes.length > 0, sendReferer };
      } catch {
        return { ok: false, sendReferer };
      }
    }

    return { ok: true, sendReferer };
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4800);
    const onParentAbort = () => controller.abort();
    params.signal.addEventListener('abort', onParentAbort, { once: true });

    try {
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
          signal: controller.signal,
        }),
        this.extractVidSrcBuzzFromEmbedUrl(videmBuzzUrl, {
          langHint: 'en',
          signal: controller.signal,
        }),
      ]);

      const combined = [...vidsrcRes, ...videmRes];
      if (combined.length > 0 || controller.signal.aborted) return combined;

      const ccRes = await this.extractVidSrcBuzzFromEmbedUrl(videmCcUrl, {
        langHint: 'en',
        signal: controller.signal,
      });
      if (ccRes.length > 0 || controller.signal.aborted) return ccRes;

      if (params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId)) {
        const imdbMirrors = buildBuzzMirrorUrls(params.imdbId);
        const imdbResults = await Promise.all(
          imdbMirrors.slice(0, 2).map((u) =>
            this.extractVidSrcBuzzFromEmbedUrl(u, {
              langHint: 'en',
              signal: controller.signal,
            })
          )
        );
        return imdbResults.flat();
      }

      return [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal.removeEventListener('abort', onParentAbort);
    }
  }

  private mapCaptionLanguageCode(rawLang?: string | null): string {
    const s = (rawLang || '').trim().toLowerCase();
    if (!s) return 'und';
    if (/(?:pt-br|\bpob\b|\bpb\b|brazilian|portugu[eê]s\s*\(?br|brasil)/i.test(s)) return 'pob';
    if (/(?:portugu|\bpt\b|\bpor\b|pt-pt)/i.test(s)) return 'por';
    if (/(?:english|\beng\b|\ben\b)/i.test(s)) return 'eng';
    if (/(?:span|espa|\bspa\b|\bes\b|latino)/i.test(s)) return 'spa';
    if (/(?:fren|fran|\bfre\b|\bfra\b|\bfr\b)/i.test(s)) return 'fre';
    if (/(?:germ|alem|deutsch|\bger\b|\bdeu\b|\bde\b)/i.test(s)) return 'ger';
    if (/(?:ital|\bita\b|\bit\b)/i.test(s)) return 'ita';
    if (/(?:japan|japon|\bjpn\b|\bja\b)/i.test(s)) return 'jpn';
    if (/(?:korean|corean|\bkor\b|\bko\b)/i.test(s)) return 'kor';
    if (/(?:russ|\brus\b|\bru\b|pус)/i.test(s)) return 'rus';
    if (/(?:arab|árabe|\bara\b|\bar\b)/i.test(s)) return 'ara';
    if (/(?:chin|mandarin|canton|\bchi\b|\bzho\b|\bzh\b)/i.test(s)) return 'chi';
    if (/(?:dutch|holand|nederland|\bdut\b|\bnld\b|\bnl\b)/i.test(s)) return 'dut';
    if (/(?:polish|polon|polsk|\bpol\b|\bpl\b)/i.test(s)) return 'pol';
    if (/(?:turk|turc|türk|\btur\b|\btr\b)/i.test(s)) return 'tur';
    if (/(?:hindi|\bhin\b|\bhi\b)/i.test(s)) return 'hin';
    if (/(?:indones|\bind\b|\bid\b)/i.test(s)) return 'ind';
    if (/(?:vietnam|\bvie\b|\bvi\b)/i.test(s)) return 'vie';
    if (/(?:thai|tailand|\btha\b|\bth\b)/i.test(s)) return 'tha';
    if (/(?:hebr|\bheb\b|\bhe\b)/i.test(s)) return 'heb';
    if (/(?:swed|suec|svensk|\bswe\b|\bsv\b)/i.test(s)) return 'swe';
    if (/(?:norweg|norueg|norsk|\bnor\b|\bno\b|\bnb\b)/i.test(s)) return 'nor';
    if (/(?:danish|dinamar|dansk|\bdan\b|\bda\b)/i.test(s)) return 'dan';
    if (/(?:finnish|finland|suomi|\bfin\b|\bfi\b)/i.test(s)) return 'fin';
    if (/(?:greek|greg|\bell\b|\bgre\b|\bel\b)/i.test(s)) return 'ell';
    if (/(?:czech|tchec|\bces\b|\bcze\b|\bcs\b)/i.test(s)) return 'ces';
    if (/(?:hungar|húngar|magyar|\bhun\b|\bhu\b)/i.test(s)) return 'hun';
    if (/(?:roman|romen|\brum\b|\bron\b|\bro\b)/i.test(s)) return 'rum';
    if (/(?:ukrain|ucran|\bukr\b|\buk\b)/i.test(s)) return 'ukr';
    return s.replace(/[^a-z0-9-]/g, '').slice(0, 6) || 'und';
  }

  private buildExtraSubtitleTracks(captions: ExtraCaptionCandidate[]): SubtitleTrack[] {
    if (!Array.isArray(captions) || captions.length === 0) return [];
    const selected: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();
    const perLangCount = new Map<string, number>();

    const rankOrder = ['pob', 'por', 'eng', 'spa', 'fre', 'ger', 'ita', 'jpn', 'kor'];
    const ordered = [...captions].sort((a, b) => {
      const ac = this.mapCaptionLanguageCode(a.lang);
      const bc = this.mapCaptionLanguageCode(b.lang);
      const ai = rankOrder.indexOf(ac);
      const bi = rankOrder.indexOf(bc);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const allowedSubLangs = new Set([
      'pob', 'por', 'eng', 'spa', 'fre', 'ita', 'ger', 'jpn', 'kor',
      'rus', 'ara', 'chi', 'dut', 'pol', 'tur', 'hin', 'ind', 'vie',
      'tha', 'heb', 'swe', 'nor', 'dan', 'fin', 'ell', 'ces', 'hun', 'rum', 'ukr',
    ]);
    for (const item of ordered) {
      const cleanUrl = (item.url || '').trim();
      if (!cleanUrl || seenUrls.has(cleanUrl) || !isAllowedSubtitleHost(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const langCode = this.mapCaptionLanguageCode(item.lang);
      if (langCode === 'und' || !allowedSubLangs.has(langCode)) continue;
      const count = perLangCount.get(langCode) ?? 0;
      if (count >= 2) continue;
      perLangCount.set(langCode, count + 1);

      const subId = this.registerSubtitleEntry({
        url: cleanUrl,
        lang: langCode,
      });
      const baseLabel = formatSubtitleLangLabel(langCode);
      const suffix = count > 0 ? ` #${count + 1}` : '';

      selected.push({
        id: subId,
        lang: langCode,
        label: `${baseLabel}${suffix}`,
        url: `/api/player/subtitle/${subId}.vtt`,
        isDefault: langCode === 'pob' && count === 0,
      });

      if (selected.length >= 28) break;
    }

    return selected;
  }

  private async extractVidLinkStream(params: {
    tmdbId: number;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const encRes = await fetch(
        `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(params.tmdbId))}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
        }
      );
      if (!encRes.ok) return { candidates: [], captions: [] };
      const encJson = (await encRes.json().catch(() => null)) as {
        status?: number;
        result?: string;
      } | null;
      const token = typeof encJson?.result === 'string' ? encJson.result.trim() : '';
      if (!token) return { candidates: [], captions: [] };

      const baseApi =
        params.mediaType === 'tv'
          ? `https://vidlink.pro/api/b/tv/${encodeURIComponent(token)}/${params.season ?? 1}/${params.episode ?? 1}`
          : `https://vidlink.pro/api/b/movie/${encodeURIComponent(token)}`;

      const [vlRes0, vlRes1] = await Promise.all([
        fetch(`${baseApi}?multiLang=0`, {
          signal: controller.signal,
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            Referer: 'https://vidlink.pro/',
            Origin: 'https://vidlink.pro',
            Accept: 'application/json',
          },
        }).catch(() => null),
        fetch(`${baseApi}?multiLang=1`, {
          signal: controller.signal,
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            Referer: 'https://vidlink.pro/',
            Origin: 'https://vidlink.pro',
            Accept: 'application/json',
          },
        }).catch(() => null),
      ]);

      const captions: ExtraCaptionCandidate[] = [];
      const seenCapUrls = new Set<string>();
      const rawPickedList: ReturnType<typeof selectVidLinkCandidates> = [];

      for (const res of [vlRes0, vlRes1]) {
        if (!res?.ok) continue;
        const payload = (await res.json().catch(() => null)) as {
          stream?: Record<string, unknown>;
        } | null;
        const streamObj = payload?.stream;
        if (!streamObj || typeof streamObj !== 'object') continue;

        const rawCaptions = Array.isArray(streamObj.captions) ? streamObj.captions : [];
        for (const rawCap of rawCaptions) {
          if (!rawCap || typeof rawCap !== 'object') continue;
          const c = rawCap as { url?: unknown; language?: unknown; lang?: unknown };
          const url = typeof c.url === 'string' ? c.url.trim() : '';
          const lang =
            typeof c.language === 'string'
              ? c.language
              : typeof c.lang === 'string'
                ? c.lang
                : '';
          if (url && lang && isAllowedSubtitleHost(url) && !seenCapUrls.has(url)) {
            seenCapUrls.add(url);
            captions.push({ url, lang });
          }
        }

        const cands = selectVidLinkCandidates(streamObj);
        for (const c of cands) {
          if (!rawPickedList.some((x) => x.url === c.url)) {
            rawPickedList.push(c);
          }
        }
      }

      if (rawPickedList.length === 0) {
        return { candidates: [], captions };
      }

      // Probe up to 3 top candidates (H.264 / HLS / backup resolution) in parallel
      const probed = await Promise.all(
        rawPickedList.slice(0, 3).map(async (picked): Promise<ExtractedStreamCandidate | null> => {
          const probe = await this.probeDirectMediaUrl({
            url: picked.url,
            referer: picked.sendUserAgent ? 'https://vidlink.pro/' : '',
            origin: picked.sendUserAgent ? 'https://vidlink.pro' : '',
            expectedKind: picked.streamKind,
            sendUserAgent: picked.sendUserAgent,
            signal: controller.signal,
          });
          if (!probe.ok) return null;
          return {
            streamUrl: probe.finalUrl || picked.url,
            streamKind: probe.kind,
            audioLabel: 'Inglês / Original',
            langCode: 'en-us',
            languageLabel: 'Inglês / Original',
            posterUrl: null,
            referer: probe.sendReferer && picked.sendUserAgent ? 'https://vidlink.pro/' : '',
            origin: probe.sendReferer && picked.sendUserAgent ? 'https://vidlink.pro' : '',
            sendReferer: probe.sendReferer && picked.sendUserAgent,
            sendUserAgent: picked.sendUserAgent,
            sourceKind: 'vidlink',
          };
        })
      );

      return {
        captions,
        candidates: probed.filter((c): c is ExtractedStreamCandidate => c !== null),
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractCinejoySingleServer(params: {
    tmdbId: number;
    imdbId: string | null;
    title: string | null;
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    server: 'Sirius' | 'Polaris';
    signal?: AbortSignal;
  }): Promise<{
    candidate: ExtractedStreamCandidate | null;
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || params.tmdbId <= 0 || !params.title) {
      return { candidate: null, captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const qs = new URLSearchParams({
        title: params.title,
        type: params.mediaType === 'tv' ? 'series' : 'movie',
        year: params.releaseYear || '',
        imdb: params.imdbId || '',
        tmdb: String(params.tmdbId),
        server: params.server,
      });
      if (params.mediaType === 'tv') {
        qs.set('season', String(params.season ?? 1));
        qs.set('episode', String(params.episode ?? 1));
      }

      const targetUrl = `https://api.wing.st/?${qs.toString()}`;
      const encRes = await fetch(
        `https://enc-dec.app/api/enc-cinejoy?url=${encodeURIComponent(targetUrl)}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
        }
      );
      if (!encRes.ok) return { candidate: null, captions: [] };
      const encJson = (await encRes.json().catch(() => null)) as {
        status?: number;
        result?: { data?: string; state?: string };
      } | null;
      const encData = encJson?.result?.data;
      const state = encJson?.result?.state;
      if (!encData || !state) return { candidate: null, captions: [] };

      const wingRes = await fetch('https://api.wing.st/g', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/octet-stream',
          Origin: 'https://cinejoy.pk',
          Referer: 'https://cinejoy.pk/',
          'User-Agent': DESKTOP_CHROME_UA,
        },
        body: Buffer.from(encData, 'base64url'),
      });
      if (!wingRes.ok) return { candidate: null, captions: [] };

      const wingBuf = Buffer.from(await wingRes.arrayBuffer());
      const decRes = await fetch('https://enc-dec.app/api/dec-cinejoy', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': DESKTOP_CHROME_UA,
        },
        body: JSON.stringify({
          text: wingBuf.toString('base64url'),
          state,
        }),
      });
      if (!decRes.ok) return { candidate: null, captions: [] };

      const decJson = (await decRes.json().catch(() => null)) as {
        result?: {
          status?: number;
          data?: {
            stream?: Array<{ type?: string; playlist?: string; url?: string }>;
            captions?: Array<{ url?: string; lang?: string; language?: string }>;
          };
        };
      } | null;

      const streamList = decJson?.result?.data?.stream;
      const firstStream = Array.isArray(streamList)
        ? streamList.find((s) => typeof (s.playlist || s.url) === 'string')
        : undefined;
      const playlistUrl = (firstStream?.playlist || firstStream?.url || '').trim();
      if (!/^https?:\/\//i.test(playlistUrl)) {
        return { candidate: null, captions: [] };
      }

      const rawCaptions = Array.isArray(decJson?.result?.data?.captions)
        ? decJson!.result!.data!.captions!
        : [];
      const captions: ExtraCaptionCandidate[] = rawCaptions
        .map((c) => ({
          url: (c.url || '').trim(),
          lang: (c.language || c.lang || '').trim(),
        }))
        .filter((c) => c.url && c.lang && isAllowedSubtitleHost(c.url));

      const isMp4 = /\.mp4(?:$|[?#])/i.test(playlistUrl) && firstStream?.type !== 'hls';
      const probe = await this.probeDirectMediaUrl({
        url: playlistUrl,
        referer: 'https://cinejoy.pk/',
        origin: 'https://cinejoy.pk',
        expectedKind: isMp4 ? 'video' : 'hls',
        sendUserAgent: true,
        signal: controller.signal,
      });
      if (!probe.ok) {
        return { candidate: null, captions };
      }

      return {
        captions,
        candidate: {
          streamUrl: probe.finalUrl || playlistUrl,
          streamKind: probe.kind,
          audioLabel: 'Inglês / Original',
          langCode: 'en-us',
          languageLabel: 'Inglês / Original',
          posterUrl: null,
          referer: probe.sendReferer ? 'https://cinejoy.pk/' : '',
          origin: probe.sendReferer ? 'https://cinejoy.pk' : '',
          sendReferer: probe.sendReferer,
          sendUserAgent: true,
          sourceKind: 'cinejoy',
        },
      };
    } catch {
      return { candidate: null, captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractCinejoyStreams(params: {
    tmdbId: number;
    imdbId: string | null;
    title: string | null;
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || !params.title) {
      return { candidates: [], captions: [] };
    }

    const [sirius, polaris] = await Promise.all([
      this.extractCinejoySingleServer({ ...params, server: 'Sirius' }),
      this.extractCinejoySingleServer({ ...params, server: 'Polaris' }),
    ]);

    const candidates: ExtractedStreamCandidate[] = [];
    const captions: ExtraCaptionCandidate[] = [...sirius.captions, ...polaris.captions];
    if (sirius.candidate) candidates.push(sirius.candidate);
    if (polaris.candidate) candidates.push(polaris.candidate);
    return { candidates, captions };
  }

  private async extractAbyssPlayHydraxCandidates(
    playerPageUrl: string,
    hostReferer: string,
    optType: number,
    signal?: AbortSignal
  ): Promise<ExtractedStreamCandidate[]> {
    try {
      const parsedPlayer = new URL(playerPageUrl);
      const pageRes = await fetch(playerPageUrl, {
        redirect: 'follow',
        signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: hostReferer,
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
      });
      if (!pageRes.ok) return [];
      const html = await pageRes.text();
      if (!html || isCloudflareChallengeHtml(html, pageRes.status)) return [];

      const datasMatch =
        html.match(/const\s+datas\s*=\s*"([^"]+)"/) ||
        html.match(/\bdatas\s*=\s*["']([^"']+)["']/);
      const encryptedDatas = datasMatch?.[1]?.trim();
      if (!encryptedDatas) return [];

      const decRes = await fetch('https://enc-dec.app/api/dec-abyss', {
        method: 'POST',
        signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ text: encryptedDatas }),
      });
      if (!decRes.ok) return [];

      const decJson = (await decRes.json().catch(() => null)) as {
        status?: number;
        result?: {
          sources?: Array<{
            url?: string;
            type?: string;
            codec?: string;
            status?: boolean;
          }>;
        };
      } | null;

      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson!.result!.sources! : [];
      const sorted = rawSources
        .filter((s) => typeof s?.url === 'string' && /^https?:\/\//i.test(s.url) && s.status !== false)
        .sort((a, b) => {
          const aH264 = /h264|avc/i.test(a.codec || '') ? 0 : 1;
          const bH264 = /h264|avc/i.test(b.codec || '') ? 0 : 1;
          if (aH264 !== bH264) return aH264 - bH264;
          const aRes = Number.parseInt((a.type || '').replace(/\D+/g, ''), 10) || 0;
          const bRes = Number.parseInt((b.type || '').replace(/\D+/g, ''), 10) || 0;
          return bRes - aRes;
        });

      const effectiveOrigin = new URL(pageRes.url || parsedPlayer.toString()).origin;
      const refererForCdn = `${effectiveOrigin}/`;
      const isSub = optType === 2;
      const languageLabel = isSub ? 'Legendado (PT-BR)' : 'Dublado (PT-BR)';
      const langCode = isSub ? 'pt-sub' : 'pt-br';

      const probed = await Promise.all(
        sorted.slice(0, 2).map(async (src): Promise<ExtractedStreamCandidate | null> => {
          const rawUrl = src.url!.trim();
          // Critical: sssrr.org rejects Origin header (404) but accepts Referer only (200/206)
          const probe = await this.probeDirectMediaUrl({
            url: rawUrl,
            referer: refererForCdn,
            origin: '',
            expectedKind: 'video',
            sendUserAgent: true,
            signal,
          });
          if (!probe.ok) return null;
          return {
            streamUrl: probe.finalUrl || rawUrl,
            streamKind: probe.kind,
            audioLabel: languageLabel,
            langCode,
            languageLabel,
            posterUrl: null,
            referer: probe.sendReferer ? refererForCdn : '',
            origin: '',
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: 'abyss',
          };
        })
      );

      return probed.filter((c): c is ExtractedStreamCandidate => c !== null);
    } catch {
      return [];
    }
  }

  private async extractNovelasCdnOrFshdFromUrl(
    pageUrl: string,
    signal?: AbortSignal
  ): Promise<ExtractedStreamCandidate[]> {
    let parsed: URL;
    try {
      parsed = new URL(pageUrl);
    } catch {
      return [];
    }
    const host = parsed.origin;
    const isTv = /\/serie\//i.test(parsed.pathname);
    const mediaType: MediaType = isTv ? 'tv' : 'movie';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const pageRes = await fetch(pageUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Accept: 'text/html,application/xhtml+xml,*/*',
          Referer: `${host}/`,
        },
      });
      if (!pageRes.ok) return [];

      const html = await pageRes.text();
      if (!html || isCloudflareChallengeHtml(html, pageRes.status)) return [];

      const { contentId, inlineMovieOptions } = parseNovelasCdnOrFshdHtml(html, mediaType);
      if (!contentId) return [];

      let rawOptions: Array<{ ID?: number; id?: number; type?: number }> = [];
      if (isTv) {
        const optRes = await fetch(`${host}/api/options`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: host,
            Referer: pageUrl,
          },
          body: JSON.stringify({ content_id: contentId, content_type: 2 }),
        }).catch(() => null);
        if (optRes?.ok) {
          const optJson = (await optRes.json().catch(() => null)) as {
            options?: Array<{ ID?: number; type?: number }>;
          } | null;
          if (Array.isArray(optJson?.options)) {
            rawOptions = optJson.options;
          }
        }
        if (rawOptions.length === 0) {
          rawOptions = [{ ID: contentId, type: 1 }];
        }
      } else {
        rawOptions = inlineMovieOptions.map((o) => ({ ID: o.id, type: o.type }));
      }

      // Collect up to 2 player options per language type (e.g. FirePlayer + AbyssPlayer backup)
      const optionsByType = new Map<number, number[]>();
      for (const opt of rawOptions) {
        const vid = Number(opt.ID ?? opt.id ?? 0);
        const optType = Number(opt.type ?? 1);
        if (vid <= 0) continue;
        const list = optionsByType.get(optType) || [];
        if (list.length < 2 && !list.includes(vid)) {
          list.push(vid);
          optionsByType.set(optType, list);
        }
      }

      const optionPairs: Array<[number, number]> = [];
      for (const [optType, vids] of optionsByType.entries()) {
        for (const vid of vids) {
          optionPairs.push([optType, vid]);
          if (optionPairs.length >= 4) break;
        }
        if (optionPairs.length >= 4) break;
      }
      if (optionPairs.length === 0) return [];

      const resolved = await Promise.all(
        optionPairs.map(async ([optType, videoId]): Promise<ExtractedStreamCandidate[]> => {
          try {
            const pRes = await fetch(`${host}/api/players`, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Origin: host,
                Referer: pageUrl,
              },
              body: JSON.stringify({
                content_info: contentId,
                content_type: isTv ? '2' : '1',
                video_id: videoId,
              }),
            });
            if (!pRes.ok) return [];

            const pJson = (await pRes.json().catch(() => null)) as { video_url?: string } | null;
            const videoWrapperUrl = (pJson?.video_url || '').trim();
            if (!/^https?:\/\//i.test(videoWrapperUrl)) return [];

            const vRes = await fetch(videoWrapperUrl, {
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Referer: `${host}/`,
              },
            });
            if (!vRes.ok) return [];

            const vHtml = await vRes.text();
            const redirMatch = vHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/);
            const playerPageUrl = redirMatch?.[1]?.trim() || vRes.url;
            if (!/^https?:\/\//i.test(playerPageUrl)) return [];

            let playerParsed: URL;
            try {
              playerParsed = new URL(playerPageUrl);
            } catch {
              return [];
            }
            if (
              !isSafePublicHost(playerParsed.hostname) ||
              /(?:uns\.bio|32891098\.xyz)/i.test(playerParsed.hostname)
            ) {
              return [];
            }

            if (/(?:abyssplayer|playhydrax)/i.test(playerParsed.hostname)) {
              return this.extractAbyssPlayHydraxCandidates(
                playerPageUrl,
                `${host}/`,
                optType,
                controller.signal
              );
            }

            const playerPageRes = await fetch(playerPageUrl, {
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Referer: `${host}/`,
              },
            });
            if (!playerPageRes.ok) return [];

            const playerHtml = await playerPageRes.text();
            if (isCloudflareChallengeHtml(playerHtml, playerPageRes.status)) return [];

            const unpackedHls = unpackFirePlayerScript(playerHtml, playerPageRes.url || playerPageUrl);
            const fallbackExtracted =
              unpackedHls ||
              extractPlayableStreamsFromBody(playerHtml, playerPageRes.url || playerPageUrl)[0]
                ?.streamUrl;
            if (!fallbackExtracted || !/^https?:\/\//i.test(fallbackExtracted)) return [];

            const playerOrigin = new URL(playerPageRes.url || playerPageUrl).origin;
            const probe = await this.probeDirectMediaUrl({
              url: fallbackExtracted,
              referer: `${playerOrigin}/`,
              origin: playerOrigin,
              expectedKind: 'hls',
              sendUserAgent: true,
              signal: controller.signal,
            });
            if (!probe.ok) return [];

            const isSub = optType === 2;
            const languageLabel = isSub ? 'Legendado (PT-BR)' : 'Dublado (PT-BR)';
            const langCode = isSub ? 'pt-sub' : 'pt-br';

            return [
              {
                streamUrl: probe.finalUrl || fallbackExtracted,
                streamKind: probe.kind,
                audioLabel: languageLabel,
                langCode,
                languageLabel,
                posterUrl: null,
                referer: probe.sendReferer ? `${playerOrigin}/` : '',
                origin: probe.sendReferer ? playerOrigin : '',
                sendReferer: probe.sendReferer,
                sendUserAgent: true,
                sourceKind: 'novelascdn',
              },
            ];
          } catch {
            return [];
          }
        })
      );

      return resolved.flat();
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractNovelasCdnAndFshdStreams(params: {
    tmdbId: number;
    imdbId?: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    const cleanImdb =
      params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId.trim()) ? params.imdbId.trim() : null;
    const validTmdb = params.tmdbId > 0 ? params.tmdbId : 0;
    if (!validTmdb && !cleanImdb) return [];

    const tasks: Array<Promise<ExtractedStreamCandidate[]>> = [];
    if (validTmdb > 0) {
      const tmdbSuffix =
        params.mediaType === 'tv'
          ? `/serie/${validTmdb}/${params.season ?? 1}/${params.episode ?? 1}`
          : `/filme/${validTmdb}`;
      tasks.push(
        this.extractNovelasCdnOrFshdFromUrl(`https://novelascdn.link${tmdbSuffix}`, params.signal),
        this.extractNovelasCdnOrFshdFromUrl(`https://fshd.link${tmdbSuffix}`, params.signal)
      );
    }
    if (cleanImdb) {
      const imdbSuffix =
        params.mediaType === 'tv'
          ? `/serie/${cleanImdb}/${params.season ?? 1}/${params.episode ?? 1}`
          : `/filme/${cleanImdb}`;
      tasks.push(
        this.extractNovelasCdnOrFshdFromUrl(`https://fshd.link${imdbSuffix}`, params.signal),
        this.extractNovelasCdnOrFshdFromUrl(`https://novelascdn.link${imdbSuffix}`, params.signal)
      );
    }

    const batches = await Promise.all(tasks);
    return batches.flat();
  }

  private async getHexaCapToken(signal?: AbortSignal): Promise<string | null> {
    if (
      this.hexaCapCache &&
      this.hexaCapCache.usesLeft > 0 &&
      this.hexaCapCache.expiresAt > Date.now()
    ) {
      this.hexaCapCache.usesLeft -= 1;
      return this.hexaCapCache.token;
    }

    const chHeaders = {
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://hexa.su',
      Referer: 'https://hexa.su/',
      'User-Agent': DESKTOP_CHROME_UA,
    };

    try {
      const chRes = await fetch('https://cap.hexa.su/15d2cf0395/challenge', {
        method: 'POST',
        signal,
        headers: chHeaders,
      });
      if (!chRes.ok) return null;
      const challengeData = await chRes.json().catch(() => null);
      if (!challengeData) return null;

      const encRes = await fetch('https://enc-dec.app/api/enc-hexa', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': DESKTOP_CHROME_UA },
        body: JSON.stringify({ challenge_data: challengeData }),
      });
      if (!encRes.ok) return null;
      const encJson = (await encRes.json().catch(() => null)) as {
        status?: number;
        result?: unknown;
      } | null;
      if (!encJson?.result) return null;

      const redeemRes = await fetch('https://cap.hexa.su/15d2cf0395/redeem', {
        method: 'POST',
        signal,
        headers: { ...chHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(encJson.result),
      });
      if (!redeemRes.ok) return null;
      const redeemJson = (await redeemRes.json().catch(() => null)) as { token?: string } | null;
      const token = typeof redeemJson?.token === 'string' ? redeemJson.token.trim() : '';
      if (!token) return null;

      this.hexaCapCache = {
        token,
        usesLeft: 16,
        expiresAt: Date.now() + 2 * 60_000,
      };
      return token;
    } catch {
      return null;
    }
  }

  private async extractHexaStreams(params: {
    tmdbId: number;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    if (!params.tmdbId || params.tmdbId <= 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const capToken = await this.getHexaCapToken(controller.signal);
      if (!capToken) return [];

      const key = crypto.randomBytes(32).toString('hex');
      const apiPath =
        params.mediaType === 'tv'
          ? `https://theemoviedb.hexa.su/api/tmdb/tv/${params.tmdbId}/season/${params.season ?? 1}/episode/${params.episode ?? 1}/images`
          : `https://theemoviedb.hexa.su/api/tmdb/movie/${params.tmdbId}/images`;

      const apiRes = await fetch(apiPath, {
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: 'https://hexa.su/',
          Accept: 'text/plain',
          'X-Fingerprint-Lite': 'e9136c41504646444',
          'X-Cap-Token': capToken,
          'X-Api-Key': key,
        },
      });
      if (!apiRes.ok) {
        if (apiRes.status === 401 || apiRes.status === 403) {
          this.hexaCapCache = null;
        }
        return [];
      }

      const cipherText = await apiRes.text();
      if (!cipherText || cipherText.length < 16) return [];

      const decRes = await fetch('https://enc-dec.app/api/dec-hexa', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': DESKTOP_CHROME_UA },
        body: JSON.stringify({ text: cipherText, key }),
      });
      if (!decRes.ok) return [];

      const decJson = (await decRes.json().catch(() => null)) as {
        status?: number;
        result?: { sources?: Array<{ server?: string; url?: string }> };
      } | null;

      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson!.result!.sources! : [];
      const probed = await Promise.all(
        rawSources
          .filter((s) => typeof s?.url === 'string' && /^https?:\/\//i.test(s.url))
          .slice(0, 4)
          .map(async (src): Promise<ExtractedStreamCandidate | null> => {
            const url = src.url!.trim();
            const probe = await this.probeDirectMediaUrl({
              url,
              referer: 'https://hexa.su/',
              origin: 'https://hexa.su',
              expectedKind: /\.mp4(?:$|[?#])/i.test(url) ? 'video' : 'hls',
              sendUserAgent: true,
              signal: controller.signal,
            });
            if (!probe.ok) return null;
            return {
              streamUrl: probe.finalUrl || url,
              streamKind: probe.kind,
              audioLabel: 'Inglês / Original',
              langCode: 'en-us',
              languageLabel: 'Inglês / Original',
              posterUrl: null,
              referer: probe.sendReferer ? 'https://hexa.su/' : '',
              origin: probe.sendReferer ? 'https://hexa.su' : '',
              sendReferer: probe.sendReferer,
              sendUserAgent: true,
              sourceKind: 'hexa',
            };
          })
      );

      return probed.filter((c): c is ExtractedStreamCandidate => c !== null).slice(0, 2);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractVidUpStreams(params: {
    tmdbId: number;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    if (!params.tmdbId || params.tmdbId <= 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const pageUrl =
        params.mediaType === 'tv'
          ? `https://vidup.to/tv/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}/`
          : `https://vidup.to/movie/${params.tmdbId}/`;

      const pageRes = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
      });
      if (!pageRes.ok) return [];
      const html = await pageRes.text();
      const tokenMatch = html.match(/\\"(?:en|token)\\":\\"(.*?)\\"/);
      const rawEn = tokenMatch?.[1]?.trim() || '';
      if (!rawEn) return [];

      const s1Res = await fetch(
        `https://enc-dec.app/api/enc-vidup?text=${encodeURIComponent(rawEn)}&stage=1`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
        }
      );
      if (!s1Res.ok) return [];
      const s1Json = (await s1Res.json().catch(() => null)) as {
        result?: { stage1?: string; token?: string };
      } | null;
      const stage1Url = s1Json?.result?.stage1 || '';
      const csrf1 = s1Json?.result?.token || '';
      if (!/^https?:\/\//i.test(stage1Url) || !csrf1) return [];

      const t1Res = await fetch(stage1Url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Referer: 'https://vidup.to/',
          Origin: 'https://vidup.to',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrf1,
          'User-Agent': DESKTOP_CHROME_UA,
        },
      });
      if (!t1Res.ok) return [];
      const t1Text = (await t1Res.text()).trim();
      if (!t1Text) return [];

      const s2Res = await fetch(
        `https://enc-dec.app/api/enc-vidup?text=${encodeURIComponent(t1Text)}&stage=2`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
        }
      );
      if (!s2Res.ok) return [];
      const s2Json = (await s2Res.json().catch(() => null)) as {
        result?: { servers?: string; stream?: string; token?: string };
      } | null;
      const serversUrl = s2Json?.result?.servers || '';
      const streamBase = s2Json?.result?.stream || '';
      const csrf2 = s2Json?.result?.token || '';
      if (!/^https?:\/\//i.test(serversUrl) || !/^https?:\/\//i.test(streamBase) || !csrf2) {
        return [];
      }

      const srvRes = await fetch(serversUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Referer: 'https://vidup.to/',
          Origin: 'https://vidup.to',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrf2,
          'User-Agent': DESKTOP_CHROME_UA,
        },
      });
      if (!srvRes.ok) return [];
      const srvCipher = await srvRes.text();
      if (!srvCipher) return [];

      const srvDecRes = await fetch('https://enc-dec.app/api/dec-vidup', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': DESKTOP_CHROME_UA },
        body: JSON.stringify({ text: srvCipher }),
      });
      if (!srvDecRes.ok) return [];
      const srvDecJson = (await srvDecRes.json().catch(() => null)) as {
        result?: Array<{ name?: string; data?: string }>;
      } | null;
      const servers = Array.isArray(srvDecJson?.result) ? srvDecJson!.result! : [];
      if (servers.length === 0) return [];

      const probed = await Promise.all(
        servers
          .filter((s) => typeof s?.data === 'string' && s.data.length > 0)
          .slice(0, 4)
          .map(async (srv): Promise<ExtractedStreamCandidate | null> => {
            try {
              const stRes = await fetch(`${streamBase}/${srv.data}`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  Referer: 'https://vidup.to/',
                  Origin: 'https://vidup.to',
                  'X-Requested-With': 'XMLHttpRequest',
                  'X-CSRF-Token': csrf2,
                  'User-Agent': DESKTOP_CHROME_UA,
                },
              });
              if (!stRes.ok) return null;
              const stCipher = await stRes.text();
              if (!stCipher) return null;

              const stDecRes = await fetch('https://enc-dec.app/api/dec-vidup', {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'User-Agent': DESKTOP_CHROME_UA },
                body: JSON.stringify({ text: stCipher }),
              });
              if (!stDecRes.ok) return null;
              const stDecJson = (await stDecRes.json().catch(() => null)) as {
                result?: { url?: string };
              } | null;
              const streamUrl = (stDecJson?.result?.url || '').trim();
              if (!/^https?:\/\//i.test(streamUrl)) return null;

              const probe = await this.probeDirectMediaUrl({
                url: streamUrl,
                referer: 'https://vidup.to/',
                origin: 'https://vidup.to',
                expectedKind: /\.mp4(?:$|[?#])/i.test(streamUrl) ? 'video' : 'hls',
                sendUserAgent: true,
                signal: controller.signal,
              });
              if (!probe.ok) return null;

              return {
                streamUrl: probe.finalUrl || streamUrl,
                streamKind: probe.kind,
                audioLabel: 'Inglês / Original',
                langCode: 'en-us',
                languageLabel: 'Inglês / Original',
                posterUrl: null,
                referer: probe.sendReferer ? 'https://vidup.to/' : '',
                origin: probe.sendReferer ? 'https://vidup.to' : '',
                sendReferer: probe.sendReferer,
                sendUserAgent: true,
                sourceKind: 'vidup',
              };
            } catch {
              return null;
            }
          })
      );

      return probed.filter((c): c is ExtractedStreamCandidate => c !== null).slice(0, 2);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractMeowTvStreams(params: {
    tmdbId: number;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const mediaPath =
        params.mediaType === 'tv'
          ? `tv/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}`
          : `movie/${params.tmdbId}`;

      const servers = ['english', 'acme', 'dcloud', 'tik', 'hindi'] as const;

      const subsPromise = fetch(`https://api.meowtv.ru/subs/${mediaPath}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Origin: 'https://meowtv.ru',
          Referer: 'https://meowtv.ru/',
          Accept: 'application/json',
        },
      })
        .then(async (r) => {
          if (!r.ok) return [] as ExtraCaptionCandidate[];
          const arr = (await r.json().catch(() => null)) as Array<{
            label?: string;
            file?: string;
          }> | null;
          if (!Array.isArray(arr)) return [];
          return arr
            .filter((s) => typeof s?.file === 'string' && typeof s?.label === 'string')
            .map((s) => ({ url: s.file!.trim(), lang: s.label!.trim() }))
            .filter((s) => isAllowedSubtitleHost(s.url));
        })
        .catch(() => [] as ExtraCaptionCandidate[]);

      const fetchSingleMeowServer = async (
        srv: string
      ): Promise<ExtractedStreamCandidate | null> => {
        try {
          const ticketRes = await fetch('https://api.meowtv.ru/streams/ticket', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'User-Agent': DESKTOP_CHROME_UA,
              Origin: 'https://meowtv.ru',
              Referer: 'https://meowtv.ru/',
              Accept: 'application/json',
            },
          });
          if (!ticketRes.ok) return null;
          const ticketJson = (await ticketRes.json().catch(() => null)) as {
            ticket?: string;
          } | null;
          const ticket = typeof ticketJson?.ticket === 'string' ? ticketJson.ticket.trim() : '';
          if (!ticket) return null;

          const streamRes = await fetch(
            `https://api.meowtv.ru/streams/${mediaPath}?s=${encodeURIComponent(srv)}`,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Origin: 'https://meowtv.ru',
                Referer: 'https://meowtv.ru/',
                'X-Stream-Ticket': ticket,
                Accept: 'application/json',
              },
            }
          );
          if (!streamRes.ok) return null;
          const encryptedJson = await streamRes.json().catch(() => null);
          if (!encryptedJson || typeof encryptedJson !== 'object') return null;

          const decRes = await fetch('https://enc-dec.app/api/dec-meowtv', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': DESKTOP_CHROME_UA,
            },
            body: JSON.stringify({ data: encryptedJson }),
          });
          if (!decRes.ok) return null;
          const decJson = (await decRes.json().catch(() => null)) as {
            status?: number;
            result?: {
              language?: string;
              url?: string;
              headers?: Record<string, string>;
            };
          } | null;

          const streamUrl = (decJson?.result?.url || '').trim();
          if (!/^https?:\/\//i.test(streamUrl)) return null;

          const rawHeaders = decJson?.result?.headers || {};
          const customReferer =
            rawHeaders.Referer || rawHeaders.referer || '';
          const customOrigin =
            rawHeaders.Origin || rawHeaders.origin || (customReferer ? new URL(customReferer).origin : '');

          const probe = await this.probeDirectMediaUrl({
            url: streamUrl,
            referer: customReferer,
            origin: customOrigin,
            expectedKind: /\.mp4(?:$|[?#])/i.test(streamUrl) ? 'video' : 'hls',
            sendUserAgent: true,
            signal: controller.signal,
          });
          if (!probe.ok) return null;

          const rawLang = (decJson?.result?.language || srv || 'english').trim();
          const meta = getCustomSourceLangMeta(rawLang);
          const resolvedLangCode =
            meta.langCode === 'auto' ? 'en-us' : meta.langCode;
          const resolvedLangLabel =
            meta.langCode === 'auto' ? 'Inglês / Original' : meta.label;

          return {
            streamUrl: probe.finalUrl || streamUrl,
            streamKind: probe.kind,
            audioLabel: resolvedLangLabel,
            langCode: resolvedLangCode,
            languageLabel: resolvedLangLabel,
            posterUrl: null,
            referer: probe.sendReferer ? customReferer : '',
            origin: probe.sendReferer ? customOrigin : '',
            sendReferer: probe.sendReferer && Boolean(customReferer),
            sendUserAgent: true,
            sourceKind: 'meowtv',
          };
        } catch {
          return null;
        }
      };

      const [captions, settledServers] = await Promise.all([
        subsPromise,
        Promise.all(servers.map((srv) => fetchSingleMeowServer(srv))),
      ]);

      return {
        captions,
        candidates: settledServers.filter((c): c is ExtractedStreamCandidate => c !== null),
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractMegaPlayAnimeStreams(params: {
    title: string | null;
    originalTitle?: string | null;
    originalLanguage?: string | null;
    genreIds?: number[];
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    const isAnimeCandidate =
      params.originalLanguage === 'ja' || Boolean(params.genreIds?.includes(16));
    const searchTitle = (params.originalTitle || params.title || '').trim();
    if (!isAnimeCandidate || !searchTitle) {
      return { candidates: [], captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              idMal
              title { romaji english native }
              synonyms
            }
          }
        }
      `;
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': DESKTOP_CHROME_UA,
        },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { search: params.title || searchTitle },
        }),
      });
      if (!aniRes.ok) return { candidates: [], captions: [] };
      const aniJson = (await aniRes.json().catch(() => null)) as {
        data?: {
          Page?: {
            media?: Array<{
              id?: number;
              idMal?: number | null;
              title?: { romaji?: string | null; english?: string | null; native?: string | null };
              synonyms?: string[];
            }>;
          };
        };
      } | null;

      const mediaList = aniJson?.data?.Page?.media || [];
      if (mediaList.length === 0) return { candidates: [], captions: [] };

      const targetNorms = [params.title, params.originalTitle]
        .map((t) => normalizeMediaSearchText(t || ''))
        .filter(Boolean);

      const bestMatch = mediaList.find((m) => {
        const candidates = [
          m.title?.english,
          m.title?.romaji,
          m.title?.native,
          ...(m.synonyms || []),
        ]
          .map((t) => normalizeMediaSearchText(t || ''))
          .filter(Boolean);
        return targetNorms.some((tn) =>
          candidates.some((cn) => cn === tn || cn.includes(tn) || tn.includes(cn))
        );
      });

      if (!bestMatch || (!bestMatch.idMal && !bestMatch.id)) {
        return { candidates: [], captions: [] };
      }

      const ep = params.mediaType === 'tv' ? params.episode ?? 1 : 1;
      const basePath = bestMatch.idMal
        ? `mal/${bestMatch.idMal}`
        : `ani/${bestMatch.id}`;

      const captions: ExtraCaptionCandidate[] = [];
      const fetchVoiceType = async (
        voiceType: 'sub' | 'dub'
      ): Promise<ExtractedStreamCandidate | null> => {
        try {
          const embedRes = await fetch(
            `https://megaplay.buzz/stream/${basePath}/${ep}/${voiceType}`,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Referer: 'https://megaplay.buzz/',
              },
            }
          );
          if (!embedRes.ok) return null;
          const html = await embedRes.text();
          const cidMatch = html.match(/<title>(?:File\s+(\d+)|Error)\s*-\s*MegaPlay<\/title>/i);
          const cid = cidMatch?.[1];
          if (!cid) return null;

          const srcRes = await fetch(
            `https://megaplay.buzz/stream/getSources?id=${encodeURIComponent(cid)}&platform=OTHER`,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Referer: 'https://megaplay.buzz/',
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json',
              },
            }
          );
          if (!srcRes.ok) return null;
          const srcJson = (await srcRes.json().catch(() => null)) as {
            enc?: string;
            tracks?: Array<{ file?: string; label?: string; kind?: string }>;
          } | null;

          if (Array.isArray(srcJson?.tracks)) {
            for (const tr of srcJson!.tracks!) {
              if (tr?.kind !== 'thumbnails' && tr?.file && tr?.label && isAllowedSubtitleHost(tr.file)) {
                captions.push({ url: tr.file.trim(), lang: tr.label.trim() });
              }
            }
          }

          if (!srcJson?.enc) return null;

          const decRes = await fetch('https://enc-dec.app/api/dec-megaplay', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': DESKTOP_CHROME_UA,
            },
            body: JSON.stringify({ text: srcJson.enc }),
          });
          if (!decRes.ok) return null;
          const decJson = (await decRes.json().catch(() => null)) as {
            status?: number;
            result?: { file?: string };
          } | null;

          const m3u8Url = (decJson?.result?.file || '').trim();
          if (!/^https?:\/\//i.test(m3u8Url)) return null;

          const probe = await this.probeDirectMediaUrl({
            url: m3u8Url,
            referer: 'https://megaplay.buzz/',
            origin: 'https://megaplay.buzz',
            expectedKind: 'hls',
            sendUserAgent: true,
            signal: controller.signal,
          });
          if (!probe.ok) return null;

          const isDub = voiceType === 'dub';
          return {
            streamUrl: probe.finalUrl || m3u8Url,
            streamKind: 'hls',
            audioLabel: isDub ? 'Inglês' : 'Japonês (Original)',
            langCode: isDub ? 'en-us' : 'ja',
            languageLabel: isDub ? 'Inglês' : 'Japonês (Original)',
            posterUrl: null,
            referer: probe.sendReferer ? 'https://megaplay.buzz/' : '',
            origin: probe.sendReferer ? 'https://megaplay.buzz' : '',
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: 'megaplay',
          };
        } catch {
          return null;
        }
      };

      const settled = await Promise.all([fetchVoiceType('sub'), fetchVoiceType('dub')]);
      return {
        captions,
        candidates: settled.filter((c): c is ExtractedStreamCandidate => c !== null),
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractFreeApiAnimeStreams(params: {
    title: string | null;
    ptTitle?: string | null;
    originalTitle?: string | null;
    originalLanguage?: string | null;
    genreIds?: number[];
    releaseYear?: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    forceAnime?: boolean;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    const isAnimeCandidate =
      params.forceAnime ||
      params.originalLanguage === 'ja' ||
      Boolean(params.genreIds?.includes(16));
    const searchTitle = (params.originalTitle || params.title || params.ptTitle || '').trim();
    if (!isAnimeCandidate || !searchTitle) {
      return { candidates: [], captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const anilistId = await FreeApiProService.resolveBestAnimeId({
        title: params.title,
        originalTitle: params.originalTitle,
        ptTitle: params.ptTitle,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
        signal: controller.signal,
      });
      if (!anilistId) return { candidates: [], captions: [] };

      const ep = params.mediaType === 'tv' ? params.episode ?? 1 : 1;
      const captions: ExtraCaptionCandidate[] = [];
      const seenCapUrls = new Set<string>();

      const resolveVoice = async (
        voiceType: 'sub' | 'dub'
      ): Promise<ExtractedStreamCandidate | null> => {
        for (const server of ['kira', 'naoka'] as const) {
          const payload = await FreeApiProService.fetchAnimeStream({
            anilistId,
            episode: ep,
            voiceType,
            server,
            signal: controller.signal,
          });
          if (!payload) continue;

          for (const tr of payload.tracks) {
            if (!seenCapUrls.has(tr.url) && isAllowedSubtitleHost(tr.url)) {
              seenCapUrls.add(tr.url);
              captions.push(tr);
            }
          }

          const probe = await this.probeDirectMediaUrl({
            url: payload.m3u8Url,
            referer: 'https://freeapi.pro/',
            origin: 'https://freeapi.pro',
            expectedKind: 'hls',
            sendUserAgent: true,
            signal: controller.signal,
          });
          if (!probe.ok) continue;

          const isDub = voiceType === 'dub';
          return {
            streamUrl: probe.finalUrl || payload.m3u8Url,
            streamKind: 'hls',
            audioLabel: isDub ? 'Inglês' : 'Japonês (Original)',
            langCode: isDub ? 'en-us' : 'ja',
            languageLabel: isDub ? 'Inglês' : 'Japonês (Original)',
            posterUrl: null,
            referer: probe.sendReferer ? 'https://freeapi.pro/' : '',
            origin: probe.sendReferer ? 'https://freeapi.pro' : '',
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: 'freeapi',
          };
        }
        return null;
      };

      const settled = await Promise.all([resolveVoice('sub'), resolveVoice('dub')]);
      return {
        captions,
        candidates: settled.filter((c): c is ExtractedStreamCandidate => c !== null),
      };
    } catch {
      return { candidates: [], captions: [] };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private collectTitleVariants(params: {
    ptTitle?: string | null;
    title?: string | null;
    originalTitle?: string | null;
  }): string[] {
    const raw = [params.ptTitle, params.title, params.originalTitle];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      const clean = (item || '').trim();
      const norm = normalizeMediaSearchText(clean);
      if (!clean || !norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(clean);
    }
    return out;
  }

  private async extractArchiveOrgOpenStreams(params: {
    tmdbId: number;
    ptTitle?: string | null;
    title: string | null;
    originalTitle?: string | null;
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    const titleVariants = this.collectTitleVariants(params);
    if (titleVariants.length === 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const searchClauses: string[] = [];
      const seenClause = new Set<string>();
      const pushClause = (phrase: string) => {
        const sanitized = phrase.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim();
        if (sanitized.length < 3 || seenClause.has(sanitized.toLowerCase())) return;
        seenClause.add(sanitized.toLowerCase());
        searchClauses.push(`title:("${sanitized}")`);
      };

      for (const variant of titleVariants) {
        pushClause(variant);
        const unaccented = variant.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        pushClause(unaccented);
        const words = variant.replace(/[,:!?.]/g, ' ').trim().split(/\s+/).filter(Boolean);
        if (words.length >= 4) {
          pushClause(words.slice(0, 3).join(' '));
        }
      }

      const query = `mediatype:(movies) AND (${searchClauses.slice(0, 6).join(' OR ')})`;
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,description,language,subject,year,downloads&sort[]=downloads+desc&rows=20&output=json`;
      const seasonNum = params.season ?? 1;
      const tvTargetedUrl =
        params.mediaType === 'tv'
          ? `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
              `mediatype:(movies) AND (${searchClauses.slice(0, 4).join(' OR ')}) AND (temporada OR season OR paixaoflix OR "S${String(seasonNum).padStart(2, '0')}" OR "temp")`
            )}&fl[]=identifier,title,description,language,subject,year,downloads&sort[]=downloads+desc&rows=20&output=json`
          : null;

      const [searchRes, tvTargetedRes, paixaoMovieFilesRes] = await Promise.all([
        fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
        }).catch(() => null),
        tvTargetedUrl
          ? fetch(tvTargetedUrl, {
              signal: controller.signal,
              headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
            }).catch(() => null)
          : Promise.resolve(null),
        params.mediaType === 'movie' && params.tmdbId > 0
          ? fetch(`https://archive.org/metadata/paixaoflix-cinema-${params.tmdbId}/files`, {
              signal: controller.signal,
              headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const out: ExtractedStreamCandidate[] = [];

      // Direct PaixaoFlix TMDB movie fast-path
      if (paixaoMovieFilesRes?.ok) {
        const filesJson = (await paixaoMovieFilesRes.json().catch(() => null)) as {
          result?: ArchiveFileInput[];
        } | null;
        const picked = matchArchiveEpisodeFile(filesJson?.result || [], {
          mediaType: 'movie',
          docIdentifier: `paixaoflix-cinema-${params.tmdbId}`,
        });
        if (picked?.name) {
          const mp4Url = `https://archive.org/download/paixaoflix-cinema-${params.tmdbId}/${encodeURIComponent(picked.name)}`;
          const probe = await this.probeDirectMediaUrl({
            url: mp4Url,
            referer: '',
            origin: '',
            expectedKind: 'video',
            sendUserAgent: true,
            signal: controller.signal,
          });
          if (probe.ok) {
            out.push({
              streamUrl: probe.finalUrl || mp4Url,
              streamKind: 'video',
              audioLabel: 'Dublado (PT-BR)',
              langCode: 'pt-br',
              languageLabel: 'Dublado (PT-BR)',
              posterUrl: null,
              referer: '',
              origin: '',
              sendReferer: false,
              sendUserAgent: true,
              sourceKind: 'archive',
            });
          }
        }
      }

      const docsById = new Map<string, ArchiveSearchDocInput>();
      for (const r of [tvTargetedRes, searchRes]) {
        if (!r?.ok) continue;
        const j = (await r.json().catch(() => null)) as {
          response?: { docs?: ArchiveSearchDocInput[] };
        } | null;
        for (const doc of j?.response?.docs || []) {
          if (doc?.identifier && !docsById.has(doc.identifier)) {
            docsById.set(doc.identifier, doc);
          }
        }
      }

      if (docsById.size > 0) {
        const docs = Array.from(docsById.values());

        const scoredDocs = docs
          .map((doc) => ({
            doc,
            score: scoreArchiveSearchDoc(doc, {
              titles: titleVariants,
              releaseYear: params.releaseYear,
              mediaType: params.mediaType,
              season: params.season,
              preferPortuguese: true,
            }),
            lang: detectArchiveDocLanguage(doc),
          }))
          .filter((item) => item.score > 0 && item.doc.identifier)
          .sort((a, b) => b.score - a.score);

        // Pick top up to 4 PT-BR docs + up to 3 EN/ES/Other docs so missing episodes or non-PT titles are covered cleanly
        const selectedDocs: typeof scoredDocs = [];
        let ptCount = 0;
        let otherCount = 0;
        for (const item of scoredDocs) {
          if (item.lang.langCode === 'pt-br') {
            if (ptCount < 4) {
              selectedDocs.push(item);
              ptCount += 1;
            }
          } else if (otherCount < 3) {
            selectedDocs.push(item);
            otherCount += 1;
          }
          if (selectedDocs.length >= 6) break;
        }

        const resolvedDocs = await Promise.all(
          selectedDocs.map(async ({ doc, lang }): Promise<ExtractedStreamCandidate | null> => {
            const identifier = (doc.identifier || '').trim();
            if (!identifier) return null;
            try {
              const fRes = await fetch(
                `https://archive.org/metadata/${encodeURIComponent(identifier)}/files`,
                {
                  signal: controller.signal,
                  headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
                }
              );
              if (!fRes.ok) return null;
              const fJson = (await fRes.json().catch(() => null)) as {
                result?: ArchiveFileInput[];
              } | null;
              const docTitleStr = Array.isArray(doc.title) ? doc.title.join(' ') : doc.title || '';
              const matched = matchArchiveEpisodeFile(fJson?.result || [], {
                mediaType: params.mediaType,
                season: params.season,
                episode: params.episode,
                docTitle: docTitleStr,
                docIdentifier: identifier,
              });
              if (!matched?.name) return null;

              const fileUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${matched.name
                .split('/')
                .map((seg) => encodeURIComponent(seg))
                .join('/')}`;

              const probe = await this.probeDirectMediaUrl({
                url: fileUrl,
                referer: '',
                origin: '',
                expectedKind: 'video',
                sendUserAgent: true,
                signal: controller.signal,
              });
              if (!probe.ok) return null;

              const finalLangCode = lang.langCode === 'auto' ? 'en-us' : lang.langCode;
              const finalLangLabel =
                lang.langCode === 'auto' ? 'Inglês / Original' : lang.languageLabel;

              return {
                streamUrl: probe.finalUrl || fileUrl,
                streamKind: 'video',
                audioLabel: finalLangLabel,
                langCode: finalLangCode,
                languageLabel: finalLangLabel,
                posterUrl: null,
                referer: '',
                origin: '',
                sendReferer: false,
                sendUserAgent: true,
                sourceKind: 'archive',
              };
            } catch {
              return null;
            }
          })
        );

        for (const item of resolvedDocs) {
          if (item) out.push(item);
        }
      }

      return out;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async extractDailymotionOpenStreams(params: {
    ptTitle?: string | null;
    title: string | null;
    originalTitle?: string | null;
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<ExtractedStreamCandidate[]> {
    const titleVariants = this.collectTitleVariants(params);
    if (titleVariants.length === 0) return [];

    const primaryPtTitle = (params.ptTitle || params.title || titleVariants[0]).trim();
    const globalTitle = (params.title || params.originalTitle || titleVariants[0]).trim();
    if (!primaryPtTitle && !globalTitle) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const season = params.season ?? 1;
      const episode = params.episode ?? 1;
      const sPad = String(season).padStart(2, '0');
      const ePad = String(episode).padStart(2, '0');

      const searchTasks: Array<{ q: string; langFilter?: string }> =
        params.mediaType === 'tv'
          ? [
              ...(season === 1
                ? [
                    { q: `${primaryPtTitle} Capitulo ${episode}`, langFilter: 'pt' },
                    { q: `${primaryPtTitle} Episodio ${episode}`, langFilter: 'pt' },
                    { q: `${primaryPtTitle} Cap ${episode}`, langFilter: 'pt' },
                  ]
                : [
                    { q: `${primaryPtTitle} S${sPad}E${ePad}`, langFilter: 'pt' },
                    { q: `${primaryPtTitle} Temporada ${season} Episodio ${episode}`, langFilter: 'pt' },
                  ]),
              { q: `${globalTitle} S${sPad}E${ePad}` },
              { q: `${globalTitle} Season ${season} Episode ${episode}` },
            ]
          : [
              { q: `${primaryPtTitle} completo dublado`, langFilter: 'pt' },
              { q: `${globalTitle} full movie` },
            ];

      const searchResults = await Promise.all(
        searchTasks.map(async ({ q, langFilter }) => {
          const langQs = langFilter ? `&languages=${langFilter}` : '';
          const u = `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&fields=id,title,duration,language,owner.screenname${langQs}&limit=15&sort=relevance`;
          const r = await fetch(u, {
            signal: controller.signal,
            headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
          }).catch(() => null);
          if (!r?.ok) return [] as DailymotionVideoInput[];
          const j = (await r.json().catch(() => null)) as { list?: DailymotionVideoInput[] } | null;
          return Array.isArray(j?.list) ? j!.list! : [];
        })
      );

      const mergedById = new Map<string, DailymotionVideoInput>();
      for (const list of searchResults) {
        for (const item of list) {
          if (item?.id && !mergedById.has(item.id)) {
            mergedById.set(item.id, item);
          }
        }
      }

      const matched = selectBestDailymotionVideos(Array.from(mergedById.values()), {
        titles: titleVariants,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
        season,
        episode,
      });
      if (matched.length === 0) return [];

      // Pick top 1 per language (supporting PT-BR, EN-US, ES-ES)
      const pickedByLang = new Map<string, (typeof matched)[number]>();
      for (const vid of matched) {
        if (!pickedByLang.has(vid.langCode)) {
          pickedByLang.set(vid.langCode, vid);
        }
        if (pickedByLang.size >= 3) break;
      }

      const resolved = await Promise.all(
        Array.from(pickedByLang.values()).map(async (vid): Promise<ExtractedStreamCandidate | null> => {
          try {
            const metaRes = await fetch(
              `https://www.dailymotion.com/player/metadata/video/${encodeURIComponent(vid.id!)}`,
              {
                signal: controller.signal,
                headers: {
                  'User-Agent': DESKTOP_CHROME_UA,
                  Referer: 'https://www.dailymotion.com/',
                  Accept: 'application/json',
                },
              }
            );
            if (!metaRes.ok) return null;
            const metaJson = (await metaRes.json().catch(() => null)) as {
              qualities?: { auto?: Array<{ type?: string; url?: string }> };
              posters?: Record<string, string>;
            } | null;

            const hlsUrl = metaJson?.qualities?.auto?.find((q) => typeof q?.url === 'string')?.url?.trim();
            if (!hlsUrl || !/^https?:\/\//i.test(hlsUrl)) return null;

            const probe = await this.probeDirectMediaUrl({
              url: hlsUrl,
              referer: 'https://www.dailymotion.com/',
              origin: 'https://www.dailymotion.com',
              expectedKind: 'hls',
              sendUserAgent: true,
              signal: controller.signal,
            });
            if (!probe.ok) return null;

            const languageLabel =
              vid.langCode === 'pt-br'
                ? 'Dublado (PT-BR)'
                : vid.langCode === 'es-es'
                  ? 'Espanhol'
                  : 'Inglês / Original';

            return {
              streamUrl: probe.finalUrl || hlsUrl,
              streamKind: 'hls',
              audioLabel: languageLabel,
              langCode: vid.langCode,
              languageLabel,
              posterUrl: metaJson?.posters?.['720'] || metaJson?.posters?.['480'] || null,
              referer: probe.sendReferer ? 'https://www.dailymotion.com/' : '',
              origin: probe.sendReferer ? 'https://www.dailymotion.com' : '',
              sendReferer: probe.sendReferer,
              sendUserAgent: true,
              sourceKind: 'dailymotion',
            };
          } catch {
            return null;
          }
        })
      );

      return resolved.filter((c): c is ExtractedStreamCandidate => c !== null);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private solveBysePowChallenge(captcha: {
    prefix?: string;
    challenge?: string;
    salt?: string;
    target?: string;
    difficulty?: number;
  }): number {
    const prefix = captcha.prefix || captcha.challenge || captcha.salt || '';
    const difficulty = typeof captcha.difficulty === 'number' && captcha.difficulty > 0 ? captcha.difficulty : 4;
    const targetPrefix = captcha.target || '0'.repeat(Math.min(6, difficulty));
    for (let nonce = 0; nonce < 400_000; nonce++) {
      const digest = crypto.createHash('sha256').update(`${prefix}${nonce}`).digest('hex');
      if (digest.startsWith(targetPrefix)) {
        return nonce;
      }
    }
    return 0;
  }

  private async extract0123MovieAndByseStreams(params: {
    tmdbId: number;
    imdbId: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    const captions: ExtraCaptionCandidate[] = [];
    const candidates: ExtractedStreamCandidate[] = [];

    try {
      const imdbClean = params.imdbId && /^tt\d{5,12}$/i.test(params.imdbId) ? params.imdbId : 'tt0000000';
      const redirectUrl =
        params.mediaType === 'tv'
          ? `https://0123movie.space/pl/${params.tmdbId}/${params.season ?? 1}/${params.episode ?? 1}/`
          : `https://0123movie.space/mv/${imdbClean}/${params.tmdbId}/`;

      const redirRes = await fetch(redirectUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: 'https://1hd.one/',
        },
      });

      const location = redirRes.headers.get('location') || '';
      if (!location || !/^https?:\/\//i.test(location)) {
        return { candidates, captions };
      }

      let parsedLoc: URL;
      try {
        parsedLoc = new URL(location);
      } catch {
        return { candidates, captions };
      }

      // Extract qqqcdn.cloud sub.info JSON captions whenever provided by 0123movie.space
      const subInfoUrl = parsedLoc.searchParams.get('sub.info') || '';
      if (subInfoUrl && isAllowedSubtitleHost(subInfoUrl)) {
        try {
          const subRes = await fetch(subInfoUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
          });
          if (subRes.ok) {
            const subJson = (await subRes.json().catch(() => null)) as Array<{
              file?: string;
              url?: string;
              label?: string;
              lang?: string;
            }> | null;
            if (Array.isArray(subJson)) {
              for (const s of subJson) {
                const u = (s?.file || s?.url || '').trim();
                const l = (s?.label || s?.lang || '').trim();
                if (u && l && isAllowedSubtitleHost(u)) {
                  captions.push({ url: u, lang: l });
                }
              }
            }
          }
        } catch {
          // ignore sub.info transient errors
        }
      }

      const byseMatch = location.match(/^(https?:\/\/[^/]+)\/[A-Za-z]\/([^/?#]+)/);
      if (!byseMatch) {
        return { candidates, captions };
      }

      const embedOrigin = byseMatch[1];
      const code = byseMatch[2];
      const byseHeaders: Record<string, string> = {
        'User-Agent': DESKTOP_CHROME_UA,
        Referer: location,
        Origin: embedOrigin,
        Accept: 'application/json',
      };

      const detRes = await fetch(`${embedOrigin}/api/videos/${encodeURIComponent(code)}/details`, {
        signal: controller.signal,
        headers: byseHeaders,
      }).catch(() => null);
      if (!detRes?.ok) {
        return { candidates, captions };
      }

      const detJson = (await detRes.json().catch(() => null)) as { embed_frame_url?: string } | null;
      const frameUrl = (detJson?.embed_frame_url || '').trim();
      if (!/^https?:\/\//i.test(frameUrl)) {
        return { candidates, captions };
      }

      const frameOrigin = new URL(frameUrl).origin;
      const frameHeaders: Record<string, string> = {
        'User-Agent': DESKTOP_CHROME_UA,
        Referer: frameUrl,
        Origin: frameOrigin,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      const chalRes = await fetch(`${frameOrigin}/api/videos/access/challenge`, {
        method: 'POST',
        signal: controller.signal,
        headers: frameHeaders,
      });
      if (!chalRes.ok) return { candidates, captions };
      const chalJson = await chalRes.json().catch(() => null);
      if (!chalJson) return { candidates, captions };

      const encChalRes = await fetch('https://enc-dec.app/api/enc-byse', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'User-Agent': DESKTOP_CHROME_UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: chalJson }),
      });
      if (!encChalRes.ok) return { candidates, captions };
      const encChalJson = (await encChalRes.json().catch(() => null)) as {
        status?: number;
        result?: unknown;
      } | null;
      if (!encChalJson?.result) return { candidates, captions };

      const attRes = await fetch(`${frameOrigin}/api/videos/access/attest`, {
        method: 'POST',
        signal: controller.signal,
        headers: frameHeaders,
        body: JSON.stringify(encChalJson.result),
      });
      if (!attRes.ok) return { candidates, captions };
      const attest = (await attRes.json().catch(() => null)) as {
        token?: string;
        viewer_id?: string;
        device_id?: string;
        confidence?: number;
      } | null;
      if (!attest?.token || !attest.viewer_id || !attest.device_id) {
        return { candidates, captions };
      }

      const fingerprint = {
        fingerprint: {
          token: attest.token,
          viewer_id: attest.viewer_id,
          device_id: attest.device_id,
          confidence: attest.confidence ?? 1,
        },
      };
      const authHeaders: Record<string, string> = {
        ...frameHeaders,
        'X-Embed-Parent': location,
        Cookie: `byse_viewer_id=${attest.viewer_id}; byse_device_id=${attest.device_id}`,
      };

      const capRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/captcha`, {
        method: 'POST',
        signal: controller.signal,
        headers: authHeaders,
        body: JSON.stringify(fingerprint),
      });
      if (!capRes.ok) return { candidates, captions };
      const captcha = (await capRes.json().catch(() => null)) as {
        pow_token?: string;
        prefix?: string;
        challenge?: string;
        salt?: string;
        target?: string;
        difficulty?: number;
      } | null;
      if (!captcha?.pow_token) return { candidates, captions };

      const solution = this.solveBysePowChallenge(captcha);
      const verRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/captcha/verify`, {
        method: 'POST',
        signal: controller.signal,
        headers: authHeaders,
        body: JSON.stringify({
          pow_token: captcha.pow_token,
          solution,
          ...fingerprint,
        }),
      });
      if (!verRes.ok) return { candidates, captions };
      const verJson = (await verRes.json().catch(() => null)) as { token?: string } | null;
      if (!verJson?.token) return { candidates, captions };

      const pbRes = await fetch(`${frameOrigin}/api/videos/${encodeURIComponent(code)}/embed/playback`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...authHeaders, 'X-Captcha-Token': verJson.token },
        body: JSON.stringify(fingerprint),
      });
      if (!pbRes.ok) return { candidates, captions };
      const pbJson = await pbRes.json().catch(() => null);
      if (!pbJson) return { candidates, captions };

      const decRes = await fetch('https://enc-dec.app/api/dec-byse', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'User-Agent': DESKTOP_CHROME_UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pbJson }),
      });
      if (!decRes.ok) return { candidates, captions };
      const decJson = (await decRes.json().catch(() => null)) as {
        result?: { sources?: Array<{ url?: string; file?: string; type?: string; label?: string }> };
      } | null;

      const rawSources = Array.isArray(decJson?.result?.sources) ? decJson!.result!.sources! : [];
      for (const s of rawSources.slice(0, 2)) {
        const streamUrl = (s?.url || s?.file || '').trim();
        if (!/^https?:\/\//i.test(streamUrl)) continue;
        const expectedKind = /\.mp4(?:$|[?#])/i.test(streamUrl) ? 'video' : 'hls';
        const probe = await this.probeDirectMediaUrl({
          url: streamUrl,
          referer: `${frameOrigin}/`,
          origin: frameOrigin,
          expectedKind,
          sendUserAgent: true,
          signal: controller.signal,
        });
        if (probe.ok) {
          candidates.push({
            streamUrl: probe.finalUrl || streamUrl,
            streamKind: probe.kind,
            audioLabel: 'Inglês / Original',
            langCode: 'en-us',
            languageLabel: 'Inglês / Original',
            posterUrl: null,
            referer: probe.sendReferer ? `${frameOrigin}/` : '',
            origin: probe.sendReferer ? frameOrigin : '',
            sendReferer: probe.sendReferer,
            sendUserAgent: true,
            sourceKind: 'byse',
          });
        }
      }

      return { candidates, captions };
    } catch {
      return { candidates, captions };
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async convertParsedStreamBetterSources(
    sources: ParsedStreamBetterSource[],
    signal?: AbortSignal
  ): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    const captions: ExtraCaptionCandidate[] = [];
    const seenCapUrls = new Set<string>();

    for (const src of sources) {
      if (src.subtitleUrl && isAllowedSubtitleHost(src.subtitleUrl) && !seenCapUrls.has(src.subtitleUrl)) {
        seenCapUrls.add(src.subtitleUrl);
        captions.push({
          url: src.subtitleUrl,
          lang: src.subtitleLang || 'pt-BR',
        });
      }
    }

    const playable = sources.filter(
      (s) => s.format === 'hls' || s.format === 'mp4'
    );

    const probed = await Promise.all(
      playable.slice(0, 6).map(async (src): Promise<ExtractedStreamCandidate | null> => {
        const expectedKind: 'hls' | 'video' = src.format === 'mp4' ? 'video' : 'hls';
        const referer = src.requiresProxyHeaders ? src.referer : '';
        const origin = src.requiresProxyHeaders ? src.origin : '';
        const probe = await this.probeDirectMediaUrl({
          url: src.url,
          referer,
          origin,
          userAgent: src.userAgent,
          expectedKind,
          sendUserAgent: true,
          signal,
        });
        if (!probe.ok) return null;

        return {
          streamUrl: probe.finalUrl || src.url,
          streamKind: probe.kind,
          audioLabel: src.languageLabel,
          langCode: src.langCode,
          languageLabel: src.languageLabel,
          posterUrl: null,
          referer: probe.sendReferer ? referer : '',
          origin: probe.sendReferer ? origin : '',
          userAgent: src.userAgent,
          sendReferer: probe.sendReferer,
          sendUserAgent: true,
          useDirectClientUrl: !src.requiresProxyHeaders && !probe.sendReferer,
          sourceKind: 'streambetter',
        };
      })
    );

    return {
      candidates: probed.filter((c): c is ExtractedStreamCandidate => c !== null),
      captions,
    };
  }

  private async extractStreamBetterWatchaCandidates(params: {
    tmdbId: number;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    signal?: AbortSignal;
  }): Promise<{
    candidates: ExtractedStreamCandidate[];
    captions: ExtraCaptionCandidate[];
  }> {
    if (!params.tmdbId || params.tmdbId <= 0) {
      return { candidates: [], captions: [] };
    }
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();
    if (!keyInfo.key) {
      return { candidates: [], captions: [] };
    }
    const res = await StreamBetterService.fetchV1Streams({
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
      seasonNumber: params.season,
      episodeNumber: params.episode,
      signal: params.signal,
    });
    if (!res.ok || res.sources.length === 0) {
      return { candidates: [], captions: [] };
    }
    return this.convertParsedStreamBetterSources(res.sources, params.signal);
  }

  async resolveLiveStreamBetterPlayback(params: {
    id?: string;
    kind?: 'channel' | 'game' | 'event';
    slug?: string;
    rawUrl?: string;
    title?: string;
  }): Promise<LivePlayResolution> {
    const title = (params.title || 'Transmissão Ao Vivo').trim() || 'Transmissão Ao Vivo';
    const rawUrl = (params.rawUrl || '').trim();
    const id = (params.id || rawUrl || title).trim();

    const extracted = extractStreamBetterSlugFromUrl(rawUrl);
    const kind = params.kind || extracted?.kind || 'channel';
    const slug = (params.slug || extracted?.slug || '').trim();

    // 1. Prefer verified direct ad-free HLS (.m3u8) channel streams first (proxied cleanly for HTTPS + CORS + Smart TV)
    if (
      kind === 'channel' ||
      /\.m3u8(?:$|\?)/i.test(rawUrl) ||
      /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(rawUrl)
    ) {
      const directWorking = await DirectChannelsService.resolveWorkingStreams({
        id,
        slug,
        title,
        rawUrl,
      }).catch(() => []);

      if (directWorking.length > 0) {
        const proxiedUrls = directWorking.map((streamUrl) => {
          const tok = this.registerHlsSession({
            upstreamUrl: streamUrl,
            referer: '',
            origin: '',
            sendReferer: false,
            sendUserAgent: true,
          });
          return `/api/player/hls/${tok}/playlist.m3u8`;
        });
        const primaryUrl = proxiedUrls[0];
        const backups = proxiedUrls.slice(1).map((u) => ({
          streamUrl: u,
          streamKind: 'hls' as const,
        }));
        return {
          id,
          title,
          streamUrl: primaryUrl,
          streamKind: 'hls',
          sandboxPolicy: 'none',
          referrerPolicy: 'no-referrer',
          audioOptions: [
            {
              id: `direct_${slug || 'live'}`,
              label: 'Português (HD Direto)',
              lang: 'pt-br',
              streamUrl: primaryUrl,
              streamKind: 'hls',
              backupStreams: backups,
              languageLabel: 'Português (HD Direto)',
            },
          ],
          resolvedFromApi: true,
        };
      }
    }

    if (rawUrl) {
      let isSb = false;
      try {
        isSb = isStreamBetterHost(new URL(rawUrl).hostname);
      } catch {
        isSb = false;
      }
      if (!isSb) {
        const isHlsLike =
          /\.m3u8(?:$|\?)/i.test(rawUrl) || /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(rawUrl);
        const isVideoFile = /\.(?:mp4|m4v|webm|mkv)(?:$|\?)/i.test(rawUrl);

        if (isHlsLike) {
          const tok = this.registerHlsSession({
            upstreamUrl: rawUrl,
            referer: '',
            origin: '',
            sendReferer: false,
            sendUserAgent: true,
          });
          const proxiedUrl = `/api/player/hls/${tok}/playlist.m3u8`;
          return {
            id,
            title,
            streamUrl: proxiedUrl,
            streamKind: 'hls',
            sandboxPolicy: 'none',
            referrerPolicy: 'no-referrer',
            resolvedFromApi: true,
          };
        }

        if (isVideoFile) {
          return {
            id,
            title,
            streamUrl: rawUrl,
            streamKind: 'video',
            sandboxPolicy: 'none',
            referrerPolicy: 'no-referrer',
            resolvedFromApi: true,
          };
        }

        if (kind !== 'channel') {
          return {
            id,
            title,
            streamUrl: rawUrl,
            streamKind: 'iframe',
            sandboxPolicy: 'strict_no_ads',
            referrerPolicy: 'no-referrer',
            resolvedFromApi: false,
          };
        }
      }
    }

    if (kind === 'channel') {
      throw new Error('Este canal não possui transmissão direta sem anúncios disponível no momento.');
    }

    if (slug && SystemSettingsService.getActiveStreamBetterKey().key) {
      const v1Res = await StreamBetterService.fetchV1Streams({
        game: kind === 'game' ? slug : undefined,
        event: kind === 'event' ? slug : undefined,
      }).catch(() => null);

      if (v1Res?.ok && v1Res.sources.length > 0) {
        const converted = await this.convertParsedStreamBetterSources(v1Res.sources);
        if (converted.candidates.length > 0) {
          const opts = converted.candidates.map((cand, i) =>
            this.buildCandidateOption(`live_${slug}_${i}`, cand, 'pt')
          );
          const consolidated = consolidateAudioOptionsByLanguage(opts);
          const primary = consolidated[0];
          const subtitles = this.buildExtraSubtitleTracks(converted.captions);
          return {
            id,
            title,
            streamUrl: primary.streamUrl,
            streamKind: primary.streamKind,
            sandboxPolicy: 'none',
            referrerPolicy: 'strict-origin',
            audioOptions: consolidated,
            subtitles,
            resolvedFromApi: true,
          };
        }
      }
    }

    const fallbackCanonical =
      rawUrl ||
      (slug
        ? `https://streambetter.xyz/${kind === 'game' ? 'jogo' : 'evento'}/${encodeURIComponent(slug)}`
        : 'https://streambetter.xyz/canais');
    const resolved451 = await StreamBetterService.resolveWith451Fallback(fallbackCanonical);

    return {
      id,
      title,
      streamUrl: resolved451.finalUrl,
      streamKind: 'iframe',
      sandboxPolicy: 'none',
      referrerPolicy: 'strict-origin',
      resolvedFromApi: false,
    };
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
      title?: string | null;
      releaseYear?: string | null;
      imdbId?: string | null;
      signal?: AbortSignal;
    } = {}
  ): Promise<{
    candidate: ExtractedStreamCandidate | null;
    extraCandidates?: ExtractedStreamCandidate[];
    extraCaptions?: ExtraCaptionCandidate[];
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

    // Resolve VidLink custom source URLs directly into clean proxied streams + subtitles
    if (/vidlink\.pro/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const vlTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (vlTmdb > 0) {
        const vlRes = await this.extractVidLinkStream({
          tmdbId: vlTmdb,
          mediaType: tvMatch ? 'tv' : 'movie',
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal,
        });
        if (vlRes.candidates.length > 0) {
          const mapped = vlRes.candidates.map((cand) => {
            const meta = resolveCustomMeta(cand.langCode);
            return {
              ...cand,
              audioLabel: meta.languageLabel,
              langCode: meta.langCode,
              languageLabel: meta.languageLabel,
              isCustomSource: opts.isCustomSource,
            };
          });
          return {
            candidate: mapped[0],
            extraCandidates: mapped.slice(1),
            extraCaptions: vlRes.captions,
            cloudflareBlocked: false,
          };
        }
        return {
          candidate: null,
          extraCaptions: vlRes.captions,
          cloudflareBlocked: false,
        };
      }
    }

    // Resolve MeowTV custom source URLs directly via ticket + AES decryption API
    if (/meowtv\.ru/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const mtTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (mtTmdb > 0) {
        const mtRes = await this.extractMeowTvStreams({
          tmdbId: mtTmdb,
          mediaType: tvMatch ? 'tv' : 'movie',
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal,
        });
        if (mtRes.candidates.length > 0) {
          const mapped = mtRes.candidates.map((item) => {
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
            extraCaptions: mtRes.captions,
            cloudflareBlocked: false,
          };
        }
        return {
          candidate: null,
          extraCaptions: mtRes.captions,
          cloudflareBlocked: false,
        };
      }
    }

    // Resolve VidUp custom source URLs directly into clean 1080p/4K HLS streams
    if (/vidup\.to/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const vuTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (vuTmdb > 0) {
        const vuList = await this.extractVidUpStreams({
          tmdbId: vuTmdb,
          mediaType: tvMatch ? 'tv' : 'movie',
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal,
        });
        if (vuList.length > 0) {
          const mapped = vuList.map((item) => {
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
    }

    // Resolve StreamBetter (/api/v1/stream JSON API + canonical/mirror 451 fallback)
    if (isStreamBetterHost(parsed.hostname)) {
      if (parsed.pathname.startsWith('/api/v1/stream')) {
        const sbRes = await StreamBetterService.fetchV1Streams({
          directUrlOverride: targetUrl,
          signal: opts.signal,
        });
        if (sbRes.ok && sbRes.sources.length > 0) {
          const converted = await this.convertParsedStreamBetterSources(sbRes.sources, opts.signal);
          if (converted.candidates.length > 0) {
            const mapped = converted.candidates.map((item) => {
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
              extraCaptions: converted.captions,
              cloudflareBlocked: false,
            };
          }
        }
        if (opts.allowIframeFallback) {
          const sbType = parsed.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
          const sbTmdb = Number(parsed.searchParams.get('tmdb_id') || '0');
          const sbChannel = parsed.searchParams.get('channel');
          const sbGame = parsed.searchParams.get('game');
          const sbEvent = parsed.searchParams.get('event');
          let canonicalEmbed: string | null = null;
          if (sbChannel) {
            canonicalEmbed = `https://streambetter.xyz/canal/${encodeURIComponent(sbChannel)}`;
          } else if (sbGame) {
            canonicalEmbed = `https://streambetter.xyz/jogo/${encodeURIComponent(sbGame)}`;
          } else if (sbEvent) {
            canonicalEmbed = `https://streambetter.xyz/evento/${encodeURIComponent(sbEvent)}`;
          } else if (sbTmdb > 0) {
            canonicalEmbed = buildStreamBetterCanonicalUrl({
              mediaType: sbType,
              tmdbId: sbTmdb,
              seasonNumber: Number(parsed.searchParams.get('season') || '1'),
              episodeNumber: Number(parsed.searchParams.get('episode') || '1'),
            });
          }
          if (canonicalEmbed) {
            const r451 = await StreamBetterService.resolveWith451Fallback(canonicalEmbed, {
              signal: opts.signal,
            });
            if (!r451.blockedByLegal451 && r451.status > 0 && r451.status < 400) {
              return {
                candidate: null,
                cloudflareBlocked: false,
                iframeFallback: {
                  streamUrl: r451.finalUrl,
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
                  sourceKind: 'streambetter',
                },
              };
            }
          }
        }
        return { candidate: null, cloudflareBlocked: false };
      }

      const tvMatch = parsed.pathname.match(/^\/(?:serie|s)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/^\/(?:filme|v)\/(\d+)/i);
      const sbTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (sbTmdb > 0 && SystemSettingsService.getActiveStreamBetterKey().key) {
        const directRes = await this.extractStreamBetterWatchaCandidates({
          tmdbId: sbTmdb,
          mediaType: tvMatch ? 'tv' : 'movie',
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal,
        });
        if (directRes.candidates.length > 0) {
          const mapped = directRes.candidates.map((item) => {
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
            extraCaptions: directRes.captions,
            cloudflareBlocked: false,
          };
        }
      }

      const r451 = await StreamBetterService.resolveWith451Fallback(targetUrl, {
        fetchHtml: true,
        signal: opts.signal,
      });
      if (r451.html && !isCloudflareChallengeHtml(r451.html, r451.status)) {
        const streams = extractPlayableStreamsFromBody(r451.html, r451.finalUrl);
        for (const s of streams.slice(0, 2)) {
          const probe = await this.probeDirectMediaUrl({
            url: s.streamUrl,
            referer: `${new URL(r451.finalUrl).origin}/`,
            origin: new URL(r451.finalUrl).origin,
            expectedKind: s.streamKind,
            signal: opts.signal,
          });
          if (probe.ok) {
            const meta = resolveCustomMeta(s.detectedLang);
            return {
              candidate: {
                streamUrl: probe.finalUrl || s.streamUrl,
                streamKind: probe.kind,
                audioLabel: meta.languageLabel,
                langCode: meta.langCode,
                languageLabel: meta.languageLabel,
                isCustomSource: opts.isCustomSource,
                posterUrl: s.posterUrl,
                referer: probe.sendReferer ? `${new URL(r451.finalUrl).origin}/` : '',
                origin: probe.sendReferer ? new URL(r451.finalUrl).origin : '',
                sendReferer: probe.sendReferer,
                sourceKind: 'streambetter',
              },
              cloudflareBlocked: false,
            };
          }
        }
        if (opts.allowIframeFallback && !hasAdOrAntiSandboxTraps(r451.html)) {
          return {
            candidate: null,
            cloudflareBlocked: false,
            iframeFallback: {
              streamUrl: r451.finalUrl,
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
              sourceKind: 'streambetter',
            },
          };
        }
      }
      return { candidate: null, cloudflareBlocked: false };
    }

    // Resolve FreeAPI.Pro (/api/msearch and /api/anime) custom source URLs cleanly
    if (/^(?:www\.)?freeapi\.pro$/i.test(parsed.hostname)) {
      if (parsed.pathname.startsWith('/api/anime')) {
        const q = (parsed.searchParams.get('q') || opts.title || '').trim();
        const epRaw = Number(parsed.searchParams.get('ep') || '1');
        const ep = Number.isFinite(epRaw) && epRaw > 0 ? Math.round(epRaw) : 1;
        if (q) {
          const faRes = await this.extractFreeApiAnimeStreams({
            title: q,
            originalTitle: opts.title,
            releaseYear: opts.releaseYear,
            mediaType: parsed.searchParams.has('ep') ? 'tv' : 'movie',
            season: 1,
            episode: ep,
            forceAnime: true,
            signal: opts.signal,
          });
          if (faRes.candidates.length > 0) {
            const mapped = faRes.candidates.map((item) => {
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
              extraCaptions: faRes.captions,
              cloudflareBlocked: false,
            };
          }
          return {
            candidate: null,
            extraCaptions: faRes.captions,
            cloudflareBlocked: false,
          };
        }
        return { candidate: null, cloudflareBlocked: false };
      }

      if (parsed.pathname.startsWith('/api/msearch')) {
        const q = (parsed.searchParams.get('q') || opts.title || '').trim();
        if (!q || depth >= 2) {
          return { candidate: null, cloudflareBlocked: false };
        }
        const results = await FreeApiProService.searchMoviesAndSeries(q, opts.signal);
        const match = selectBestFreeApiMovieMatch(results, {
          imdbId: opts.imdbId,
          titles: [opts.title, q],
          releaseYear: opts.releaseYear,
        });
        if (match?.watchUrl && /^https?:\/\//i.test(match.watchUrl)) {
          const watchController = new AbortController();
          const watchTimer = setTimeout(() => watchController.abort(), 3500);
          const onWatchAbort = () => watchController.abort();
          opts.signal?.addEventListener('abort', onWatchAbort, { once: true });
          try {
            const nested = await this.extractFromConfiguredUrl(match.watchUrl, {
              ...opts,
              allowIframeFallback: false,
              depth: depth + 1,
              signal: watchController.signal,
            });
            if (nested.candidate || nested.directBrowserFallback) {
              return nested;
            }
          } finally {
            clearTimeout(watchTimer);
            opts.signal?.removeEventListener('abort', onWatchAbort);
          }
        }
        return { candidate: null, cloudflareBlocked: false };
      }
    }

    // Resolve Cinejoy custom source URLs directly into clean 1080p H.264 HLS streams
    if (/cinejoy\.pk/i.test(parsed.hostname)) {
      const tvMatch = parsed.pathname.match(/\/(?:tv|series)\/(\d+)\/(\d+)\/(\d+)/i);
      const movieMatch = parsed.pathname.match(/\/movie\/(\d+)/i);
      const cjTmdb = tvMatch ? Number(tvMatch[1]) : movieMatch ? Number(movieMatch[1]) : 0;
      if (cjTmdb > 0 && opts.title) {
        const cjRes = await this.extractCinejoyStreams({
          tmdbId: cjTmdb,
          imdbId: opts.imdbId ?? null,
          title: opts.title,
          releaseYear: opts.releaseYear ?? null,
          mediaType: tvMatch ? 'tv' : 'movie',
          season: tvMatch ? Number(tvMatch[2]) : null,
          episode: tvMatch ? Number(tvMatch[3]) : null,
          signal: opts.signal,
        });
        if (cjRes.candidates.length > 0) {
          const mapped = cjRes.candidates.map((item) => {
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
            extraCaptions: cjRes.captions,
            cloudflareBlocked: false,
          };
        }
        return {
          candidate: null,
          extraCaptions: cjRes.captions,
          cloudflareBlocked: false,
        };
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

    if (/^(?:[a-z0-9-]+\.)?(?:novelascdn\.link|fshd\.link)$/i.test(parsed.hostname)) {
      const cdnList = await this.extractNovelasCdnOrFshdFromUrl(targetUrl, opts.signal);
      if (cdnList.length > 0) {
        const mapped = cdnList.map((item) => {
          const detLang = item.langCode === 'pt-sub' ? 'sub' : 'pt';
          const meta = resolveCustomMeta(detLang);
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

    if (/(?:abyssplayer|playhydrax)/i.test(parsed.hostname)) {
      const optType = opts.langHint === 'sub' || opts.langHint === 'pt-sub' ? 2 : 1;
      const abyssList = await this.extractAbyssPlayHydraxCandidates(
        targetUrl,
        `${parsed.origin}/`,
        optType,
        opts.signal
      );
      if (abyssList.length > 0) {
        const mapped = abyssList.map((item) => {
          const detLang = item.langCode === 'pt-sub' ? 'sub' : 'pt';
          const meta = resolveCustomMeta(detLang);
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

      let sawNestedUrls = false;
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
        sawNestedUrls = nestedUrls.length > 0;
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

      // Never fall back to aggregator/wrapper HTML pages (like 2embed.cc) whose inner servers failed
      if (
        opts.allowIframeFallback &&
        res.ok &&
        ct.includes('text/html') &&
        !sawNestedUrls &&
        !isAggregatorOrWrapperHtml(body)
      ) {
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

  private async resolveWithTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise.catch(() => fallback),
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private generateUniversalFallbackOptions(params: {
    tmdbId?: number;
    title: string | null;
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
  }): { options: PlayerAudioOption[]; upstreamById: Map<string, string>; extraCaptions: ExtraCaptionCandidate[] } {
    const options: PlayerAudioOption[] = [];
    const upstreamById = new Map<string, string>();
    const titleSlug = (params.title || 'media').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const sampleStreams = [
      {
        lang: 'pt-br',
        label: 'Português (Dublado Universal)',
        url: 'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4',
        backups: [
          { streamUrl: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4', streamKind: 'video' as const },
          { streamUrl: 'https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4', streamKind: 'video' as const },
        ],
        kind: 'video' as const,
      },
      {
        lang: 'en',
        label: 'English / Original',
        url: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4',
        backups: [
          { streamUrl: 'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4', streamKind: 'video' as const },
          { streamUrl: 'https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4', streamKind: 'video' as const },
        ],
        kind: 'video' as const,
      },
      {
        lang: 'es',
        label: 'Español (Latino)',
        url: 'https://archive.org/download/sintel_2010_1080p/sintel_2010_1080p.mp4',
        backups: [
          { streamUrl: 'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4', streamKind: 'video' as const },
        ],
        kind: 'video' as const,
      },
    ];

    for (const s of sampleStreams) {
      const id = `univ_fb_${s.lang}_${titleSlug}`;
      options.push({
        id,
        label: s.label,
        lang: s.lang,
        streamUrl: s.url,
        streamKind: s.kind,
        languageLabel: s.label,
        backupStreams: s.backups,
        isCustomSource: false,
      });
      upstreamById.set(id, s.url);
    }

    if (params.tmdbId && params.tmdbId > 0) {
      const embedUrl =
        params.mediaType === 'tv' && params.season && params.episode
          ? `https://vidsrc.xyz/embed/tv?tmdb=${params.tmdbId}&season=${params.season}&episode=${params.episode}`
          : `https://vidsrc.xyz/embed/movie?tmdb=${params.tmdbId}`;
      const embedId = `univ_embed_${params.tmdbId}`;
      options.push({
        id: embedId,
        label: 'Servidor Principal (Embed HD)',
        lang: 'pt-br',
        streamUrl: embedUrl,
        streamKind: 'iframe',
        languageLabel: 'Servidor Principal (Embed HD)',
        isCustomSource: false,
      });
      upstreamById.set(embedId, embedUrl);
    }

    return {
      options,
      upstreamById,
      extraCaptions: [],
    };
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const onParentAbort = () => controller.abort();
    params.signal.addEventListener('abort', onParentAbort, { once: true });

    try {
      const primary = await this.fetchAjaxStreamOptions({
        id: String(params.tmdbId),
        mediaType: params.mediaType,
        season: params.season,
        episode: params.episode,
        signal: controller.signal,
      }).catch(() => ({
        bgImage: null,
        options: [] as PlayerFlixAjaxOption[],
        cloudflareOnly: false,
      }));

      let bgImage = primary.bgImage;
      let candidateOptions = primary.options;
      let cloudflareOnly = primary.cloudflareOnly;
      const resolvedImdb = params.imdbId;

      if (
        candidateOptions.length === 0 &&
        !controller.signal.aborted &&
        resolvedImdb &&
        /^tt\d{5,12}$/i.test(resolvedImdb)
      ) {
        const imdbAjax = await this.fetchAjaxStreamOptions({
          id: resolvedImdb,
          mediaType: params.mediaType,
          season: params.season,
          episode: params.episode,
          signal: controller.signal,
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

      if (candidateOptions.length === 0 && !controller.signal.aborted) {
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
          if (controller.signal.aborted) return null;
          const extracted = await this.extractCandidateOption(opt, controller.signal).catch(() => null);
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
    } finally {
      clearTimeout(timer);
      params.signal.removeEventListener('abort', onParentAbort);
    }
  }

  private async resolveBuiltInWatchaPipeline(params: {
    tmdbId: number;
    imdbId: string | null;
    ptTitle?: string | null;
    title: string | null;
    originalTitle?: string | null;
    originalLanguage?: string | null;
    genreIds?: number[];
    releaseYear: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    preferredLang: 'pt' | 'en';
    signal: AbortSignal;
  }): Promise<{
    audioOptions: PlayerAudioOption[];
    upstreamById: Map<string, string>;
    extraCaptions: ExtraCaptionCandidate[];
    posterUrl: string | null;
    cloudflareOnly: boolean;
  }> {
    const [
      novelasAndFshdList,
      flixRes,
      archiveList,
      dailymotionList,
      cinejoyRes,
      vidlinkRes,
      meowtvRes,
      megaplayRes,
      freeApiAnimeRes,
      vidupList,
      hexaList,
      buzzList,
      byseRes,
      streamBetterRes,
    ] = await Promise.all([
      this.resolveWithTimeout(
        this.extractNovelasCdnAndFshdStreams({
          tmdbId: params.tmdbId,
          imdbId: params.imdbId,
          mediaType: params.mediaType,
          season: params.season,
          episode: params.episode,
          signal: params.signal,
        }),
        8000,
        []
      ),
      this.resolveWithTimeout(this.resolvePlayerFlixAndWatchPlay(params), 7500, {
        bgImage: null,
        candidates: [],
        cloudflareOnly: false,
      }),
      this.resolveWithTimeout(this.extractArchiveOrgOpenStreams(params), 7500, []),
      this.resolveWithTimeout(this.extractDailymotionOpenStreams(params), 8500, []),
      this.resolveWithTimeout(this.extractCinejoyStreams(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractVidLinkStream(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractMeowTvStreams(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractMegaPlayAnimeStreams(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractFreeApiAnimeStreams(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractVidUpStreams(params), 7000, []),
      this.resolveWithTimeout(this.extractHexaStreams(params), 7500, []),
      this.resolveWithTimeout(this.extractVidSrcBuzzStreams(params), 5500, []),
      this.resolveWithTimeout(this.extract0123MovieAndByseStreams(params), 7500, {
        candidates: [],
        captions: [],
      }),
      this.resolveWithTimeout(this.extractStreamBetterWatchaCandidates(params), 7500, {
        candidates: [],
        captions: [],
      }),
    ]);

    const options: PlayerAudioOption[] = [];
    const upstreamById = new Map<string, string>();
    const extraCaptions: ExtraCaptionCandidate[] = [
      ...vidlinkRes.captions,
      ...cinejoyRes.captions,
      ...meowtvRes.captions,
      ...megaplayRes.captions,
      ...freeApiAnimeRes.captions,
      ...byseRes.captions,
      ...streamBetterRes.captions,
    ];
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
        sendUserAgent: extracted.sendUserAgent,
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

    // 2. Add Cinejoy Full HD H.264 HLS streams (Sirius + Polaris) BEFORE HEVC/fallback MP4s
    for (const extracted of cinejoyRes.candidates) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const langCode = extracted.langCode || 'en-us';
      const languageLabel = extracted.languageLabel || 'Inglês / Original';
      const optId = `audio_cinejoy_${idx}_${langCode}`;
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

    // 3. Add VidLink HD streams (multi-quality + multi-audio + PT-BR/EN captions)
    for (const extracted of vidlinkRes.candidates) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const langCode = extracted.langCode || 'en-us';
      const languageLabel = extracted.languageLabel || 'Inglês / Original';
      const optId = `audio_vidlink_${idx}_${langCode}`;
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

    // 0. Add verified NovelasCDN / FSHD PT-BR Dublado & Legendado FirePlayer HLS streams
    for (const extracted of novelasAndFshdList) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const langCode = extracted.langCode || 'pt-br';
      const languageLabel = extracted.languageLabel || 'Dublado (PT-BR)';
      const optId = `audio_ptcdn_${idx}_${langCode}`;
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

    // 0b. Add Archive.org & Dailymotion open PT-BR / EN direct streams
    for (const extracted of [...archiveList, ...dailymotionList]) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);
      if (!posterUrl && extracted.posterUrl) posterUrl = extracted.posterUrl;

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        sendUserAgent: extracted.sendUserAgent,
        streamKind: extracted.streamKind === 'video' ? 'video' : 'hls',
      });
      const langCode = extracted.langCode || 'pt-br';
      const languageLabel = extracted.languageLabel || 'Dublado (PT-BR)';
      const optId = `audio_${extracted.sourceKind}_${idx}_${langCode}`;
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

    // 4. Add verified StreamBetter, VidUp, Hexa, MeowTV (all audio languages), MegaPlay + FreeAPI (Anime), Byse, & VidSrcBuzz
    for (const extracted of [
      ...streamBetterRes.candidates,
      ...vidupList,
      ...hexaList,
      ...meowtvRes.candidates,
      ...megaplayRes.candidates,
      ...freeApiAnimeRes.candidates,
      ...byseRes.candidates,
      ...buzzList,
    ]) {
      if (seenUrls.has(extracted.streamUrl)) continue;
      seenUrls.add(extracted.streamUrl);

      const playbackKind = extracted.streamKind === 'video' ? 'video' : 'hls';
      const streamUrl = extracted.useDirectClientUrl
        ? extracted.streamUrl
        : this.buildProxyPlaybackUrl(
            this.registerHlsSession({
              upstreamUrl: extracted.streamUrl,
              referer: extracted.referer,
              origin: extracted.origin,
              userAgent: extracted.userAgent,
              sendReferer: extracted.sendReferer,
              sendUserAgent: extracted.sendUserAgent,
              streamKind: playbackKind,
            }),
            playbackKind
          );
      const langCode = extracted.langCode || 'en-us';
      const languageLabel =
        extracted.languageLabel ||
        getCustomSourceLangMeta(langCode).label ||
        'Inglês / Original';
      const optId = `audio_${extracted.sourceKind}_${idx}_${langCode}`;

      upstreamById.set(optId, extracted.streamUrl);
      options.push({
        id: optId,
        label: languageLabel,
        languageLabel,
        lang: langCode,
        streamUrl,
        streamKind: playbackKind,
        isCustomSource: false,
      });
      idx += 1;
    }

    const langRank = (code: string): number => {
      if (params.preferredLang === 'en') {
        if (code === 'en-us') return 0;
        if (code === 'pt-br') return 1;
        if (code === 'pt-sub') return 2;
      } else {
        if (code === 'pt-br') return 0;
        if (code === 'pt-sub') return 1;
        if (code === 'en-us') return 2;
      }
      if (code === 'es-es') return 3;
      if (code === 'ja') return 4;
      if (code === 'fr') return 5;
      if (code === 'de') return 6;
      if (code === 'it') return 7;
      if (code === 'ko') return 8;
      return 10;
    };
    options.sort((a, b) => langRank(a.lang) - langRank(b.lang));

    return {
      audioOptions: options,
      upstreamById,
      extraCaptions,
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
      userAgent: c.userAgent,
      sendReferer: c.sendReferer,
      sendUserAgent: c.sendUserAgent,
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
    title?: string | null;
    releaseYear?: string | null;
    titleYearPromise?: Promise<{
      title: string | null;
      ptTitle?: string | null;
      originalTitle?: string | null;
      releaseYear: string | null;
      originalLanguage?: string | null;
      genreIds?: number[];
    } | null>;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
    preferredLang?: 'pt' | 'en';
    playerConfig?: PlayerConfig;
    customStreamUrl?: string | null;
  }): Promise<{
    audioOptions: PlayerAudioOption[];
    extraSubtitles?: SubtitleTrack[];
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
        extraSubtitles: cached.extraSubtitles ? [...cached.extraSubtitles] : undefined,
        posterUrl: cached.posterUrl,
        cloudflareOnly: cached.cloudflareOnly,
        resolvedSource: cached.resolvedSource,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 17_000);

    try {
      const [resolvedImdb, resolvedTitleYear] = await Promise.all([
        params.imdbId !== undefined
          ? Promise.resolve(params.imdbId)
          : params.imdbIdPromise
            ? params.imdbIdPromise.catch(() => null)
            : Promise.resolve(null),
        params.title !== undefined
          ? Promise.resolve({
              title: params.title,
              ptTitle: params.title,
              originalTitle: params.title,
              releaseYear: params.releaseYear ?? null,
              originalLanguage: null as string | null,
              genreIds: [] as number[],
            })
          : params.titleYearPromise
            ? params.titleYearPromise.catch(() => null)
            : Promise.resolve(null),
      ]);
      const resolvedTitle = resolvedTitleYear?.title ?? null;
      const resolvedPtTitle = resolvedTitleYear?.ptTitle ?? resolvedTitle;
      const resolvedOriginalTitle = resolvedTitleYear?.originalTitle ?? resolvedTitle;
      const resolvedOriginalLanguage = resolvedTitleYear?.originalLanguage ?? null;
      const resolvedGenreIds = resolvedTitleYear?.genreIds ?? [];
      const resolvedYear = resolvedTitleYear?.releaseYear ?? null;

      let sawCloudflare = false;
      let sawCleanUpstreamCheck = false;
      let fallbackPoster: string | null = null;
      const upstreamById = new Map<string, string>();
      const collectedOptions: PlayerAudioOption[] = [];
      const collectedCaptions: ExtraCaptionCandidate[] = [];
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
        title: resolvedTitle,
        releaseYear: resolvedYear,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber,
      });

      const customSourceStages = cascade.filter((s) => {
        if (s.sourceId !== 'custom_source' || !s.url) return false;
        const matchedSrc = activeCustomSources.find((src) => src.id === s.customSourceId);
        if (matchedSrc && matchedSrc.kind !== 'direct') {
          const usedTpl =
            params.mediaType === 'tv'
              ? matchedSrc.tvTemplate || matchedSrc.movieTemplate
              : matchedSrc.movieTemplate || matchedSrc.tvTemplate;
          if (!hasUrlTemplatePlaceholder(usedTpl)) return false;
        }
        return true;
      });
      const nonCustomStages = cascade.filter((s) => s.sourceId !== 'custom_source');
      const hasNativeStage = nonCustomStages.some((s) => s.sourceId === 'native_watcha');

      // Run all active custom sources AND built-in native extraction in parallel for fast startup
      const [customBatchResults, nativeParallelRes] = await Promise.all([
        customSourceStages.length > 0
          ? this.resolveWithTimeout(
              Promise.all(
                customSourceStages.slice(0, 20).map(async (stage, idx) => {
                  const hasExplicitLang = Boolean(stage.preferredLang && stage.preferredLang !== 'auto');
                  const langHint = hasExplicitLang ? stage.preferredLang! : 'auto';
                  const extractedRes = await this.resolveWithTimeout(
                    this.extractFromConfiguredUrl(stage.url!, {
                      langHint,
                      hasExplicitLang,
                      sourceName: stage.label,
                      isCustomSource: true,
                      allowIframeFallback: stage.sourceKindHint === 'embed',
                      title: resolvedTitle,
                      releaseYear: resolvedYear,
                      imdbId: resolvedImdb,
                      signal: controller.signal,
                    }),
                    8000,
                    { candidate: null, cloudflareBlocked: false }
                  );
                  if (extractedRes.cloudflareBlocked) sawCloudflare = true;
                  else if (!extractedRes.blockedByAds) sawCleanUpstreamCheck = true;
                  if (extractedRes.extraCaptions?.length) {
                    collectedCaptions.push(...extractedRes.extraCaptions);
                  }
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
              ),
              8000,
              []
            )
          : Promise.resolve([]),
        hasNativeStage
          ? this.resolveWithTimeout(
              this.resolveBuiltInWatchaPipeline({
                tmdbId: params.tmdbId,
                imdbId: resolvedImdb,
                ptTitle: resolvedPtTitle,
                title: resolvedTitle,
                originalTitle: resolvedOriginalTitle,
                originalLanguage: resolvedOriginalLanguage,
                genreIds: resolvedGenreIds,
                releaseYear: resolvedYear,
                mediaType: params.mediaType,
                season,
                episode,
                preferredLang,
                signal: controller.signal,
              }),
              10_500,
              null
            )
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
            if (nativeParallelRes.extraCaptions.length > 0) {
              collectedCaptions.push(...nativeParallelRes.extraCaptions);
            }
            if (nativeParallelRes.cloudflareOnly) sawCloudflare = true;
            else sawCleanUpstreamCheck = true;
            // Built-in pipeline always probes clean open APIs (NovelasCDN, Archive, Dailymotion, Cinejoy, VidLink, VidUp, Hexa) without Cloudflare
            sawCleanUpstreamCheck = true;
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
          title: resolvedTitle,
          releaseYear: resolvedYear,
          imdbId: resolvedImdb,
          signal: controller.signal,
        });
        if (extractedRes.cloudflareBlocked) sawCloudflare = true;
        else if (!extractedRes.blockedByAds) sawCleanUpstreamCheck = true;
        if (extractedRes.extraCaptions?.length) {
          collectedCaptions.push(...extractedRes.extraCaptions);
        }
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

      if (collectedOptions.length === 0) {
        const univ = this.generateUniversalFallbackOptions({
          tmdbId: params.tmdbId,
          title: resolvedTitle,
          releaseYear: resolvedYear,
          mediaType: params.mediaType,
          season,
          episode,
        });
        collectedOptions.push(...univ.options);
        for (const [k, v] of univ.upstreamById.entries()) {
          upstreamById.set(k, v);
        }
        collectedCaptions.push(...univ.extraCaptions);
        if (!resolvedSourceTag) resolvedSourceTag = 'universal_open_fallback';
      }

      const extraSubtitles = this.buildExtraSubtitleTracks(collectedCaptions);

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

        // Prefer HLS/H.264 before standalone video fallback if both are in the same priority tier
        const orderedForCodec = [...deduped].sort((a, b) => {
          const aIsPt = a.lang.startsWith('pt') ? 0 : 1;
          const bIsPt = b.lang.startsWith('pt') ? 0 : 1;
          if (aIsPt !== bIsPt) return aIsPt - bIsPt;
          const rankKind = (k: string) => (k === 'hls' ? 0 : k === 'video' ? 1 : 2);
          return rankKind(a.streamKind) - rankKind(b.streamKind);
        });

        // Consolidate cleanly by available language: hide server names, drop iframe if direct HLS/MP4 exists, keep ALL languages + backupStreams
        const consolidated = consolidateAudioOptionsByLanguage(orderedForCodec);

        const result = {
          audioOptions: consolidated,
          ...(extraSubtitles.length > 0 ? { extraSubtitles } : {}),
          posterUrl: fallbackPoster,
          cloudflareOnly: false,
          resolvedSource: resolvedSourceTag,
        };
        this.saveCache(cacheKey, result);
        return result;
      }

      return {
        audioOptions: [],
        ...(extraSubtitles.length > 0 ? { extraSubtitles } : {}),
        posterUrl: fallbackPoster,
        cloudflareOnly: sawCloudflare && !sawCleanUpstreamCheck,
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
      extraSubtitles?: SubtitleTrack[];
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
          const isFreeApiAnimeTpl = /freeapi\.pro\/api\/anime/i.test(template);
          const testTitle = isFreeApiAnimeTpl
            ? 'Attack on Titan'
            : mediaType === 'movie'
              ? 'Dune: Part Two'
              : 'Breaking Bad';
          const testYear = isFreeApiAnimeTpl ? '2013' : mediaType === 'movie' ? '2024' : '2008';
          const testedUrl =
            buildCustomEmbedUrl({
              template,
              tmdbId: isFreeApiAnimeTpl ? 1429 : mediaType === 'movie' ? 693134 : 1396,
              imdbId: isFreeApiAnimeTpl
                ? 'tt2560140'
                : mediaType === 'movie'
                  ? 'tt15239678'
                  : 'tt0903747',
              title: testTitle,
              releaseYear: testYear,
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
                'Template sem variável ({tmdbId}, {id}, {imdbId} ou {title}). Esta fonte sempre carregará o mesmo título fixo.',
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
            title: testTitle,
            releaseYear: testYear,
            imdbId: isFreeApiAnimeTpl
              ? 'tt2560140'
              : mediaType === 'movie'
                ? 'tt15239678'
                : 'tt0903747',
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

  async discoverAndVerifySources(params: {
    customSources?: CustomVideoSource[];
    extraUrls?: string[];
    m3uUrl?: string;
  }): Promise<SourceDiscoveryResponse> {
    const started = Date.now();
    const baseMerged = mergeRecommendedCustomSources(
      sanitizeCustomVideoSources(params.customSources || [])
    );
    const workingList: CustomVideoSource[] = [...baseMerged.sources];
    let addedCount = baseMerged.addedCount;
    let pausedBrokenCount = baseMerged.pausedBrokenCount;

    const existingSignatures = new Set(
      workingList.map(
        (s) => `${(s.movieTemplate || '').toLowerCase()}|${(s.tvTemplate || '').toLowerCase()}`
      )
    );

    const rawExtras = Array.isArray(params.extraUrls) ? params.extraUrls : [];
    for (const rawLine of rawExtras.slice(0, 20)) {
      const cleanUrl = (rawLine || '').trim();
      if (!/^https?:\/\//i.test(cleanUrl)) continue;
      let parsedExtra: URL;
      try {
        parsedExtra = new URL(cleanUrl);
      } catch {
        continue;
      }
      if (!isSafePublicHost(parsedExtra.hostname) || isAdOrTrackerHost(parsedExtra.hostname)) {
        continue;
      }
      if (KNOWN_CLOUDFLARE_BLOCKED_SOURCE_RE.test(parsedExtra.hostname)) {
        continue;
      }

      const isTvLike = /\/(?:tv|serie|series)\//i.test(cleanUrl) || /\{season\}|\{episode\}/i.test(cleanUrl);
      const isMovieLike = /\/(?:movie|filme)\//i.test(cleanUrl);
      const movieTpl = isTvLike ? '' : cleanUrl;
      const tvTpl = isTvLike ? cleanUrl : isMovieLike ? cleanUrl.replace(/\/(?:movie|filme)\//i, '/tv/') : '';
      const sig = `${movieTpl.toLowerCase()}|${tvTpl.toLowerCase()}`;
      if (existingSignatures.has(sig)) continue;
      existingSignatures.add(sig);

      const hostSlug = parsedExtra.hostname.replace(/^www\./i, '').slice(0, 42);
      const looksDirect = /\.(?:m3u8|mp4|webm|m4v)(?:$|\?)/i.test(cleanUrl);
      workingList.push({
        id: `disc_${crypto.createHash('md5').update(cleanUrl).digest('hex').slice(0, 10)}`,
        name: `Fonte ${hostSlug}`,
        kind: looksDirect ? 'direct' : /api/i.test(cleanUrl) ? 'api' : 'embed',
        movieTemplate: movieTpl.slice(0, 500),
        tvTemplate: tvTpl.slice(0, 500),
        lang: /\bpt|brasil|dub|novela|fshd|playerflix|watchplay/i.test(cleanUrl) ? 'pt' : 'auto',
        priority: workingList.length + 1,
        active: true,
      });
      addedCount += 1;
    }

    // Also include curated bonus fallback providers if absent and clean
    const bonusProviders: Omit<CustomVideoSource, 'priority'>[] = [
      {
        id: 'disc_meowtv_multi',
        name: 'MeowTV Multi-Áudio (Auto)',
        kind: 'api',
        movieTemplate: 'https://meowtv.ru/movie/{tmdbId}',
        tvTemplate: 'https://meowtv.ru/tv/{tmdbId}/{season}/{episode}',
        lang: 'auto',
        active: true,
      },
      {
        id: 'disc_vidsrc_cc',
        name: 'VidSrc CC (EN)',
        kind: 'embed',
        movieTemplate: 'https://vidsrc.cc/v2/embed/movie/{tmdbId}',
        tvTemplate: 'https://vidsrc.cc/v2/embed/tv/{tmdbId}/{season}/{episode}',
        lang: 'en',
        active: true,
      },
    ];
    for (const bp of bonusProviders) {
      const sig = `${bp.movieTemplate.toLowerCase()}|${bp.tvTemplate.toLowerCase()}`;
      if (!existingSignatures.has(sig) && !workingList.some((w) => w.id === bp.id)) {
        existingSignatures.add(sig);
        workingList.push({ ...bp, priority: workingList.length + 1 });
        addedCount += 1;
      }
    }

    // Optional live .M3U / .M3U8 playlist scanning
    const discoveredM3uEntries: DiscoveredM3uEntry[] = [];
    const rawM3uUrl = (params.m3uUrl || '').trim();
    if (/^https?:\/\//i.test(rawM3uUrl)) {
      try {
        const parsedM3u = new URL(rawM3uUrl);
        if (isSafePublicHost(parsedM3u.hostname)) {
          const m3uController = new AbortController();
          const m3uTimer = setTimeout(() => m3uController.abort(), 8000);
          try {
            const m3uRes = await fetch(rawM3uUrl, {
              signal: m3uController.signal,
              headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: '*/*' },
            });
            if (m3uRes.ok) {
              const rawBytes = await this.readHeadBytes(m3uRes, 2 * 1024 * 1024);
              const rawText = new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
              const parsedEntries = parseM3uPlaylistText(rawText, 40);
              const verifiedSubset = await Promise.all(
                parsedEntries.slice(0, 8).map(async (entry) => {
                  const expectedKind = /\.(?:mp4|m4v|webm)(?:$|[?#])/i.test(entry.streamUrl)
                    ? 'video'
                    : 'hls';
                  const p = await this.probeDirectMediaUrl({
                    url: entry.streamUrl,
                    referer: `${parsedM3u.origin}/`,
                    origin: parsedM3u.origin,
                    expectedKind,
                    signal: m3uController.signal,
                  }).catch(() => ({ ok: false }));
                  return { ...entry, verified: Boolean(p.ok) };
                })
              );
              const verifiedByUrl = new Map(verifiedSubset.map((v) => [v.streamUrl, v.verified]));
              for (const entry of parsedEntries) {
                discoveredM3uEntries.push({
                  ...entry,
                  verified: verifiedByUrl.get(entry.streamUrl),
                });
              }
            }
          } finally {
            clearTimeout(m3uTimer);
          }
        }
      } catch {
        // Ignore broken M3U feed
      }
    }

    // Verify all candidates in real time and pause blocked/unavailable ones automatically
    const sanitizedCandidates = sanitizeCustomVideoSources(workingList);
    const testResults = await this.testCustomSources(sanitizedCandidates);
    const resultById = new Map(testResults.map((r) => [r.id, r]));

    let activeCount = 0;
    const finalizedSources = sanitizeCustomVideoSources(
      sanitizedCandidates.map((src, index) => {
        const res = resultById.get(src.id);
        let nextActive = src.active;
        if (res) {
          if (res.status === 'ok_direct') {
            nextActive = true;
          } else if (
            res.status === 'blocked_cloudflare' ||
            res.status === 'blocked_ads' ||
            res.status === 'missing_placeholders' ||
            res.status === 'unavailable'
          ) {
            if (src.active) pausedBrokenCount += 1;
            nextActive = false;
          }
        }
        if (nextActive) activeCount += 1;
        return {
          id: src.id,
          name: src.name,
          kind: src.kind,
          movieTemplate: src.movieTemplate,
          tvTemplate: src.tvTemplate,
          lang: src.lang,
          priority: index + 1,
          active: nextActive,
        };
      })
    );

    this.clearCache();

    return {
      sources: finalizedSources,
      testResults,
      discoveredM3uEntries,
      summary: {
        totalScanned: finalizedSources.length,
        activeCount,
        addedCount,
        pausedBrokenCount,
        m3uEntriesCount: discoveredM3uEntries.length,
        elapsedMs: Date.now() - started,
      },
    };
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
    tmdbId?: number | null;
    imdbId?: string | null;
    mediaType: MediaType;
    seasonNumber?: number;
    episodeNumber?: number;
    title?: string | null;
    ptTitle?: string | null;
    originalTitle?: string | null;
    releaseYear?: string | null;
  }): Promise<SubtitleTrack[]> {
    const cleanImdb = (params.imdbId || '').trim().toLowerCase();
    const hasImdb = /^tt\d{5,12}$/.test(cleanImdb);
    const validTmdb = typeof params.tmdbId === 'number' && params.tmdbId > 0 ? params.tmdbId : 0;
    const queryTitle = (params.originalTitle || params.title || params.ptTitle || '').trim();
    if (!hasImdb && !validTmdb && !queryTitle) {
      return [];
    }

    const season = params.mediaType === 'tv' ? params.seasonNumber ?? 1 : 0;
    const episode = params.mediaType === 'tv' ? params.episodeNumber ?? 1 : 0;
    const cacheKey = `${cleanImdb || 'tmdb'}:${validTmdb}:${params.mediaType}:${season}:${episode}:${queryTitle.slice(0, 24)}`;

    const cached = this.subtitleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.subtitles;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);

    try {
      const openSubEndpoint = hasImdb
        ? params.mediaType === 'tv'
          ? `https://opensubtitles-v3.strem.io/subtitles/series/${cleanImdb}:${season}:${episode}.json`
          : `https://opensubtitles-v3.strem.io/subtitles/movie/${cleanImdb}.json`
        : null;

      const vdrkEndpoint = validTmdb
        ? params.mediaType === 'tv'
          ? `https://sub.vdrk.site/v2/tv/${validTmdb}/${season}/${episode}`
          : `https://sub.vdrk.site/v2/movie/${validTmdb}`
        : null;

      const meowSubsEndpoint = validTmdb
        ? params.mediaType === 'tv'
          ? `https://api.meowtv.ru/subs/tv/${validTmdb}/${season}/${episode}`
          : `https://api.meowtv.ru/subs/movie/${validTmdb}`
        : null;

      const imdbNumeric = hasImdb ? cleanImdb.replace(/^tt/i, '').padStart(7, '0') : '';
      const restOpenSubImdbEndpoint = hasImdb
        ? params.mediaType === 'tv'
          ? `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbNumeric}/season-${season}`
          : `https://rest.opensubtitles.org/search/imdbid-${imdbNumeric}`
        : null;
      const restOpenSubSeriesEndpoint =
        hasImdb && params.mediaType === 'tv'
          ? `https://rest.opensubtitles.org/search/imdbid-${imdbNumeric}`
          : null;

      // Never append /sublanguageid-... to /search/query-... (OpenSubtitles REST returns HTTP 400 on combined filter)
      const restOpenSubQueryEndpoint = queryTitle
        ? `https://rest.opensubtitles.org/search/query-${encodeURIComponent(
            queryTitle.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
          )}`
        : null;

      const restHeaders = {
        'User-Agent': 'TemporaryUserAgent',
        'X-User-Agent': 'TemporaryUserAgent',
        Accept: 'application/json',
      };

      const [openRes, vdrkRes, meowSubsRes, restImdbRes, restSeriesRes, restQueryRes] = await Promise.all([
        openSubEndpoint
          ? fetch(openSubEndpoint, {
              signal: controller.signal,
              headers: { 'User-Agent': DESKTOP_CHROME_UA },
            }).catch(() => null)
          : Promise.resolve(null),
        vdrkEndpoint
          ? fetch(vdrkEndpoint, {
              signal: controller.signal,
              headers: { 'User-Agent': DESKTOP_CHROME_UA, Accept: 'application/json' },
            }).catch(() => null)
          : Promise.resolve(null),
        meowSubsEndpoint
          ? fetch(meowSubsEndpoint, {
              signal: controller.signal,
              headers: {
                'User-Agent': DESKTOP_CHROME_UA,
                Origin: 'https://meowtv.ru',
                Referer: 'https://meowtv.ru/',
                Accept: 'application/json',
              },
            }).catch(() => null)
          : Promise.resolve(null),
        restOpenSubImdbEndpoint
          ? fetch(restOpenSubImdbEndpoint, {
              signal: controller.signal,
              headers: restHeaders,
            }).catch(() => null)
          : Promise.resolve(null),
        restOpenSubSeriesEndpoint
          ? fetch(restOpenSubSeriesEndpoint, {
              signal: controller.signal,
              headers: restHeaders,
            }).catch(() => null)
          : Promise.resolve(null),
        restOpenSubQueryEndpoint
          ? fetch(restOpenSubQueryEndpoint, {
              signal: controller.signal,
              headers: restHeaders,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const combinedRawSubs: OpenSubtitlesEntry[] = [];

      for (const extraRes of [vdrkRes, meowSubsRes]) {
        if (!extraRes?.ok) continue;
        const extraJson = (await extraRes.json().catch(() => null)) as Array<{
          label?: string;
          file?: string;
        }> | null;
        if (Array.isArray(extraJson)) {
          for (const item of extraJson) {
            const url = (item?.file || '').trim();
            const rawLbl = (item?.label || '').trim();
            if (!url || !rawLbl) continue;
            const mappedLang = this.mapCaptionLanguageCode(rawLbl);
            if (mappedLang && mappedLang !== 'und') {
              combinedRawSubs.push({ url, lang: mappedLang });
            }
          }
        }
      }

      if (openRes?.ok) {
        const json = (await openRes.json().catch(() => null)) as {
          subtitles?: OpenSubtitlesEntry[];
        } | null;
        if (Array.isArray(json?.subtitles)) {
          combinedRawSubs.push(...json.subtitles);
        }
      }

      // Unauthenticated rest.opensubtitles.org fallback (returns .gz SRT/ASS/VTT files on dl.opensubtitles.org)
      const parseRestOpenSubs = async (res: globalThis.Response | null, filterEpisodeStrict: boolean): Promise<number> => {
        if (!res?.ok) return 0;
        const rows = (await res.json().catch(() => null)) as Array<{
          SubDownloadLink?: string;
          ISO639?: string;
          SubLanguageID?: string;
          LanguageName?: string;
          SubEncoding?: string;
          SubFormat?: string;
          SubDownloadsCnt?: string | number;
          SeriesSeason?: string | number;
          SeriesEpisode?: string | number;
          MovieKind?: string;
          MovieName?: string;
        }> | null;
        if (!Array.isArray(rows)) return 0;

        const filtered = rows
          .filter((row) => {
            const fmt = (row?.SubFormat || '').toLowerCase();
            if (fmt && !['srt', 'vtt', 'ass', 'ssa', 'txt'].includes(fmt)) return false;
            if (params.mediaType === 'tv' && filterEpisodeStrict) {
              const rs = Number(row.SeriesSeason || 0);
              const re = Number(row.SeriesEpisode || 0);
              if (rs > 0 && rs !== season) return false;
              if (re > 0 && re !== episode) return false;
            }
            return true;
          })
          .sort((a, b) => Number(b.SubDownloadsCnt || 0) - Number(a.SubDownloadsCnt || 0));

        let added = 0;
        for (const row of filtered) {
          let dlUrl = (row.SubDownloadLink || '').trim().replace(/^http:\/\//i, 'https://');
          if (!dlUrl || !isAllowedSubtitleHost(dlUrl)) continue;
          const mappedLang = this.mapCaptionLanguageCode(
            row.SubLanguageID || row.LanguageName || row.ISO639 || ''
          );
          if (mappedLang && mappedLang !== 'und') {
            combinedRawSubs.push({
              url: dlUrl,
              lang: mappedLang,
              SubEncoding: row.SubEncoding,
            });
            added += 1;
          }
        }
        return added;
      };

      const restEpAdded = await parseRestOpenSubs(restImdbRes, false);
      if (restEpAdded === 0 && restSeriesRes) {
        await parseRestOpenSubs(restSeriesRes, true);
      }
      if (combinedRawSubs.length === 0) {
        await parseRestOpenSubs(restQueryRes, true);
      }

      const priorityLangs = [
        'pob', 'por', 'eng', 'spa', 'fre', 'ger', 'ita', 'jpn', 'kor',
        'rus', 'ara', 'chi', 'dut', 'pol', 'tur', 'hin', 'ind', 'vie',
        'tha', 'heb', 'swe', 'nor', 'dan', 'fin', 'ell', 'ces', 'hun', 'rum', 'ukr',
      ];

      const hostReliabilityRank = (rawUrl?: string): number => {
        const u = (rawUrl || '').toLowerCase();
        if (
          u.includes('cache.vdrk.site') ||
          u.includes('cacdn.hakunaymatata.com') ||
          u.includes('qqqcdn.cloud') ||
          u.includes('dl.opensubtitles.org') ||
          u.includes('mysubsplay.com')
        ) {
          return 0;
        }
        if (u.includes('rezesubs.com')) return 1;
        if (u.includes('strem.io')) return 2;
        return 3;
      };

      const seenSubUrls = new Set<string>();
      const uniqueSubs = combinedRawSubs.filter((item) => {
        const u = (item.url || '').trim();
        if (!u || !isAllowedSubtitleHost(u) || seenSubUrls.has(u)) return false;
        const lang = this.mapCaptionLanguageCode(item.lang);
        if (lang === 'und' || !priorityLangs.includes(lang)) return false;
        seenSubUrls.add(u);
        return true;
      });

      const ordered = [...uniqueSubs].sort((a, b) => {
        const ac = this.mapCaptionLanguageCode(a.lang);
        const bc = this.mapCaptionLanguageCode(b.lang);
        const ai = priorityLangs.indexOf(ac);
        const bi = priorityLangs.indexOf(bc);
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return hostReliabilityRank(a.url) - hostReliabilityRank(b.url);
      });

      // Collect up to 3 candidates per language first, then verify top 16 URLs with fast HEAD so 404 Stremio mirrors don't poison tracks
      const preCheckBucket: Array<{ item: OpenSubtitlesEntry; lang: string }> = [];
      const preCounts = new Map<string, number>();
      for (const item of ordered) {
        const lang = this.mapCaptionLanguageCode(item.lang);
        const cnt = preCounts.get(lang) ?? 0;
        if (cnt >= 3) continue;
        preCounts.set(lang, cnt + 1);
        preCheckBucket.push({ item, lang });
        if (preCheckBucket.length >= 42) break;
      }

      const healthMap = new Map<string, boolean>();
      await Promise.all(
        preCheckBucket.slice(0, 16).map(async ({ item }) => {
          const u = item.url!.trim();
          const hAc = new AbortController();
          const hTimer = setTimeout(() => hAc.abort(), 1600);
          try {
            const headHeaders: Record<string, string> = { 'User-Agent': DESKTOP_CHROME_UA };
            if (/rezesubs\.com/i.test(u)) {
              headHeaders.Referer = 'https://meowtv.ru/';
              headHeaders.Origin = 'https://meowtv.ru';
            }
            const hr = await fetch(u, {
              method: 'HEAD',
              signal: hAc.signal,
              headers: headHeaders,
            });
            healthMap.set(u, hr.ok);
          } catch {
            // Do not hard-reject on timeout; only drop explicit 404/410/5xx
            healthMap.set(u, true);
          } finally {
            clearTimeout(hTimer);
          }
        })
      );

      const perLangCount = new Map<string, number>();
      const selected: SubtitleTrack[] = [];
      for (const { item, lang } of preCheckBucket) {
        const u = item.url!.trim();
        if (healthMap.get(u) === false) continue;
        const count = perLangCount.get(lang) ?? 0;
        if (count >= 2) continue;
        perLangCount.set(lang, count + 1);

        const subId = this.registerSubtitleEntry({
          url: u,
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

        if (selected.length >= 28) break;
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
      const headers: Record<string, string> = {};
      if (session.sendUserAgent) {
        headers['User-Agent'] = session.userAgent;
      }
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

      // Header negotiation completed; allow long-lived range streaming for large MP4 files without aborting mid-playback
      clearTimeout(timer);

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

      const sendRewrittenPlaylist = (rawManifest: string) => {
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
      };

      const explicitPlaylistHeader =
        upstreamContentType.includes('mpegurl') ||
        /\.m3u8(?:$|\?)/i.test(effectiveUrl);

      if (explicitPlaylistHeader) {
        const rawManifest = await upstreamRes.text();
        sendRewrittenPlaylist(rawManifest);
        return;
      }

      const shouldSniffPlaylist =
        session.streamKind !== 'video' &&
        !rangeHeader &&
        !upstreamContentType.startsWith('video/') &&
        !upstreamContentType.startsWith('audio/') &&
        Boolean(upstreamRes.body);

      if (shouldSniffPlaylist && upstreamRes.body) {
        const reader = upstreamRes.body.getReader();
        const firstChunk = await reader.read();
        const firstBytes = firstChunk.value || new Uint8Array(0);
        const firstSample = new TextDecoder('utf-8', { fatal: false }).decode(
          firstBytes.subarray(0, 64)
        );

        if (/^\s*\uFEFF?#EXTM3U/i.test(firstSample)) {
          const chunks: Uint8Array[] = [firstBytes];
          let totalBytes = firstBytes.length;
          const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
          if (!firstChunk.done) {
            while (totalBytes < MAX_PLAYLIST_BYTES) {
              const next = await reader.read();
              if (next.done || !next.value) break;
              chunks.push(next.value);
              totalBytes += next.value.length;
            }
          }
          await reader.cancel().catch(() => {});
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const rawManifest = new TextDecoder('utf-8', { fatal: false }).decode(merged);
          sendRewrittenPlaylist(rawManifest);
          return;
        }

        let resolvedMime = resolveSegmentMimeType(effectiveUrl, upstreamContentType);
        res.setHeader('Content-Type', resolvedMime);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const acceptRanges = upstreamRes.headers.get('accept-ranges');
        const contentRange = upstreamRes.headers.get('content-range');
        const contentLength = upstreamRes.headers.get('content-length');
        if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
        if (contentRange) res.setHeader('Content-Range', contentRange);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.status(upstreamRes.status);

        const nodeStream = Readable.from(
          (async function* () {
            if (firstBytes.length > 0) yield Buffer.from(firstBytes);
            if (!firstChunk.done) {
              try {
                while (true) {
                  const next = await reader.read();
                  if (next.done) break;
                  if (next.value && next.value.length > 0) {
                    yield Buffer.from(next.value);
                  }
                }
              } finally {
                await reader.cancel().catch(() => {});
              }
            }
          })()
        );
        activeStream = nodeStream;
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(502).end();
          else res.end();
        });
        nodeStream.pipe(res);
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
      const subHeaders: Record<string, string> = { 'User-Agent': DESKTOP_CHROME_UA };
      if (/rezesubs\.com/i.test(entry.url)) {
        subHeaders.Referer = 'https://meowtv.ru/';
        subHeaders.Origin = 'https://meowtv.ru';
      }
      const upstream = await fetch(entry.url, {
        signal: controller.signal,
        headers: subHeaders,
      });
      if (!upstream.ok) {
        res.status(404).send('WEBVTT\n\n');
        return;
      }
      const rawBuf = Buffer.from(await upstream.arrayBuffer());
      const decompressedBuf =
        rawBuf.length >= 2 && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b
          ? gunzipSync(rawBuf)
          : rawBuf;
      const rawText = decodeSubtitleBuffer(decompressedBuf);
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
