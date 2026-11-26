import type { ChannelCategory } from './types.ts';

export const DIRECT_IPTV_PLAYLIST_URLS = {
  brazil: 'https://iptv-org.github.io/iptv/countries/br.m3u',
  plutoBrazil:
    'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_br.m3u',
  portuguese: 'https://iptv-org.github.io/iptv/languages/por.m3u',
  freeTvBrazil:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_brazil.m3u8',
  freeTvPortugal:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_portugal.m3u8',
  freeTvLatin:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_latin_america.m3u8',
  freeTvAnimation:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_animation.m3u8',
  freeTvMovies:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_movies.m3u8',
  freeTvSports:
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_sports.m3u8',
  categoryMovies: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
  categorySeries: 'https://iptv-org.github.io/iptv/categories/series.m3u',
  categoryAnimation: 'https://iptv-org.github.io/iptv/categories/animation.m3u',
  categorySports: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
  categoryKids: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
} as const;

export interface ParsedDirectChannelCandidate {
  url: string;
  qualityScore: number;
  isHttps: boolean;
}

export interface DirectChannelGroup {
  id: string;
  matchKey: string;
  matchKeys: string[];
  name: string;
  category: ChannelCategory;
  logoUrl?: string;
  groupTitle: string;
  candidates: ParsedDirectChannelCandidate[];
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function cleanDirectChannelDisplayName(rawName: string): string {
  let cleaned = String(rawName || '').trim();
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  cleaned = cleaned.replace(/\(\s*(?:1080p|720p|576p|480p|360p|240p|4k|uhd|hd|sd|fhd|brazil|brasil|portugal|pt-br|portuguese)\s*\)/gi, ' ');
  cleaned = cleaned.replace(/\b(?:Latin\s+America\s+Brazil|Latin\s+America)\b/gi, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned || String(rawName || '').trim();
}

export function normalizeChannelMatchKey(name: string): string {
  const cleaned = cleanDirectChannelDisplayName(name);
  const ascii = stripDiacritics(cleaned).toLowerCase();
  const strippedNoise = ascii
    .replace(/\b(?:brasil|brazil|portugal|latin america|latam|fhd|uhd|hd|sd|4k|1080p|720p|480p|360p)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
  return strippedNoise || ascii.replace(/[^a-z0-9]+/g, '');
}

export function buildChannelMatchKeys(name: string): string[] {
  const primary = normalizeChannelMatchKey(name);
  const keys: string[] = [];
  if (primary) keys.push(primary);
  const withoutTv = primary.replace(/^tv/, '').replace(/tv$/, '');
  if (withoutTv && withoutTv.length >= 3 && !keys.includes(withoutTv)) {
    keys.push(withoutTv);
  }
  return keys;
}

export function mapIptvGroupToChannelCategory(
  groupTitle?: string | null,
  name?: string | null
): ChannelCategory {
  const text = stripDiacritics(`${groupTitle || ''} ${name || ''}`).toLowerCase();
  if (/\b(sport|sports|esporte|esportes|futebol|nba|nfl|ufc|combat|combate|premiere|sportv|espn|bandsports)\b/.test(text)) {
    return 'Esportes';
  }
  if (/\b(news|noticias|noticia|jornal|cnn|bandnews|globonews|record news|bloomberg|jovem pan)\b/.test(text)) {
    return 'Notícias';
  }
  if (/\b(kids|children|animation|animacao|anime|infantil|desenho|cartoon|gloob|discovery kids|nick|disney)\b/.test(text)) {
    return 'Infantil';
  }
  if (/\b(movie|movies|cinema|filme|filmes|telecine|hbo|megapix|cine|axn|amc|tnt|space|warner|paramount|adrenalina)\b/.test(text)) {
    return 'Filmes';
  }
  if (/\b(series|novela|novelas|comedy|music|musica|culture|cultura|arte|multishow|gnt|viva)\b/.test(text)) {
    return 'Entretenimento';
  }
  return 'Variedades';
}

export function isDirectM3uChannelBlocked(
  rawName: string,
  groupTitle: string,
  streamUrl: string,
  includeAdult = false
): boolean {
  const url = String(streamUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return true;

  // Reject HTML web portals, YouTube, and StreamBetter wrappers so only direct media streams remain
  if (
    /(?:youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com|vimeo\.com|streambetter\.|reidoscanais\.)/i.test(
      url
    )
  ) {
    return true;
  }

  // Skip explicit geo-blocked / dead markers
  if (/\[(?:geo-blocked|offline|broken)\]/i.test(rawName)) {
    return true;
  }

  if (!includeAdult) {
    const haystack = `${rawName} ${groupTitle}`;
    if (
      /\b(?:adult|adulto|xxx|18\+|\+18|erotic|erotico|sexy\s*hot|playboy|hustler|private|sextreme|venus|brasileirinhas)\b/i.test(
        haystack
      )
    ) {
      return true;
    }
  }

  return false;
}

function scoreStreamCandidate(rawName: string, url: string): ParsedDirectChannelCandidate {
  const isHttps = url.toLowerCase().startsWith('https://');
  let qualityScore = isHttps ? 100 : 20;
  if (/1080p|fhd/i.test(rawName)) qualityScore += 30;
  else if (/720p|\bhd\b/i.test(rawName)) qualityScore += 20;
  else if (/480p|\bsd\b/i.test(rawName)) qualityScore += 10;
  if (/\.m3u8(?:$|\?)/i.test(url)) qualityScore += 25;
  if (/jmp2\.uk\/plu-|pluto\.tv|samsung|akamaized|cloudfront/i.test(url)) qualityScore += 15;
  if (/\[not 24\/7\]/i.test(rawName)) qualityScore -= 15;
  return { url, qualityScore, isHttps };
}

function extractExtinfAttr(extinfLine: string, attr: string): string {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const match = extinfLine.match(re);
  return match ? match[1].trim() : '';
}

export function parseDirectChannelM3u(
  playlistText: string,
  includeAdult = false
): DirectChannelGroup[] {
  if (!playlistText || typeof playlistText !== 'string') return [];

  const lines = playlistText.split(/\r?\n/);
  const groupsMap = new Map<string, DirectChannelGroup>();

  let pendingExtinf = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      pendingExtinf = line;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    if (!/^https?:\/\//i.test(line)) {
      pendingExtinf = '';
      continue;
    }

    const extinf = pendingExtinf;
    pendingExtinf = '';

    const commaIdx = extinf.lastIndexOf(',');
    const rawName = commaIdx >= 0 ? extinf.slice(commaIdx + 1).trim() : '';
    const groupTitle = extinf ? extractExtinfAttr(extinf, 'group-title') : '';
    const logoUrl = extinf ? extractExtinfAttr(extinf, 'tvg-logo') : '';

    if (!rawName || isDirectM3uChannelBlocked(rawName, groupTitle, line, includeAdult)) {
      continue;
    }

    const displayName = cleanDirectChannelDisplayName(rawName);
    const matchKey = normalizeChannelMatchKey(displayName);
    if (!matchKey || matchKey.length < 2) continue;

    const candidate = scoreStreamCandidate(rawName, line);
    const existing = groupsMap.get(matchKey);

    if (existing) {
      if (!existing.candidates.some((c) => c.url === candidate.url)) {
        existing.candidates.push(candidate);
        existing.candidates.sort((a, b) => b.qualityScore - a.qualityScore);
      }
      if (!existing.logoUrl && logoUrl && /^https?:\/\//i.test(logoUrl)) {
        existing.logoUrl = logoUrl;
      }
    } else {
      const safeLogo = logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : undefined;
      groupsMap.set(matchKey, {
        id: `direct_ch_${matchKey}`,
        matchKey,
        matchKeys: buildChannelMatchKeys(displayName),
        name: displayName,
        category: mapIptvGroupToChannelCategory(groupTitle, displayName),
        logoUrl: safeLogo,
        groupTitle,
        candidates: [candidate],
      });
    }
  }

  return Array.from(groupsMap.values());
}
