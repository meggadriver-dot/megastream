import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import {
  buildOrderedSourceCascade,
  DEFAULT_PLAYER_CONFIG,
} from '../../shared/playerUrl.ts';
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
  isAdOrTrackerHost,
  isAllowedSubtitleHost,
  isCloudflareChallengeHtml,
  isSafePublicHost,
  resolveSegmentMimeType,
} from '../../shared/subtitleUtils.ts';
import type {
  MediaType,
  PlayerAudioOption,
  PlayerConfig,
  SubtitleTrack,
} from '../../shared/types.ts';

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
  streamKind: 'hls' | 'video';
  audioLabel: string;
  posterUrl: string | null;
  referer: string;
  origin: string;
  sendReferer?: boolean;
  useDirectClientUrl?: boolean;
  sourceKind: 'watchplay' | 'embedplayer' | 'custom';
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

    const id = crypto.randomBytes(12).toString('hex');

    if (this.hlsSessions.size > 400) {
      const oldestKey = this.hlsSessions.keys().next().value;
      if (oldestKey) this.hlsSessions.delete(oldestKey);
    }

    const primaryHost = parsed.hostname.toLowerCase();
    this.hlsSessions.set(id, {
      id,
      upstreamUrl: params.upstreamUrl,
      allowedHost: primaryHost,
      allowedHosts: new Set([primaryHost]),
      referer: params.referer,
      origin: params.origin,
      sendReferer: params.sendReferer !== false,
      streamKind: params.streamKind ?? 'hls',
      userAgent: DESKTOP_CHROME_UA,
      createdAt: Date.now(),
    });
    return id;
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
    const id = crypto
      .createHash('sha1')
      .update(entry.url)
      .digest('hex')
      .slice(0, 16);

    if (!this.subtitleRegistry.has(id)) {
      if (this.subtitleRegistry.size > 800) {
        const oldestKey = this.subtitleRegistry.keys().next().value;
        if (oldestKey) this.subtitleRegistry.delete(oldestKey);
      }
      this.subtitleRegistry.set(id, {
        id,
        url: entry.url,
        lang: entry.lang,
        encoding: entry.encoding,
        createdAt: Date.now(),
      });
    }
    return id;
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
        // Retry without Referer/Origin for strict CDNs (GCS, S3, R2, etc.)
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
        if (/#EXTM3U/i.test(htmlSample)) {
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

      // Octet-stream or binary range response on an explicit video extension
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
    embedUrl: string
  ): Promise<ExtractedStreamCandidate | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
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
        const fallback = extractPlayableStreamFromBody(html, finalUrl);
        if (!fallback) return null;
        rawStreamUrl = fallback.streamUrl;
        fallbackPoster = fallback.posterUrl;
        fallbackKind = fallback.streamKind;
      }

      try {
        const parsedStream = new URL(rawStreamUrl);
        if (!isSafePublicHost(parsedStream.hostname) || isAdOrTrackerHost(parsedStream.hostname)) {
          return null;
        }
      } catch {
        return null;
      }

      const audioMatch = html.match(/MyPlayerAudio\s*=\s*["']([^"']+)["']/);
      const posterMatch = html.match(/data-poster=["']([^"']+)["']/);
      const isMp4 = fallbackKind === 'video' || /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(rawStreamUrl);

      return {
        streamUrl: rawStreamUrl,
        streamKind: isMp4 ? 'video' : 'hls',
        audioLabel: audioMatch?.[1]?.trim() || 'Dublado',
        posterUrl: posterMatch?.[1]?.trim() || fallbackPoster,
        referer: finalUrl,
        origin: finalOrigin,
        sendReferer: true,
        sourceKind: 'watchplay',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async extractEmbedPlayerStream(
    embedUrl: string,
    langHint?: string
  ): Promise<ExtractedStreamCandidate | null> {
    const parsed = extractEmbedPlayerHash(embedUrl);
    if (!parsed) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
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

      try {
        const parsedStream = new URL(rawUrl);
        if (!isSafePublicHost(parsedStream.hostname) || isAdOrTrackerHost(parsedStream.hostname)) {
          return null;
        }
      } catch {
        return null;
      }

      const isMp4 = /\.mp4(?:$|[?#])/i.test(rawUrl) && payload.hls !== true;
      const isPt = (langHint || '').toLowerCase().startsWith('pt');
      return {
        streamUrl: rawUrl,
        streamKind: isMp4 ? 'video' : 'hls',
        audioLabel: isPt ? 'Dublado' : 'Legendado',
        posterUrl: payload.videoImage || null,
        referer: `${parsed.origin}/`,
        origin: parsed.origin,
        sourceKind: 'embedplayer',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async extractFromConfiguredUrl(
    targetUrl: string,
    opts: {
      langHint?: string;
      depth?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<{
    candidate: ExtractedStreamCandidate | null;
    cloudflareBlocked: boolean;
    directBrowserFallback?: ExtractedStreamCandidate;
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

    if (extractEmbedPlayerHash(targetUrl)) {
      const candidate = await this.extractEmbedPlayerStream(targetUrl, opts.langHint);
      return { candidate, cloudflareBlocked: false };
    }
    if (/watchplay\.shop/i.test(parsed.hostname)) {
      const candidate = await this.extractWatchPlayStream(targetUrl);
      return { candidate, cloudflareBlocked: false };
    }

    const defaultLabel = opts.langHint === 'en' ? 'Original' : 'Dublado (PT-BR)';

    // Fast direct-stream path (.m3u8 / .mp4 / .webm / .mov / .ogg / .m4v)
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
        // Server datacenter IP may be blocked (403/timeout) while the user's browser can play direct URLs
        return {
          candidate: null,
          cloudflareBlocked: false,
          directBrowserFallback: {
            streamUrl: targetUrl,
            streamKind: looksDirectVideo ? 'video' : 'hls',
            audioLabel: defaultLabel,
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
          posterUrl: null,
          referer: probe.sendReferer ? `${parsed.origin}/` : '',
          origin: probe.sendReferer ? parsed.origin : '',
          sendReferer: probe.sendReferer,
          sourceKind: 'custom',
        },
      };
    }

    // Extensionless direct stream OR generic HTML / JSON API source extraction
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

      if (res.status === 401 || res.status === 403) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        if (isCloudflareChallengeHtml(errSample, res.status)) {
          return { candidate: null, cloudflareBlocked: true };
        }
        sendReferer = false;
        res = await fetchPage(false);
      }

      const finalUrl = res.url || targetUrl;
      const finalOrigin = new URL(finalUrl).origin;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const disp = res.headers.get('content-disposition');

      if (!res.ok && res.status !== 206) {
        const errBytes = await this.readHeadBytes(res, 16_384);
        const errSample = new TextDecoder('utf-8', { fatal: false }).decode(errBytes);
        return {
          candidate: null,
          cloudflareBlocked: isCloudflareChallengeHtml(errSample, res.status),
        };
      }

      // Sniff head bytes first so multi-GB octet-stream MP4s or redirects are detected without buffering whole files
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
            posterUrl: null,
            referer: sendReferer ? `${finalOrigin}/` : '',
            origin: sendReferer ? finalOrigin : '',
            sendReferer,
            sourceKind: 'custom',
          },
        };
      }

      // If response is an unrecognized binary stream (octet-stream) without HTML tags, skip text extraction
      if (ct.includes('octet-stream')) {
        return { candidate: null, cloudflareBlocked: false };
      }

      const body = new TextDecoder('utf-8', { fatal: false }).decode(headBytes);
      if (isCloudflareChallengeHtml(body, res.status)) {
        return { candidate: null, cloudflareBlocked: true };
      }

      // 1. Direct JSON/HTML playable stream extraction
      const extracted = extractPlayableStreamFromBody(body, finalUrl);
      if (extracted) {
        const probe = await this.probeDirectMediaUrl({
          url: extracted.streamUrl,
          referer: finalUrl,
          origin: finalOrigin,
          expectedKind: extracted.streamKind,
          signal: opts.signal,
        });
        if (probe.ok) {
          return {
            cloudflareBlocked: false,
            candidate: {
              streamUrl: probe.finalUrl || extracted.streamUrl,
              streamKind: probe.kind,
              audioLabel: defaultLabel,
              posterUrl: extracted.posterUrl,
              referer: probe.sendReferer ? finalUrl : '',
              origin: probe.sendReferer ? finalOrigin : '',
              sendReferer: probe.sendReferer,
              sourceKind: 'custom',
            },
          };
        }
        if (!probe.cloudflareBlocked) {
          return {
            candidate: null,
            cloudflareBlocked: false,
            directBrowserFallback: {
              streamUrl: extracted.streamUrl,
              streamKind: extracted.streamKind,
              audioLabel: defaultLabel,
              posterUrl: extracted.posterUrl,
              referer: '',
              origin: '',
              sendReferer: false,
              useDirectClientUrl: true,
              sourceKind: 'custom',
            },
          };
        }
      }

      // 2. Follow 1 level of safe nested <iframe src> (skipping known ad/CF-heavy wrappers)
      if (depth < 1) {
        const nestedUrls = extractNestedEmbedUrls(body, finalUrl).filter(
          (u) => !/(?:superflixapi|embedplayabyss|playerflix\.ink)/i.test(u)
        );
        for (const nestedUrl of nestedUrls.slice(0, 2)) {
          const nested = await this.extractFromConfiguredUrl(nestedUrl, {
            langHint: opts.langHint,
            depth: depth + 1,
            signal: opts.signal,
          });
          if (nested.candidate || nested.directBrowserFallback) {
            return nested;
          }
        }
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
    opt: PlayerFlixAjaxOption
  ): Promise<ExtractedStreamCandidate | null> {
    if (!opt.embed) return null;
    if (opt.id === 'embedplayer' || /embedplayer\d*\.xyz/i.test(opt.embed)) {
      return this.extractEmbedPlayerStream(opt.embed, opt.lang);
    }
    return this.extractWatchPlayStream(opt.embed);
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

  private async resolveBuiltInWatchaPipeline(params: {
    tmdbId: number;
    imdbId: string | null;
    mediaType: MediaType;
    season: number | null;
    episode: number | null;
    preferredLang: 'pt' | 'en';
    signal: AbortSignal;
  }): Promise<{ audioOptions: PlayerAudioOption[]; posterUrl: string | null; cloudflareOnly: boolean }> {
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
      candidateOptions.slice(0, 6).map(async (opt, idx) => {
        const extracted = await this.extractCandidateOption(opt);
        if (!extracted) return null;
        const langCode = (opt.lang || 'pt-br').toLowerCase();
        return { idx, langCode, extracted };
      })
    );

    const byLang = new Map<
      string,
      { option: PlayerAudioOption; posterUrl: string | null; sourceKind: 'watchplay' | 'embedplayer' | 'custom' }
    >();

    for (const item of extractedResults) {
      if (!item) continue;
      const { idx, langCode, extracted } = item;
      const langGroup = langCode.startsWith('pt')
        ? 'pt'
        : langCode.startsWith('en')
          ? 'en'
          : langCode;

      const existing = byLang.get(langGroup);
      if (existing && (existing.sourceKind === 'watchplay' || extracted.sourceKind !== 'watchplay')) {
        continue;
      }

      const sessionId = this.registerHlsSession({
        upstreamUrl: extracted.streamUrl,
        referer: extracted.referer,
        origin: extracted.origin,
        sendReferer: extracted.sendReferer,
        streamKind: extracted.streamKind,
      });
      const friendlyAudio =
        extracted.audioLabel === 'Dublado' || langCode.startsWith('pt')
          ? 'Dublado (PT-BR)'
          : extracted.audioLabel === 'Legendado' || langCode.startsWith('en')
            ? 'Legendado (Original)'
            : extracted.audioLabel;

      byLang.set(langGroup, {
        sourceKind: extracted.sourceKind,
        posterUrl: extracted.posterUrl,
        option: {
          id: `audio_${idx}_${langCode}`,
          label: friendlyAudio,
          lang: langCode,
          streamUrl: this.buildProxyPlaybackUrl(sessionId, extracted.streamKind),
          streamKind: extracted.streamKind,
        },
      });
    }

    const audioOptions = Array.from(byLang.values()).map((v) => v.option);
    if (params.preferredLang === 'en') {
      audioOptions.sort((a, b) => (a.lang.startsWith('en') ? 0 : 1) - (b.lang.startsWith('en') ? 0 : 1));
    } else {
      audioOptions.sort((a, b) => (a.lang.startsWith('pt') ? 0 : 1) - (b.lang.startsWith('pt') ? 0 : 1));
    }

    const posterUrl =
      Array.from(byLang.values()).find((item) => item.posterUrl)?.posterUrl || bgImage;

    if (audioOptions.length > 0) {
      cloudflareOnly = false;
    }

    return { audioOptions, posterUrl, cloudflareOnly };
  }

  private buildCandidateOption(
    id: string,
    c: ExtractedStreamCandidate,
    preferredLang: 'pt' | 'en'
  ): PlayerAudioOption {
    const lang = preferredLang === 'en' ? 'en-us' : 'pt-br';
    if (c.useDirectClientUrl) {
      return {
        id,
        label: c.audioLabel,
        lang,
        streamUrl: c.streamUrl,
        streamKind: c.streamKind,
      };
    }
    const sessionId = this.registerHlsSession({
      upstreamUrl: c.streamUrl,
      referer: c.referer,
      origin: c.origin,
      sendReferer: c.sendReferer,
      streamKind: c.streamKind,
    });
    return {
      id,
      label: c.audioLabel,
      lang,
      streamUrl: this.buildProxyPlaybackUrl(sessionId, c.streamKind),
      streamKind: c.streamKind,
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
          preferImdbForMovies: cfg.preferImdbForMovies,
          customStreamUrl: params.customStreamUrl || '',
        })
      )
      .digest('hex')
      .slice(0, 10);

    const cacheKey = `${params.mediaType}:${params.tmdbId}:${season ?? 0}:${episode ?? 0}:${configFingerprint}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.audioOptions.length > 0) {
      const sortedCached = [...cached.audioOptions];
      if (preferredLang === 'en') {
        sortedCached.sort((a, b) => (a.lang.startsWith('en') ? 0 : 1) - (b.lang.startsWith('en') ? 0 : 1));
      } else {
        sortedCached.sort((a, b) => (a.lang.startsWith('pt') ? 0 : 1) - (b.lang.startsWith('pt') ? 0 : 1));
      }
      return {
        audioOptions: sortedCached,
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
      let pendingDirectFallback: {
        option: PlayerAudioOption;
        posterUrl: string | null;
        source: string;
      } | null = null;

      // 1. Per-title customStreamUrl from Catalog Override (always extracted & proxied into WatchaPlayer)
      if (params.customStreamUrl) {
        const customRes = await this.extractFromConfiguredUrl(params.customStreamUrl, {
          langHint: preferredLang,
          signal: controller.signal,
        });
        if (customRes.cloudflareBlocked) sawCloudflare = true;
        if (customRes.candidate) {
          const opt = this.buildCandidateOption(
            `custom_item_${preferredLang}`,
            customRes.candidate,
            preferredLang
          );
          const result = {
            audioOptions: [opt],
            posterUrl: customRes.candidate.posterUrl,
            cloudflareOnly: false,
            resolvedSource: 'custom_catalog_item',
          };
          this.saveCache(cacheKey, result);
          return result;
        }
        if (customRes.directBrowserFallback) {
          pendingDirectFallback = {
            option: this.buildCandidateOption(
              `custom_item_${preferredLang}`,
              customRes.directBrowserFallback,
              preferredLang
            ),
            posterUrl: customRes.directBrowserFallback.posterUrl,
            source: 'custom_catalog_item_direct',
          };
          if (customRes.directBrowserFallback.posterUrl) {
            fallbackPoster = customRes.directBrowserFallback.posterUrl;
          }
        }
      }

      // 2. Ordered multi-source cascade across ALL configured & clean native WatchaPlayer sources
      const cascade = buildOrderedSourceCascade(cfg, {
        tmdbId: params.tmdbId,
        imdbId: resolvedImdb,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber,
      });

      for (const stage of cascade) {
        if (controller.signal.aborted) break;

        if (stage.sourceId === 'native_watcha') {
          const nativeRes = await this.resolveBuiltInWatchaPipeline({
            tmdbId: params.tmdbId,
            imdbId: resolvedImdb,
            mediaType: params.mediaType,
            season,
            episode,
            preferredLang,
            signal: controller.signal,
          });
          if (nativeRes.posterUrl && !fallbackPoster) fallbackPoster = nativeRes.posterUrl;
          if (nativeRes.cloudflareOnly) sawCloudflare = true;
          if (nativeRes.audioOptions.length > 0) {
            const audioOptions = pendingDirectFallback
              ? [pendingDirectFallback.option, ...nativeRes.audioOptions]
              : nativeRes.audioOptions;
            const result = {
              audioOptions,
              posterUrl: nativeRes.posterUrl || fallbackPoster,
              cloudflareOnly: false,
              resolvedSource: pendingDirectFallback ? pendingDirectFallback.source : stage.sourceId,
            };
            this.saveCache(cacheKey, result);
            return result;
          }
          continue;
        }

        if (!stage.url) continue;

        // Skip redundant HTTP fetch on known-CF/wrapper defaults UNLESS custom-configured or explicitly prioritized first
        const isDefaultWrapperOnly =
          !stage.isCustomConfigured &&
          (stage.sourceId === 'myembed' || stage.sourceId === 'watchaflix' || stage.sourceId === 'megaembed');

        if (isDefaultWrapperOnly && stage.sourceId !== cfg.sourceMode) {
          continue;
        }

        const extractedRes = await this.extractFromConfiguredUrl(stage.url, {
          langHint: preferredLang,
          signal: controller.signal,
        });
        if (extractedRes.cloudflareBlocked) sawCloudflare = true;
        if (extractedRes.candidate) {
          const c = extractedRes.candidate;
          const opt = this.buildCandidateOption(
            `${stage.sourceId}_${preferredLang}`,
            c,
            preferredLang
          );
          const audioOptions = pendingDirectFallback ? [pendingDirectFallback.option, opt] : [opt];
          const result = {
            audioOptions,
            posterUrl: c.posterUrl || fallbackPoster,
            cloudflareOnly: false,
            resolvedSource: pendingDirectFallback ? pendingDirectFallback.source : stage.sourceId,
          };
          this.saveCache(cacheKey, result);
          return result;
        }
        if (extractedRes.directBrowserFallback && !pendingDirectFallback) {
          pendingDirectFallback = {
            option: this.buildCandidateOption(
              `${stage.sourceId}_${preferredLang}`,
              extractedRes.directBrowserFallback,
              preferredLang
            ),
            posterUrl: extractedRes.directBrowserFallback.posterUrl,
            source: `${stage.sourceId}_direct`,
          };
        }
      }

      if (pendingDirectFallback) {
        const result = {
          audioOptions: [pendingDirectFallback.option],
          posterUrl: pendingDirectFallback.posterUrl || fallbackPoster,
          cloudflareOnly: false,
          resolvedSource: pendingDirectFallback.source,
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
    const session = this.hlsSessions.get(token);
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
    req: Request,
    res: Response
  ): Promise<void> {
    const session = this.hlsSessions.get(token);
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
    const isAllowed =
      (parsedTarget.protocol === 'https:' || parsedTarget.protocol === 'http:') &&
      isSafePublicHost(targetHost) &&
      (session.allowedHosts.has(targetHost) ||
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
          `/api/player/hls/${session.id}/seg`
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
    const entry = this.subtitleRegistry.get(subId);
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
