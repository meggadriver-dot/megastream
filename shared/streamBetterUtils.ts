import type { ChannelCategory, MediaType } from './types.ts';

export const STREAMBETTER_BASE_URL = 'https://streambetter.xyz';

export interface ParsedStreamBetterSource {
  kind: string;
  url: string;
  format: 'hls' | 'mp4' | 'dash' | 'iframe';
  headers: Record<string, string>;
  referer: string;
  origin: string;
  userAgent?: string;
  langCode: string;
  languageLabel: string;
  label: string;
  expiresAt: string | null;
  requiresProxyHeaders: boolean;
  subtitleUrl: string | null;
  subtitleLang: string | null;
  subtitleLabel: string | null;
  qualities: Array<{ quality: string; url: string }>;
}

export interface StreamBetterChannelRaw {
  id?: string | number;
  name?: string;
  image?: string;
  category?: string;
  category_names?: string[];
  isCustom?: boolean;
  url?: string;
}

export interface StreamBetterGameRaw {
  id?: string | number;
  title?: string;
  sport?: string;
  data?: {
    league?: string;
    timer?: { start?: string; end?: string };
    teams?: {
      home?: { name?: string; image?: string };
      away?: { name?: string; image?: string };
    };
  };
  players?: string[];
}

export interface StreamBetterEventRaw {
  id?: string | number;
  title?: string;
  name?: string;
  category?: string;
  sport?: string;
  image?: string;
  url?: string;
  players?: string[];
  start_time?: string;
  startAt?: string;
}

export function isStreamBetterHost(hostname?: string | null): boolean {
  const clean = (hostname || '').trim().toLowerCase().replace(/\.$/, '');
  return clean === 'streambetter.xyz' || clean.endsWith('.streambetter.xyz');
}

export function slugifyStreamBetterParam(label?: string | null): string {
  return (label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildStreamBetterCanonicalUrl(params: {
  mediaType: MediaType;
  tmdbId: number;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  useMirrorPrefix?: boolean;
}): string {
  const safeId = Math.max(1, Math.round(params.tmdbId));
  if (params.mediaType === 'tv') {
    const s = Math.max(1, Math.round(params.seasonNumber || 1));
    const e = Math.max(1, Math.round(params.episodeNumber || 1));
    const prefix = params.useMirrorPrefix ? 's' : 'serie';
    return `${STREAMBETTER_BASE_URL}/${prefix}/${safeId}/${s}/${e}`;
  }
  const prefix = params.useMirrorPrefix ? 'v' : 'filme';
  return `${STREAMBETTER_BASE_URL}/${prefix}/${safeId}`;
}

export function buildStreamBetterV1StreamUrl(params: {
  tmdbId?: number | null;
  mediaType?: MediaType;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  channel?: string | null;
  game?: string | null;
  event?: string | null;
  fonte?: string | null;
}): string {
  const url = new URL(`${STREAMBETTER_BASE_URL}/api/v1/stream`);
  if (params.channel) {
    url.searchParams.set('channel', params.channel.trim());
  } else if (params.game) {
    url.searchParams.set('game', params.game.trim());
  } else if (params.event) {
    url.searchParams.set('event', params.event.trim());
  } else if (params.tmdbId && params.tmdbId > 0) {
    url.searchParams.set('tmdb_id', String(Math.round(params.tmdbId)));
    const type = params.mediaType === 'tv' ? 'tv' : 'movie';
    url.searchParams.set('type', type);
    if (type === 'tv') {
      url.searchParams.set('season', String(Math.max(1, Math.round(params.seasonNumber || 1))));
      url.searchParams.set('episode', String(Math.max(1, Math.round(params.episodeNumber || 1))));
    }
  }
  if (params.fonte?.trim()) {
    url.searchParams.set('fonte', slugifyStreamBetterParam(params.fonte));
  }
  return url.toString();
}

export function buildStreamBetter451Candidates(
  rawUrl: string,
  legalBlocks: string[] = []
): string[] {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return [];

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [trimmed];
  }

  const normalizedBlockSet = new Set(
    (legalBlocks || [])
      .map((entry) => String(entry || '').trim().toLowerCase().replace(/\/+$/, ''))
      .filter(Boolean)
  );

  const makeTrailingSlashVariant = (u: URL): string => {
    const clone = new URL(u.toString());
    if (!clone.pathname.endsWith('/')) {
      clone.pathname = `${clone.pathname}/`;
    }
    return clone.toString();
  };

  const makeMirrorVariant = (u: URL): string | null => {
    const clone = new URL(u.toString());
    if (/^\/filme\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/filme\//i, '/v/');
      return clone.toString();
    }
    if (/^\/serie\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/serie\//i, '/s/');
      return clone.toString();
    }
    if (/^\/canal\//i.test(clone.pathname)) {
      clone.pathname = clone.pathname.replace(/^\/canal\//i, '/t/');
      return clone.toString();
    }
    return null;
  };

  const trailingSlashUrl = makeTrailingSlashVariant(parsed);
  const mirrorUrl = makeMirrorVariant(parsed);
  const mirrorTrailingUrl = mirrorUrl ? makeTrailingSlashVariant(new URL(mirrorUrl)) : null;

  const isKnownBlocked =
    normalizedBlockSet.has(parsed.pathname.toLowerCase().replace(/\/+$/, '')) ||
    normalizedBlockSet.has(trimmed.toLowerCase().replace(/\/+$/, ''));

  const ordered = isKnownBlocked
    ? [trailingSlashUrl, mirrorUrl, mirrorTrailingUrl, trimmed]
    : [trimmed, trailingSlashUrl, mirrorUrl, mirrorTrailingUrl];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    deduped.push(candidate);
  }
  return deduped;
}

export function extractStreamBetterSlugFromUrl(
  rawUrl?: string | null
): { kind: 'channel' | 'game' | 'event'; slug: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (!isStreamBetterHost(parsed.hostname)) return null;
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    const channelMatch = cleanPath.match(/^\/(?:canal|t)\/([^/?#]+)$/i);
    if (channelMatch?.[1]) {
      return { kind: 'channel', slug: decodeURIComponent(channelMatch[1]) };
    }
    const gameMatch = cleanPath.match(/^\/jogo\/([^/?#]+)$/i);
    if (gameMatch?.[1]) {
      return { kind: 'game', slug: decodeURIComponent(gameMatch[1]) };
    }
    const eventMatch = cleanPath.match(/^\/evento\/([^/?#]+)$/i);
    if (eventMatch?.[1]) {
      return { kind: 'event', slug: decodeURIComponent(eventMatch[1]) };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractStreamFlashMp4FromHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<source\s+src=["']([^"']+)["']\s+type=["']video\/mp4["']/i);
  if (!match?.[1]) return null;
  const decoded = match[1].replace(/&amp;/g, '&').trim();
  if (!/^https?:\/\//i.test(decoded)) return null;
  return decoded;
}

export function mapStreamBetterAudioToMeta(
  audio?: string | null,
  label?: string | null
): { langCode: string; languageLabel: string } {
  const hint = `${audio || ''} ${label || ''}`.trim().toLowerCase();
  if (/(?:legend|pt-sub|\bleg\b|\bsub\b)/i.test(hint)) {
    return { langCode: 'pt-sub', languageLabel: 'Legendado (PT-BR)' };
  }
  if (/(?:dub|pt-br|portugu|\bpt\b)/i.test(hint)) {
    return { langCode: 'pt-br', languageLabel: 'Dublado (PT-BR)' };
  }
  if (/(?:espan|spanish|\bes\b|latino)/i.test(hint)) {
    return { langCode: 'es-es', languageLabel: 'Espanhol' };
  }
  if (/(?:english|ingl|\ben\b|original)/i.test(hint)) {
    return { langCode: 'en-us', languageLabel: 'Inglês / Original' };
  }
  return { langCode: 'pt-br', languageLabel: 'Dublado (PT-BR)' };
}

export function parseStreamBetterV1Sources(payload: unknown): ParsedStreamBetterSource[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const rawSources = Array.isArray(obj.sources) ? obj.sources : [];
  const results: ParsedStreamBetterSource[] = [];

  for (const item of rawSources) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Record<string, unknown>;
    const rawUrl = typeof src.url === 'string' ? src.url.trim() : '';
    const err = typeof src.error === 'string' ? src.error.trim() : '';
    if (!rawUrl || err === 'extraction_failed' || !/^https?:\/\//i.test(rawUrl)) {
      continue;
    }

    const rawKind = typeof src.kind === 'string' ? src.kind.trim().toLowerCase() : 'stream';
    const rawFormat = typeof src.format === 'string' ? src.format.trim().toLowerCase() : '';
    let format: 'hls' | 'mp4' | 'dash' | 'iframe' = 'hls';
    if (rawKind === 'iframe') {
      format = 'iframe';
    } else if (rawKind === 'dash' || rawFormat === 'dash' || /\.mpd(?:$|\?)/i.test(rawUrl)) {
      format = 'dash';
    } else if (
      rawFormat === 'mp4' ||
      rawKind === 'streamflash' ||
      /\.(?:mp4|m4v|webm|mkv)(?:$|\?)/i.test(rawUrl)
    ) {
      format = 'mp4';
    } else if (rawFormat === 'hls' || /\.m3u8(?:$|\?)/i.test(rawUrl) || rawKind === 'stream' || rawKind === 'hubby' || rawKind === 'vidmoly') {
      format = 'hls';
    }

    const headers: Record<string, string> = {};
    let referer = '';
    let origin = '';
    let userAgent: string | undefined;

    if (src.headers && typeof src.headers === 'object' && !Array.isArray(src.headers)) {
      for (const [k, v] of Object.entries(src.headers as Record<string, unknown>)) {
        if (typeof v !== 'string' || !v.trim()) continue;
        const val = v.trim();
        headers[k] = val;
        const lowerKey = k.toLowerCase();
        if (lowerKey === 'referer') referer = val;
        else if (lowerKey === 'origin') origin = val;
        else if (lowerKey === 'user-agent') userAgent = val;
      }
    }

    const expiresAt = typeof src.expires_at === 'string' && src.expires_at.trim()
      ? src.expires_at.trim()
      : null;
    const hasCustomHeaders = Object.keys(headers).length > 0;
    const requiresProxyHeaders = !expiresAt && hasCustomHeaders;

    const audio = typeof src.audio === 'string' ? src.audio.trim() : null;
    const label = typeof src.label === 'string' ? src.label.trim() : '';
    const langMeta = mapStreamBetterAudioToMeta(audio, label);

    const subtitleUrl =
      typeof src.subtitle_url === 'string' && /^https?:\/\//i.test(src.subtitle_url.trim())
        ? src.subtitle_url.trim()
        : null;
    const subtitleLang = typeof src.subtitle_lang === 'string' ? src.subtitle_lang.trim() : null;
    const subtitleLabel = typeof src.subtitle_label === 'string' ? src.subtitle_label.trim() : null;

    const qualities: Array<{ quality: string; url: string }> = [];
    if (Array.isArray(src.qualities)) {
      for (const qItem of src.qualities) {
        if (!qItem || typeof qItem !== 'object') continue;
        const qo = qItem as Record<string, unknown>;
        const qUrl = typeof qo.url === 'string' ? qo.url.trim() : '';
        if (/^https?:\/\//i.test(qUrl)) {
          qualities.push({
            quality: typeof qo.quality === 'string' || typeof qo.quality === 'number'
              ? String(qo.quality)
              : 'HD',
            url: qUrl,
          });
        }
      }
    } else if (src.qualities && typeof src.qualities === 'object') {
      for (const [qName, qVal] of Object.entries(src.qualities as Record<string, unknown>)) {
        if (typeof qVal === 'string' && /^https?:\/\//i.test(qVal.trim())) {
          qualities.push({ quality: qName, url: qVal.trim() });
        } else if (qVal && typeof qVal === 'object') {
          const nestedUrl = (qVal as Record<string, unknown>).url;
          if (typeof nestedUrl === 'string' && /^https?:\/\//i.test(nestedUrl.trim())) {
            qualities.push({ quality: qName, url: nestedUrl.trim() });
          }
        }
      }
    }

    results.push({
      kind: rawKind,
      url: rawUrl,
      format,
      headers,
      referer,
      origin,
      userAgent,
      langCode: langMeta.langCode,
      languageLabel: langMeta.languageLabel,
      label: label || langMeta.languageLabel,
      expiresAt,
      requiresProxyHeaders,
      subtitleUrl,
      subtitleLang,
      subtitleLabel,
      qualities,
    });
  }

  return results;
}

export function mapStreamBetterChannelCategory(
  categoryNames?: string[] | null,
  fallbackCategory?: string | null
): ChannelCategory {
  const joined = `${(categoryNames || []).join(' ')} ${fallbackCategory || ''}`.toLowerCase();
  if (/esport|futebol|luta|nba|nfl|ufc/i.test(joined)) return 'Esportes';
  if (/not[íi]cia|jornal/i.test(joined)) return 'Notícias';
  if (/filme|s[ée]rie|cinema|novela/i.test(joined)) return 'Filmes';
  if (/infantil|desenho|kids|anime/i.test(joined)) return 'Infantil';
  if (/variedade|document[áa]rio|reality|24 horas|abertos/i.test(joined)) return 'Variedades';
  return 'Entretenimento';
}
