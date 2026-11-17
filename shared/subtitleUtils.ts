export const SUBTITLE_LANG_LABELS: Record<string, string> = {
  pob: 'Português (BR)',
  'pt-br': 'Português (BR)',
  por: 'Português (PT)',
  pt: 'Português',
  eng: 'Inglês',
  en: 'Inglês',
  spa: 'Espanhol',
  es: 'Espanhol',
  fre: 'Francês',
  fra: 'Francês',
  ger: 'Alemão',
  deu: 'Alemão',
  ita: 'Italiano',
  jpn: 'Japonês',
  kor: 'Coreano',
};

export function formatSubtitleLangLabel(lang?: string | null): string {
  const clean = (lang || '').trim().toLowerCase();
  return SUBTITLE_LANG_LABELS[clean] || (clean ? clean.toUpperCase() : 'Outro');
}

export function isAllowedSubtitleHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' && /^subs\d*\.strem\.io$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function parseVttTimestampToSeconds(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const secParts = parts[parts.length - 1].split('.');
  const secs = Number(secParts[0]);
  const ms = Number((secParts[1] || '0').padEnd(3, '0').slice(0, 3));
  const mins = Number(parts[parts.length - 2]);
  const hrs = parts.length === 3 ? Number(parts[0]) : 0;
  if ([hrs, mins, secs, ms].some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }
  return hrs * 3600 + mins * 60 + secs + ms / 1000;
}

function formatSecondsToVttTimestamp(totalSec: number): string {
  const clamped = Math.max(0, totalSec);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const adjustedSecs = ms >= 1000 ? secs + 1 : secs;
  const adjustedMs = ms >= 1000 ? 0 : ms;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(adjustedSecs).padStart(2, '0')}.${String(adjustedMs).padStart(3, '0')}`;
}

export function decodeSubtitleBuffer(bytes: Uint8Array): string {
  try {
    // Only valid UTF-8 byte sequences pass fatal: true without throwing
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Fallback to Windows-1252 (Latin-1 superset) for legacy ANSI .srt files
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

export function convertSrtToVtt(rawText: string, offsetSeconds = 0): string {
  const normalized = (rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) {
    return 'WEBVTT\n\n';
  }

  const timeLineRe =
    /^(\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3}(.*)$/;

  const lines = normalized.split('\n');
  const out: string[] = ['WEBVTT', ''];

  let i = 0;
  if (lines[0].toUpperCase().startsWith('WEBVTT')) {
    i = 1;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip numeric cue indices directly preceding a timestamp line
    if (/^\d+$/.test(trimmed) && i + 1 < lines.length && timeLineRe.test(lines[i + 1].trim())) {
      continue;
    }

    const match = trimmed.match(timeLineRe);
    if (match) {
      const [timesPart, ...restTokens] = trimmed.split(/\s+/);
      // Extract start and end properly across '-->'
      const arrowIdx = trimmed.indexOf('-->');
      const startRaw = trimmed.slice(0, arrowIdx).trim();
      const afterArrow = trimmed.slice(arrowIdx + 3).trim();
      const endMatch = afterArrow.match(/^((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3})(.*)$/);
      if (endMatch) {
        const startSec = parseVttTimestampToSeconds(startRaw);
        const endSec = parseVttTimestampToSeconds(endMatch[1]);
        const tailSettings = (endMatch[2] || '').trim();
        if (startSec !== null && endSec !== null) {
          const shiftedStart = formatSecondsToVttTimestamp(startSec + offsetSeconds);
          const shiftedEnd = formatSecondsToVttTimestamp(Math.max(startSec + offsetSeconds + 0.1, endSec + offsetSeconds));
          out.push(
            tailSettings
              ? `${shiftedStart} --> ${shiftedEnd} ${tailSettings}`
              : `${shiftedStart} --> ${shiftedEnd}`
          );
          continue;
        }
      }
      void timesPart;
      void restTokens;
    }

    // Strip ASS positioning tags like {\an8} and <font> tags cleanly
    const cleanedLine = line
      .replace(/\{\\[^}]+\}/g, '')
      .replace(/<\/?font[^>]*>/gi, '');
    out.push(cleanedLine);
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export interface VttCueItem {
  start: number;
  end: number;
  text: string;
}

export function parseVttCues(vttText: string): VttCueItem[] {
  const normalized = (vttText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const blocks = normalized.split(/\n{2,}/);
  const cues: VttCueItem[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const tsIdx = lines.findIndex((l) => l.includes('-->'));
    if (tsIdx === -1) continue;

    const tsLine = lines[tsIdx];
    const arrowIdx = tsLine.indexOf('-->');
    const startSec = parseVttTimestampToSeconds(tsLine.slice(0, arrowIdx));
    const endRaw = tsLine.slice(arrowIdx + 3).trim().split(/\s+/)[0] || '';
    const endSec = parseVttTimestampToSeconds(endRaw);
    if (startSec === null || endSec === null) continue;

    const text = lines
      .slice(tsIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!text) continue;

    cues.push({ start: startSec, end: endSec, text });
  }

  return cues;
}

export function buildHlsProxyPlaylist(
  manifestText: string,
  upstreamUrl: string,
  proxyBasePrefix: string
): string {
  const toProxyUrl = (rawRef: string): string => {
    const trimmed = rawRef.trim();
    if (!trimmed) return trimmed;
    const resolved = new URL(trimmed, upstreamUrl).toString();
    return `${proxyBasePrefix}?u=${encodeURIComponent(resolved)}`;
  };

  return (manifestText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." inside #EXT-X-MAP, #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF
        return line.replace(/URI="([^"]+)"/g, (_full, uri) => `URI="${toProxyUrl(uri)}"`);
      }
      return toProxyUrl(trimmed);
    })
    .join('\n');
}

export function isSafePublicHost(hostname: string): boolean {
  const host = (hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253) return false;
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    host === 'metadata.google.internal'
  ) {
    return false;
  }
  // Reject IPv6 bracketed or bare addresses cleanly to prevent loopback/link-local SSRF
  if (host.includes(':') || host.startsWith('[')) {
    return false;
  }
  // Reject dotted-quad private, loopback, CGNAT, or link-local IPv4 ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a >= 224) return false;
  }
  return host.includes('.');
}

export function extractPlaylistHosts(manifestText: string, upstreamUrl: string): string[] {
  const hosts = new Set<string>();
  const collectRef = (rawRef: string) => {
    const trimmed = rawRef.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed, upstreamUrl);
      if (parsed.protocol === 'https:') {
        hosts.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed URI tokens inside manifests
    }
  };

  for (const rawLine of (manifestText || '').replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      for (const match of trimmed.matchAll(/URI="([^"]+)"/g)) {
        if (match[1]) collectRef(match[1]);
      }
    } else {
      collectRef(trimmed);
    }
  }

  return Array.from(hosts);
}

export function resolveSegmentMimeType(targetUrl: string, upstreamContentType?: string | null): string {
  const cleanPath = (targetUrl || '').split('?')[0].split('#')[0].toLowerCase();
  if (cleanPath.endsWith('.mp4') || cleanPath.endsWith('.m4s') || cleanPath.endsWith('.m4v')) {
    return 'video/mp4';
  }
  if (cleanPath.endsWith('.webm')) {
    return 'video/webm';
  }
  if (cleanPath.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (cleanPath.endsWith('.ogg') || cleanPath.endsWith('.ogv')) {
    return 'video/ogg';
  }
  if (cleanPath.endsWith('.ts')) {
    return 'video/mp2t';
  }
  const normalizedUpstream = (upstreamContentType || '').split(';')[0].trim().toLowerCase();
  if (normalizedUpstream.startsWith('video/')) {
    return normalizedUpstream;
  }
  // Disguised extensions (.css, .woff, .png, .js, text/plain) must stream as raw bytes so browsers don't block CORB/MIME
  return 'application/octet-stream';
}

export function detectMediaKindFromBytesOrHeaders(params: {
  url: string;
  contentType?: string | null;
  contentDisposition?: string | null;
  sniffBytes?: Uint8Array | null;
}): 'hls' | 'video' | null {
  const ct = (params.contentType || '').split(';')[0].trim().toLowerCase();
  const disp = (params.contentDisposition || '').toLowerCase();
  const bytes = params.sniffBytes;

  if (bytes && bytes.length >= 4) {
    // Check leading UTF-8 text for HLS (#EXTM3U) or HTML guard
    const textSample = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
      .replace(/^\uFEFF/, '')
      .trimStart();

    if (/^#EXTM3U\b/i.test(textSample)) {
      return 'hls';
    }

    // ISO BMFF / MP4 / M4V / MOV box header: [size:4]['ftyp':4]
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return 'video';
    }

    // Matroska / WebM EBML header: 1A 45 DF A3
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return 'video';
    }

    // Ogg container header: "OggS"
    if (
      bytes[0] === 0x4f &&
      bytes[1] === 0x67 &&
      bytes[2] === 0x67 &&
      bytes[3] === 0x53
    ) {
      return 'video';
    }

    // Reject HTML documents disguised with octet-stream unless later checks prove otherwise
    if (/^<(?:!doctype|html|head|body|script)\b/i.test(textSample)) {
      return null;
    }
  }

  if (ct.includes('mpegurl') || ct === 'application/x-mpegurl' || ct === 'audio/mpegurl') {
    return 'hls';
  }
  if (ct.startsWith('video/')) {
    return 'video';
  }

  if (/filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.m3u8(?:["';\s]|$)/i.test(disp)) {
    return 'hls';
  }
  if (
    /filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.(?:mp4|webm|ogg|ogv|mov|m4v)(?:["';\s]|$)/i.test(
      disp
    )
  ) {
    return 'video';
  }

  try {
    const parsed = new URL(params.url);
    const cleanPath = parsed.pathname.toLowerCase();
    if (cleanPath.endsWith('.m3u8') || /format=m3u8|type=hls/i.test(parsed.search)) {
      return 'hls';
    }
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return 'video';
    }
  } catch {
    const clean = (params.url || '').split('#')[0].split('?')[0].toLowerCase();
    if (clean.endsWith('.m3u8')) return 'hls';
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(clean)) return 'video';
  }

  return null;
}

export function extractEmbedPlayerHash(embedUrl: string): { origin: string; hash: string } | null {
  try {
    const parsed = new URL((embedUrl || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!/^([a-z0-9-]+\.)?embedplayer\d*\.xyz$/i.test(parsed.hostname)) {
      return null;
    }
    const match = parsed.pathname.match(/\/video\/([a-z0-9_-]{8,128})/i);
    if (!match || !match[1]) return null;
    return {
      origin: parsed.origin,
      hash: match[1],
    };
  } catch {
    return null;
  }
}

export function isCloudflareChallengeHtml(body: string, statusCode?: number): boolean {
  const sample = (body || '').slice(0, 12_000);
  if (
    /challenges\.cloudflare\.com|cf-turnstile|window\._cf_chl_opt|cf-challenge-running/i.test(sample) ||
    /<title>\s*(?:Just a moment|Attention Required!?\s*\|\s*Cloudflare)/i.test(sample)
  ) {
    return true;
  }
  if (
    (statusCode === 403 || statusCode === 429 || statusCode === 503) &&
    (/cloudflare/i.test(sample) || /\/cdn-cgi\/challenge-platform\//i.test(sample))
  ) {
    return true;
  }
  return false;
}

const AD_OR_TRACKER_HOST_RE =
  /(?:^|\.)(mypopads|bataraanimals|sinonneurism|waust\.at|doubleclick\.net|googlesyndication|googletagmanager|google-analytics|popads\.net|popcash|exoclick|juicyads|adsterra|propellerads|yandex\.ru)\b/i;

export function isAdOrTrackerHost(hostname: string): boolean {
  return AD_OR_TRACKER_HOST_RE.test((hostname || '').trim().toLowerCase());
}

function classifyPlayableMediaUrl(
  rawCandidate: string,
  baseUrl: string,
  allowOpaqueStreamKey = false
): { streamUrl: string; streamKind: 'hls' | 'video' } | null {
  const unescaped = (rawCandidate || '')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
  if (!unescaped || unescaped.startsWith('data:') || unescaped.startsWith('javascript:')) {
    return null;
  }
  try {
    const resolved = new URL(unescaped, baseUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
    if (!isSafePublicHost(resolved.hostname) || isAdOrTrackerHost(resolved.hostname)) return null;

    const cleanPath = resolved.pathname.toLowerCase();
    // Reject obvious non-media assets or HTML wrapper pages
    if (
      /\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|woff2?|ttf|srt|vtt)$/i.test(cleanPath) ||
      (cleanPath.endsWith('.js') && !resolved.search.includes('.m3u8'))
    ) {
      return null;
    }

    if (cleanPath.endsWith('.m3u8') || /format=m3u8|type=hls/i.test(resolved.search)) {
      return { streamUrl: resolved.toString(), streamKind: 'hls' };
    }
    if (/\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return { streamUrl: resolved.toString(), streamKind: 'video' };
    }
    if (allowOpaqueStreamKey && !/\.(?:html?|php|asp|aspx|jsp)$/i.test(cleanPath)) {
      return { streamUrl: resolved.toString(), streamKind: 'hls' };
    }
    return null;
  } catch {
    return null;
  }
}

export interface ExtractedPlayableBodyResult {
  streamUrl: string;
  streamKind: 'hls' | 'video';
  posterUrl: string | null;
}

export function extractPlayableStreamFromBody(
  body: string,
  baseUrl: string
): ExtractedPlayableBodyResult | null {
  const raw = (body || '').trim();
  if (!raw) return null;

  // 1. JSON API responses (e.g. WatchPlay/EmbedPlayer/custom JSON APIs)
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const visit = (node: unknown, depth = 0): ExtractedPlayableBodyResult | null => {
        if (!node || depth > 5) return null;
        if (Array.isArray(node)) {
          for (const item of node) {
            const hit = visit(item, depth + 1);
            if (hit) return hit;
          }
          return null;
        }
        if (typeof node === 'object') {
          const obj = node as Record<string, unknown>;
          const posterRaw =
            typeof obj.poster === 'string'
              ? obj.poster
              : typeof obj.videoImage === 'string'
                ? obj.videoImage
                : typeof obj.bgImage === 'string'
                  ? obj.bgImage
                  : null;

          const explicitKeys = [
            'securedLink',
            'videoSource',
            'streamUrl',
            'hlsUrl',
            'hls',
            'mp4',
            'file',
            'url',
            'src',
          ];
          for (const key of explicitKeys) {
            const val = obj[key];
            if (typeof val === 'string') {
              const strictOpaque =
                key === 'securedLink' ||
                key === 'videoSource' ||
                key === 'streamUrl' ||
                key === 'hlsUrl';
              const classified = classifyPlayableMediaUrl(val, baseUrl, strictOpaque);
              if (classified) {
                const isExplicitMp4 = key === 'mp4' || classified.streamKind === 'video';
                return {
                  streamUrl: classified.streamUrl,
                  streamKind: isExplicitMp4 && obj.hls !== true ? 'video' : 'hls',
                  posterUrl: posterRaw,
                };
              }
            }
          }
          for (const nestedKey of ['sources', 'streams', 'files', 'data', 'result', 'stream']) {
            if (nestedKey in obj) {
              const hit = visit(obj[nestedKey], depth + 1);
              if (hit) {
                if (!hit.posterUrl && posterRaw) hit.posterUrl = posterRaw;
                return hit;
              }
            }
          }
        }
        return null;
      };

      const jsonMatch = visit(parsed);
      if (jsonMatch) return jsonMatch;
    } catch {
      // Not strict JSON — continue to HTML/JS scan
    }
  }

  // 2. HTML/JS inline player configuration patterns
  const normalizedHtml = raw.replace(/\\\//g, '/');
  const posterMatch =
    normalizedHtml.match(/data-poster=["']([^"']+)["']/i) ||
    normalizedHtml.match(/poster\s*[:=]\s*["']([^"']+)["']/i);
  const posterUrl = posterMatch?.[1]?.trim() || null;

  const patterns: Array<{ regex: RegExp; allowOpaque: boolean }> = [
    { regex: /hls\.loadSource\(\s*["']([^"']+)["']\s*\)/gi, allowOpaque: true },
    { regex: /(?:securedLink|videoSource|streamUrl|hlsUrl)\s*[:=]\s*["']([^"']+)["']/gi, allowOpaque: true },
    { regex: /(?:file|url|src|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|webm|mov|m4v)(?:\?[^"']*)?)["']/gi, allowOpaque: false },
    { regex: /<source[^>]+src=["']([^"']+)["']/gi, allowOpaque: false },
    { regex: /<video[^>]+src=["']([^"']+)["']/gi, allowOpaque: false },
    { regex: /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|m4v|webm)(?:\?[^\s"'<>\\]*)?/gi, allowOpaque: false },
  ];

  for (const { regex, allowOpaque } of patterns) {
    for (const match of normalizedHtml.matchAll(regex)) {
      const candidate = match[1] || match[0];
      const classified = classifyPlayableMediaUrl(candidate, baseUrl, allowOpaque);
      if (classified) {
        return {
          ...classified,
          posterUrl,
        };
      }
    }
  }

  return null;
}

export function extractNestedEmbedUrls(html: string, baseUrl: string): string[] {
  const normalized = (html || '').replace(/\\\//g, '/');
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of normalized.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    const raw = (match[1] || '').trim();
    if (!raw || raw === 'about:blank' || raw.startsWith('javascript:')) continue;
    try {
      const resolved = new URL(raw, baseUrl);
      if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') continue;
      if (!isSafePublicHost(resolved.hostname) || isAdOrTrackerHost(resolved.hostname)) continue;
      const finalStr = resolved.toString();
      if (!seen.has(finalStr)) {
        seen.add(finalStr);
        urls.push(finalStr);
      }
    } catch {
      // ignore invalid iframe src
    }
  }

  return urls;
}


