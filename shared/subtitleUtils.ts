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
  fr: 'Francês',
  ger: 'Alemão',
  deu: 'Alemão',
  de: 'Alemão',
  ita: 'Italiano',
  it: 'Italiano',
  jpn: 'Japonês',
  ja: 'Japonês',
  kor: 'Coreano',
  ko: 'Coreano',
  rus: 'Russo',
  ru: 'Russo',
  ara: 'Árabe',
  ar: 'Árabe',
  chi: 'Chinês',
  zho: 'Chinês',
  zh: 'Chinês',
  dut: 'Holandês',
  nld: 'Holandês',
  nl: 'Holandês',
  pol: 'Polonês',
  pl: 'Polonês',
  tur: 'Turco',
  tr: 'Turco',
  hin: 'Hindi',
  hi: 'Hindi',
  ind: 'Indonésio',
  id: 'Indonésio',
  vie: 'Vietnamita',
  vi: 'Vietnamita',
  tha: 'Tailandês',
  th: 'Tailandês',
  heb: 'Hebraico',
  he: 'Hebraico',
  swe: 'Sueco',
  sv: 'Sueco',
  nor: 'Norueguês',
  no: 'Norueguês',
  dan: 'Dinamarquês',
  da: 'Dinamarquês',
  fin: 'Finlandês',
  fi: 'Finlandês',
  ell: 'Grego',
  el: 'Grego',
  ces: 'Tcheco',
  cs: 'Tcheco',
  hun: 'Húngaro',
  hu: 'Húngaro',
  rum: 'Romeno',
  ron: 'Romeno',
  ro: 'Romeno',
  ukr: 'Ucraniano',
  uk: 'Ucraniano',
};

export function formatSubtitleLangLabel(lang?: string | null): string {
  const clean = (lang || '').trim().toLowerCase();
  return SUBTITLE_LANG_LABELS[clean] || (clean ? clean.toUpperCase() : 'Outro');
}

export function mergeAndDisambiguateSubtitles<
  T extends { id: string; lang: string; label: string; url: string; isDefault?: boolean },
>(tracks: T[], maxItems = 30): Array<T & { isDefault: boolean }> {
  const seenIds = new Set<string>();
  const rank = (lang: string) =>
    lang === 'pob' ? 0 : lang === 'por' ? 1 : lang === 'eng' ? 2 : lang === 'spa' ? 3 : 4;

  const sorted = (tracks || [])
    .filter((sub) => {
      if (!sub?.id || !sub?.url || seenIds.has(sub.id)) return false;
      seenIds.add(sub.id);
      return true;
    })
    .sort((a, b) => rank(a.lang) - rank(b.lang))
    .slice(0, maxItems);

  const labelCounts = new Map<string, number>();
  let hasDefaultSub = false;

  return sorted.map((sub) => {
    const baseLabel =
      (sub.label || '').replace(/\s+#\d+$/, '').trim() || formatSubtitleLangLabel(sub.lang);
    const count = (labelCounts.get(baseLabel) || 0) + 1;
    labelCounts.set(baseLabel, count);
    const finalLabel = count === 1 ? baseLabel : `${baseLabel} #${count}`;
    const shouldBeDefault = !hasDefaultSub && sub.lang === 'pob';
    if (shouldBeDefault) hasDefaultSub = true;
    return {
      ...sub,
      label: finalLabel,
      isDefault: shouldBeDefault,
    };
  });
}

export function isAllowedSubtitleHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    return (
      /^subs\d*\.strem\.io$/i.test(parsed.hostname) ||
      /^dl\.opensubtitles\.org$/i.test(parsed.hostname) ||
      /^cacdn\.hakunaymatata\.com$/i.test(parsed.hostname) ||
      /^cache\.vdrk\.site$/i.test(parsed.hostname) ||
      /^rezesubs\.com$/i.test(parsed.hostname) ||
      /^([a-z0-9-]+\.)?qqqcdn\.cloud$/i.test(parsed.hostname) ||
      /^([a-z0-9-]+\.)?mysubsplay\.com$/i.test(parsed.hostname) ||
      /^(?:www\.)?freeapi\.pro$/i.test(parsed.hostname) ||
      /^(?:[a-z0-9-]+\.)?streambetter\.xyz$/i.test(parsed.hostname) ||
      /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname)
    );
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

  // Handle ASS / SSA subtitle scripts (common on anime & OpenSubtitles)
  if (/\[Script Info\]/i.test(normalized) || /^Dialogue:\s*/m.test(normalized)) {
    const assLines = normalized.split('\n');
    let formatCols = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    let inEvents = false;
    const vttOut: string[] = ['WEBVTT', ''];

    for (const rawLine of assLines) {
      const trimmed = rawLine.trim();
      if (/^\[(.+)\]$/.test(trimmed)) {
        inEvents = /^\[Events\]$/i.test(trimmed);
        continue;
      }
      if ((inEvents || /^Format:/i.test(trimmed)) && /^Format:\s*/i.test(trimmed)) {
        formatCols = trimmed
          .replace(/^Format:\s*/i, '')
          .split(',')
          .map((c) => c.trim().toLowerCase());
        continue;
      }
      if (!/^Dialogue:\s*/i.test(trimmed)) continue;

      const body = trimmed.replace(/^Dialogue:\s*/i, '');
      const textColIdx = formatCols.indexOf('text');
      const startColIdx = formatCols.indexOf('start');
      const endColIdx = formatCols.indexOf('end');
      const splitCount = textColIdx >= 0 ? textColIdx : formatCols.length - 1;

      const fields: string[] = [];
      let cursor = 0;
      for (let f = 0; f < splitCount; f++) {
        const commaIdx = body.indexOf(',', cursor);
        if (commaIdx === -1) break;
        fields.push(body.slice(cursor, commaIdx).trim());
        cursor = commaIdx + 1;
      }
      fields.push(body.slice(cursor));

      const rawStart = fields[startColIdx >= 0 ? startColIdx : 1] || '';
      const rawEnd = fields[endColIdx >= 0 ? endColIdx : 2] || '';
      const startSec = parseVttTimestampToSeconds(rawStart);
      const endSec = parseVttTimestampToSeconds(rawEnd);
      if (startSec === null || endSec === null) continue;

      const rawDialogue = (fields[splitCount] || '')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\\N/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\h/g, ' ')
        .trim();
      if (!rawDialogue) continue;

      const sOut = formatSecondsToVttTimestamp(startSec + offsetSeconds);
      const eOut = formatSecondsToVttTimestamp(Math.max(startSec + offsetSeconds + 0.1, endSec + offsetSeconds));
      vttOut.push(`${sOut} --> ${eOut}`);
      vttOut.push(rawDialogue);
      vttOut.push('');
    }

    if (vttOut.length > 2) {
      return `${vttOut.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
    }
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
  proxyBasePrefix: string,
  signUrl?: (resolvedUrl: string) => string
): string {
  const toProxyUrl = (rawRef: string): string => {
    const trimmed = rawRef.trim();
    if (!trimmed) return trimmed;
    const resolved = new URL(trimmed, upstreamUrl).toString();
    const sigParam = signUrl ? `&s=${encodeURIComponent(signUrl(resolved))}` : '';
    return `${proxyBasePrefix}?u=${encodeURIComponent(resolved)}${sigParam}`;
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
  if (cleanPath.endsWith('.mkv')) {
    return 'video/x-matroska';
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
    /filename\*?=(?:UTF-8'')?["']?[^"';\s]+\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)(?:["';\s]|$)/i.test(
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
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
      return 'video';
    }
  } catch {
    const clean = (params.url || '').split('#')[0].split('?')[0].toLowerCase();
    if (clean.endsWith('.m3u8')) return 'hls';
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(clean)) return 'video';
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
    if (/\.(?:mp4|mkv|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath)) {
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
  detectedLang?: string;
}

function normalizeExtractedLangHint(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/(?:legend|pt-sub|\bsub\b|\bleg\b)/i.test(s)) return 'sub';
  if (/(?:dublad|portugu|\bpt-br\b|\bpt\b|\bpor\b|\bpob\b|\bdub\b)/i.test(s)) return 'pt';
  if (/(?:ingl[eê]s|english|\ben-us\b|\ben\b|\beng\b|\boriginal\b)/i.test(s)) return 'en';
  if (/(?:espan|spanish|\bes-es\b|\bes\b|\bspa\b|latino|castellano)/i.test(s)) return 'es';
  if (/(?:fran[cç]|french|\bfr\b|\bfre\b|\bfra\b)/i.test(s)) return 'fr';
  if (/(?:alem[aã]|german|\bde\b|\bger\b|\bdeu\b)/i.test(s)) return 'de';
  if (/(?:italian|\bit\b|\bita\b)/i.test(s)) return 'it';
  if (/(?:japon|japanese|\bja\b|\bjpn\b)/i.test(s)) return 'ja';
  if (/(?:corean|korean|\bko\b|\bkor\b)/i.test(s)) return 'ko';
  if (/(?:\bhindi\b|\bhi\b|\bhin\b)/i.test(s)) return 'hi';
  return undefined;
}

export function extractPlayableStreamsFromBody(
  body: string,
  baseUrl: string
): ExtractedPlayableBodyResult[] {
  const raw = (body || '').trim();
  if (!raw) return [];

  const results: ExtractedPlayableBodyResult[] = [];
  const seenUrls = new Set<string>();

  const pushUnique = (item: ExtractedPlayableBodyResult) => {
    if (!item.streamUrl || seenUrls.has(item.streamUrl)) return;
    seenUrls.add(item.streamUrl);
    results.push(item);
  };

  // 1. JSON API responses (e.g. WatchPlay/EmbedPlayer/custom multi-language JSON APIs)
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const visit = (node: unknown, depth = 0, inheritedPoster: string | null = null): void => {
        if (!node || depth > 5 || results.length >= 12) return;
        if (Array.isArray(node)) {
          for (const item of node) {
            visit(item, depth + 1, inheritedPoster);
          }
          return;
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
                  : inheritedPoster;

          const itemLangHint =
            normalizeExtractedLangHint(obj.lang) ||
            normalizeExtractedLangHint(obj.language) ||
            normalizeExtractedLangHint(obj.idioma) ||
            normalizeExtractedLangHint(obj.audio) ||
            normalizeExtractedLangHint(obj.label) ||
            normalizeExtractedLangHint(obj.title) ||
            normalizeExtractedLangHint(obj.name);

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
                key === 'hlsUrl' ||
                (key === 'url' &&
                  (obj.type === 'hls' ||
                    obj.type === 'mp4' ||
                    obj.type === 'video' ||
                    obj.hls === true));
              const classified = classifyPlayableMediaUrl(val, baseUrl, strictOpaque);
              if (classified) {
                const isExplicitMp4 =
                  key === 'mp4' ||
                  obj.type === 'mp4' ||
                  obj.type === 'video' ||
                  classified.streamKind === 'video';
                pushUnique({
                  streamUrl: classified.streamUrl,
                  streamKind:
                    isExplicitMp4 && obj.hls !== true && obj.type !== 'hls' ? 'video' : 'hls',
                  posterUrl: posterRaw,
                  ...(itemLangHint ? { detectedLang: itemLangHint } : {}),
                });
                break;
              }
            }
          }
          for (const nestedKey of [
            'sources',
            'streams',
            'files',
            'playlist',
            'links',
            'servers',
            'data',
            'result',
            'stream',
          ]) {
            if (nestedKey in obj) {
              visit(obj[nestedKey], depth + 1, posterRaw);
            }
          }
        }
      };

      visit(parsed);
      if (results.length > 0) return results;
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

  for (const tagMatch of normalizedHtml.matchAll(/<source\b([^>]+)>/gi)) {
    const attrs = tagMatch[1] || '';
    const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const classified = classifyPlayableMediaUrl(src, baseUrl, false);
    if (!classified) continue;
    const labelHint =
      normalizeExtractedLangHint(attrs.match(/(?:label|title|data-lang|srclang)=["']([^"']+)["']/i)?.[1]);
    pushUnique({
      ...classified,
      posterUrl,
      ...(labelHint ? { detectedLang: labelHint } : {}),
    });
  }

  const patterns: Array<{ regex: RegExp; allowOpaque: boolean }> = [
    { regex: /hls\.loadSource\(\s*["']([^"']+)["']\s*\)/gi, allowOpaque: true },
    { regex: /(?:securedLink|videoSource|streamUrl|hlsUrl)\s*[:=]\s*["']([^"']+)["']/gi, allowOpaque: true },
    { regex: /(?:file|url|src|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|mkv|webm|mov|m4v)(?:\?[^"']*)?)["']/gi, allowOpaque: false },
    { regex: /<video[^>]+src=["']([^"']+)["']/gi, allowOpaque: false },
    { regex: /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|mkv|m4v|webm)(?:\?[^\s"'<>\\]*)?/gi, allowOpaque: false },
  ];

  for (const { regex, allowOpaque } of patterns) {
    for (const match of normalizedHtml.matchAll(regex)) {
      const candidate = match[1] || match[0];
      const classified = classifyPlayableMediaUrl(candidate, baseUrl, allowOpaque);
      if (classified) {
        pushUnique({
          ...classified,
          posterUrl,
        });
        if (results.length >= 8) break;
      }
    }
    if (results.length >= 8) break;
  }

  if (results.length === 0) {
    const unpackedHls = unpackFirePlayerScript(raw, baseUrl);
    if (unpackedHls) {
      const classified = classifyPlayableMediaUrl(unpackedHls, baseUrl, true);
      if (classified) {
        pushUnique({
          ...classified,
          posterUrl,
        });
      }
    }
  }

  return results;
}

function decodeDeanEdwardsPacker(p: string, a: number, c: number, k: string[]): string {
  const encodeRadix = (n: number): string =>
    (n < a ? '' : encodeRadix(Math.floor(n / a))) +
    (n % a > 35 ? String.fromCharCode((n % a) + 29) : (n % a).toString(36));

  const dict = new Map<string, string>();
  let remaining = c;
  while (remaining--) {
    const token = encodeRadix(remaining);
    dict.set(token, k[remaining] || token);
  }
  return p.replace(/\b\w+\b/g, (word) => dict.get(word) ?? word);
}

export function unpackFirePlayerScript(html: string, baseUrl?: string): string | null {
  if (!html) return null;
  const packerRegex =
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:[^'\\]|\\.)*)',\s*(\d+),\s*(\d+),\s*'((?:[^'\\]|\\.)*)'\.split\('\|'\)/g;

  for (const match of html.matchAll(packerRegex)) {
    const p = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const a = Number(match[2]);
    const c = Number(match[3]);
    const k = match[4].split('|');
    if (!Number.isFinite(a) || a < 2 || a > 62 || !Number.isFinite(c) || c <= 0 || c > 20_000) {
      continue;
    }

    const unpacked = decodeDeanEdwardsPacker(p, a, c, k).replace(/\\\//g, '/');
    const videoUrlMatch = unpacked.match(/"videoUrl"\s*:\s*"([^"]+)"/);
    if (videoUrlMatch?.[1]) {
      const rawUrl = videoUrlMatch[1].trim();
      if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
      if (baseUrl) {
        try {
          return new URL(rawUrl, baseUrl).toString();
        } catch {
          return rawUrl;
        }
      }
      return rawUrl;
    }
  }

  return null;
}

export function parseNovelasCdnOrFshdHtml(
  html: string,
  mediaType: 'movie' | 'tv'
): {
  contentId: number;
  inlineMovieOptions: Array<{ id: number; type: number }>;
} {
  if (!html) return { contentId: 0, inlineMovieOptions: [] };

  let contentId = 0;
  if (mediaType === 'movie') {
    const infoMatch = html.match(/var\s+CONTENT_INFO\s*=\s*['"](\d+)['"]/);
    if (infoMatch?.[1]) contentId = Number(infoMatch[1]) || 0;
  } else {
    const activeEpMatch =
      html.match(/class="episodeOption[^"]*\bactive\b[^"]*"[^>]*data-contentid="(\d+)"/i) ||
      html.match(/data-contentid="(\d+)"[^>]*class="episodeOption[^"]*\bactive\b/i) ||
      html.match(/class="episodeOption[^"]*"[^>]*data-contentid="(\d+)"/i);
    if (activeEpMatch?.[1]) contentId = Number(activeEpMatch[1]) || 0;
  }

  const inlineMovieOptions: Array<{ id: number; type: number }> = [];
  if (mediaType === 'movie') {
    const seen = new Set<number>();
    for (const m of html.matchAll(/data-id="(\d+)"[^>]*data-lang="(\d+)"|data-lang="(\d+)"[^>]*data-id="(\d+)"/gi)) {
      const id = Number(m[1] || m[4] || 0);
      const langType = Number(m[2] || m[3] || 1);
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        inlineMovieOptions.push({ id, type: langType });
      }
    }
  }

  return { contentId, inlineMovieOptions };
}

export function extractPlayableStreamFromBody(
  body: string,
  baseUrl: string
): ExtractedPlayableBodyResult | null {
  const list = extractPlayableStreamsFromBody(body, baseUrl);
  if (list.length === 0) return null;
  const { detectedLang: _ignored, ...first } = list[0];
  return first;
}

export function extractNestedEmbedUrls(html: string, baseUrl: string): string[] {
  const normalized = (html || '').replace(/\\\//g, '/');
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (raw: string) => {
    const clean = (raw || '').trim();
    if (!clean || clean === 'about:blank' || clean.startsWith('javascript:')) return;
    try {
      const resolved = new URL(clean, baseUrl);
      if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return;
      if (!isSafePublicHost(resolved.hostname) || isAdOrTrackerHost(resolved.hostname)) return;
      if (/\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json)(?:$|\?)/i.test(resolved.pathname)) {
        return;
      }
      const finalStr = resolved.toString();
      if (!seen.has(finalStr)) {
        seen.add(finalStr);
        urls.push(finalStr);
      }
    } catch {
      // ignore invalid URL
    }
  };

  for (const match of normalized.matchAll(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }
  for (const match of normalized.matchAll(/(?:data-embed|data-url|data-player)=["'](https?:\/\/[^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }
  for (const match of normalized.matchAll(/\b(?:go|loadPlayer|setEmbed|changeServer)\(\s*["'](https?:\/\/[^"']+)["']/gi)) {
    pushCandidate(match[1]);
  }

  return urls;
}

export function hasAdOrAntiSandboxTraps(html: string): boolean {
  const sample = (html || '').slice(0, 80_000);
  return (
    /frameElement\.hasAttribute\(\s*["']sandbox["']\s*\)|\/asb\.html\b|cst-captcha|jw-gate-cst/i.test(
      sample
    ) ||
    /mypopads\.com|popads\.net|popcash|exoclick|adsterra|waust\.at\/d\.js/i.test(sample)
  );
}

export function isAggregatorOrWrapperHtml(html: string): boolean {
  const sample = (html || '').slice(0, 80_000);
  return (
    /disable-devtool|\b(?:go|loadPlayer|setEmbed|changeServer)\(\s*["']https?:\/\/|<iframe\b/i.test(
      sample
    ) ||
    /Investidor\.blog|Player\s+n[ãa]o\s+dispon[íi]vel|Conte[úu]do\s+n[ãa]o\s+encontrado/i.test(
      sample
    )
  );
}

export interface VidLinkMediaCandidate {
  url: string;
  streamKind: 'hls' | 'video';
  sendUserAgent: boolean;
  codecScore: number;
  resolution: number;
}

export function selectVidLinkCandidates(
  streamData: Record<string, unknown>
): VidLinkMediaCandidate[] {
  if (!streamData || typeof streamData !== 'object') return [];

  const candidates: Array<{
    url: string;
    codecScore: number;
    resolution: number;
  }> = [];

  const qualities = streamData.qualities;
  if (qualities && typeof qualities === 'object' && !Array.isArray(qualities)) {
    for (const [resKey, rawEntry] of Object.entries(qualities as Record<string, unknown>)) {
      if (!rawEntry || typeof rawEntry !== 'object') continue;
      const entry = rawEntry as Record<string, unknown>;
      const url = typeof entry.url === 'string' ? entry.url.trim() : '';
      if (!/^https?:\/\//i.test(url)) continue;
      const codecName =
        typeof entry.codecName === 'string' ? entry.codecName.trim().toLowerCase() : '';
      const resNum = Number.parseInt(resKey.replace(/\D+/g, ''), 10) || 0;
      const codecScore = /(?:h264|avc)/i.test(codecName)
        ? 0
        : /(?:hevc|h265|vp9|av1)/i.test(codecName)
          ? 2
          : 1;
      candidates.push({ url, codecScore, resolution: resNum });
    }
  } else if (Array.isArray(qualities)) {
    for (const rawEntry of qualities) {
      if (!rawEntry || typeof rawEntry !== 'object') continue;
      const entry = rawEntry as Record<string, unknown>;
      const url = typeof entry.url === 'string' ? entry.url.trim() : '';
      if (!/^https?:\/\//i.test(url)) continue;
      const codecName =
        typeof entry.codecName === 'string' ? entry.codecName.trim().toLowerCase() : '';
      const resRaw =
        typeof entry.quality === 'string' || typeof entry.quality === 'number'
          ? String(entry.quality)
          : '';
      const resNum = Number.parseInt(resRaw.replace(/\D+/g, ''), 10) || 0;
      const codecScore = /(?:h264|avc)/i.test(codecName)
        ? 0
        : /(?:hevc|h265|vp9|av1)/i.test(codecName)
          ? 2
          : 1;
      candidates.push({ url, codecScore, resolution: resNum });
    }
  }

  candidates.sort((a, b) => {
    if (a.codecScore !== b.codecScore) return a.codecScore - b.codecScore;
    return b.resolution - a.resolution;
  });

  const out: VidLinkMediaCandidate[] = [];
  const seen = new Set<string>();
  const pushUnique = (item: VidLinkMediaCandidate) => {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    out.push(item);
  };

  for (const c of candidates.filter((x) => x.codecScore === 0)) {
    pushUnique({
      url: c.url,
      streamKind: 'video',
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(c.url),
      codecScore: c.codecScore,
      resolution: c.resolution,
    });
  }

  const playlistUrl =
    typeof streamData.playlist === 'string' ? streamData.playlist.trim() : '';
  if (/^https?:\/\//i.test(playlistUrl)) {
    pushUnique({
      url: playlistUrl,
      streamKind: 'hls',
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(playlistUrl),
      codecScore: 1,
      resolution: 1080,
    });
  }

  for (const c of candidates.filter((x) => x.codecScore !== 0)) {
    pushUnique({
      url: c.url,
      streamKind: 'video',
      sendUserAgent: !/bcdn\.hakunaymatata\.com/i.test(c.url),
      codecScore: c.codecScore,
      resolution: c.resolution,
    });
  }

  return out;
}

export function selectBestVidLinkMedia(streamData: Record<string, unknown>): {
  url: string;
  streamKind: 'hls' | 'video';
  sendUserAgent: boolean;
} | null {
  const first = selectVidLinkCandidates(streamData)[0];
  if (!first) return null;
  return {
    url: first.url,
    streamKind: first.streamKind,
    sendUserAgent: first.sendUserAgent,
  };
}

export function parsePlayerFlixStyleUrl(urlStr: string): {
  origin: string;
  mediaType: 'movie' | 'tv';
  id: string;
  season: number | null;
  episode: number | null;
} | null {
  try {
    const parsed = new URL((urlStr || '').trim());
    const host = parsed.hostname.toLowerCase();
    if (
      !/^(?:[a-z0-9-]+\.)?(?:myembed\.biz|playerflix\.ink|embedmovies\.org)$/i.test(host)
    ) {
      return null;
    }
    const tvMatch = parsed.pathname.match(
      /^\/(?:serie|tv|tvshow)\/(\d+|tt\d+)\/(\d+)\/(\d+)/i
    );
    if (tvMatch) {
      return {
        origin: host.includes('playerflix.ink') ? parsed.origin : 'https://playerflix.ink',
        mediaType: 'tv',
        id: tvMatch[1],
        season: Number(tvMatch[2]) || 1,
        episode: Number(tvMatch[3]) || 1,
      };
    }
    const movieMatch = parsed.pathname.match(/^\/(?:filme|movie)\/(\d+|tt\d+)/i);
    if (movieMatch) {
      return {
        origin: host.includes('playerflix.ink') ? parsed.origin : 'https://playerflix.ink',
        mediaType: 'movie',
        id: movieMatch[1],
        season: null,
        episode: null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface BuzzQServerPayload {
  token: string;
  playApiBases: string[];
  servers: Array<{
    ref: string;
    name: string;
    lang: string | null;
  }>;
}

function extractBalancedJsonAfterVarQ(html: string): string | null {
  const match = /\bvar\s+Q\s*=\s*\{/.exec(html);
  if (!match) return null;
  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(html.length, start + 120_000);
  for (let i = start; i < limit; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseBuzzQPayload(
  html: string,
  pageUrl: string
): BuzzQServerPayload | null {
  if (!html || !pageUrl) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return null;
  }

  const rawJson = extractBalancedJsonAfterVarQ(html);
  if (!rawJson) return null;

  let qObj: {
    t?: unknown;
    ssr?: {
      servers?: Array<{
        ref?: unknown;
        name?: unknown;
        lang?: unknown;
      }>;
    };
  };
  try {
    qObj = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const token = typeof qObj.t === 'string' ? qObj.t.trim() : '';
  const rawServers = Array.isArray(qObj.ssr?.servers) ? qObj.ssr.servers : [];
  if (!token || rawServers.length === 0) return null;

  const servers: BuzzQServerPayload['servers'] = [];
  for (const s of rawServers) {
    if (!s || typeof s.ref !== 'string' || !s.ref.trim()) continue;
    servers.push({
      ref: s.ref.trim(),
      name: typeof s.name === 'string' ? s.name.trim() : '',
      lang: typeof s.lang === 'string' && s.lang.trim() ? s.lang.trim() : null,
    });
  }
  if (servers.length === 0) return null;

  const baseHrefMatch = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  let resolvedBaseUrl = `${parsedUrl.origin}/`;
  if (baseHrefMatch?.[1]) {
    try {
      resolvedBaseUrl = new URL(baseHrefMatch[1].trim(), parsedUrl.origin).toString();
    } catch {
      resolvedBaseUrl = `${parsedUrl.origin}/`;
    }
  }

  const candidates: string[] = [];
  const pushBase = (urlCandidate: string) => {
    try {
      const u = new URL(urlCandidate, resolvedBaseUrl).toString();
      if (!candidates.includes(u)) {
        candidates.push(u);
      }
    } catch {
      // ignore invalid
    }
  };

  const usesPlPrefix =
    /pl\/api\.php/i.test(html) || /vidsrc\.buzz/i.test(parsedUrl.hostname);

  if (usesPlPrefix) {
    pushBase(`${parsedUrl.origin}/pl/api.php`);
    pushBase(new URL('api.php', resolvedBaseUrl).toString());
    pushBase(`${parsedUrl.origin}/api.php`);
  } else {
    pushBase(new URL('api.php', resolvedBaseUrl).toString());
    pushBase(`${parsedUrl.origin}/api.php`);
    pushBase(`${parsedUrl.origin}/pl/api.php`);
  }

  return {
    token,
    playApiBases: candidates,
    servers,
  };
}

