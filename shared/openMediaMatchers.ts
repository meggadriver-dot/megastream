export interface ArchiveSearchDocInput {
  identifier?: string;
  title?: string | string[];
  description?: string | string[];
  language?: string | string[];
  subject?: string | string[];
  year?: string | number;
  date?: string;
  downloads?: number;
}

export interface ArchiveFileInput {
  name?: string;
  source?: string;
  format?: string;
  size?: string | number;
  length?: string | number;
}

export interface DailymotionVideoInput {
  id?: string;
  title?: string;
  duration?: number;
  language?: string;
  'owner.screenname'?: string;
}

const SHORT_OR_PROMO_RE =
  /\b(?:chamada|teaser|trailer|promo|resumo|melhores\s+momentos|trecho|cena|corte|clipe|videoclipe|music\s+video|abertura|encerramento|opening|ending|par[oó]dia|ytpbr|ytp|react|review|an[aá]lise|bastidores|making\s+of|entrevista|preview|mix|remix)\b/i;

const TITLE_STOPWORDS = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'the',
  'and',
  'of',
  'in',
  'to',
  'la',
  'el',
  'los',
  'las',
  'y',
]);

export function normalizeMediaSearchText(input?: string | null): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function extractMediaTitleTokens(input?: string | null): string[] {
  const norm = normalizeMediaSearchText(input);
  if (!norm) return [];
  const all = norm.split(/\s+/).filter(Boolean);
  const meaningful = all.filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w));
  return meaningful.length > 0 ? meaningful : all;
}

export function stripDatesFromEpisodeTitle(input: string): string {
  return (input || '')
    // Strip explicit bracketed/parenthetical or slash/dash calendar dates: (25/07/13), (25-03-14), 16/08/2013
    .replace(/\(\s*\d{1,2}\s*[/._-]\s*\d{1,2}\s*[/._-]\s*\d{2,4}\s*\)/g, ' ')
    .replace(/\b\d{1,2}\s*[/._-]\s*\d{1,2}\s*[/._-]\s*\d{2,4}\b/g, ' ')
    .replace(/\b(?:19|20)\d{2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{1,2}\b/g, ' ');
}

function toJoinedString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map((v) => String(v ?? '')).join(' ');
  return '';
}

function hasStrongTitleMatch(
  candidateText: string,
  titleVariants: string[]
): { matched: boolean; score: number } {
  const normCandidate = normalizeMediaSearchText(candidateText);
  if (!normCandidate) return { matched: false, score: 0 };
  const candidateTokens = new Set(normCandidate.split(/\s+/).filter(Boolean));

  let bestScore = 0;
  for (const rawTitle of titleVariants) {
    const normTitle = normalizeMediaSearchText(rawTitle);
    if (!normTitle || normTitle.length < 2) continue;

    if (
      normCandidate === normTitle ||
      normCandidate.startsWith(`${normTitle} `) ||
      normCandidate.includes(` ${normTitle} `) ||
      normCandidate.endsWith(` ${normTitle}`)
    ) {
      bestScore = Math.max(bestScore, 1.0);
      continue;
    }

    // Also allow compact match without spaces/punctuation (e.g. "euapatroaeascriancass01e01")
    const compactCandidate = normCandidate.replace(/\s+/g, '');
    const compactTitle = normTitle.replace(/\s+/g, '');
    if (compactTitle.length >= 6 && compactCandidate.includes(compactTitle)) {
      bestScore = Math.max(bestScore, 0.95);
      continue;
    }

    const tokens = extractMediaTitleTokens(rawTitle);
    if (tokens.length === 0) continue;
    let hits = 0;
    for (const t of tokens) {
      if (candidateTokens.has(t)) hits += 1;
    }
    const ratio = hits / tokens.length;
    if ((tokens.length <= 2 && hits === tokens.length) || (tokens.length >= 3 && ratio >= 0.8)) {
      bestScore = Math.max(bestScore, ratio * 0.9);
    }
  }

  return { matched: bestScore >= 0.72, score: bestScore };
}

function hasConflictingYear(
  textWithoutDates: string,
  targetYear: string | null | undefined,
  titleVariants: string[],
  mediaType: 'movie' | 'tv' = 'movie'
): boolean {
  if (!targetYear || !/^\d{4}$/.test(targetYear)) return false;
  const targetNum = Number(targetYear);
  const titleMentionsYear = titleVariants.some((t) => t.includes(targetYear));
  const yearsInCandidate = Array.from(
    textWithoutDates.matchAll(/\b((?:19|20)\d{2})\b/g)
  ).map((m) => Number(m[1]));

  if (yearsInCandidate.length === 0) return false;
  if (yearsInCandidate.includes(targetNum)) return false;

  for (const y of yearsInCandidate) {
    if (titleMentionsYear && y === targetNum) continue;
    if (mediaType === 'tv') {
      // Subsequent TV seasons air in later years (e.g. Chaves 1971 -> Season 3 in 1975)
      if (y < targetNum - 1 || y > targetNum + 20) {
        return true;
      }
    } else if (Math.abs(y - targetNum) >= 2) {
      return true;
    }
  }
  return false;
}

export function detectArchiveDocLanguage(doc: ArchiveSearchDocInput): {
  langCode: 'pt-br' | 'en-us' | 'es-es' | 'auto';
  languageLabel: string;
} {
  const combined = [
    toJoinedString(doc.language),
    doc.identifier || '',
    toJoinedString(doc.title),
    toJoinedString(doc.description),
    toJoinedString(doc.subject),
  ]
    .join(' ')
    .toLowerCase();

  if (
    /\b(?:portuguese|portugu[eê]s|pt-?br|dublad[oa]|paixaoflix|sbt|globo|novela|temporada)\b/i.test(
      combined
    ) ||
    /eu[,\s_-]*a[\s_-]*patroa|todo[\s_-]*mundo[\s_-]*odeia|\be\.?p\.?c\b|\bchaves\b|\bchapolin\b|\bchiquititas\b/i.test(
      combined
    )
  ) {
    return { langCode: 'pt-br', languageLabel: 'Dublado (PT-BR)' };
  }

  if (/\b(?:spanish|espa[nñ]ol|latino|castellano)\b/i.test(combined)) {
    return { langCode: 'es-es', languageLabel: 'Espanhol' };
  }

  if (/\b(?:english|ingl[eê]s|complete\s+series)\b/i.test(combined)) {
    return { langCode: 'en-us', languageLabel: 'Inglês / Original' };
  }

  return { langCode: 'auto', languageLabel: 'Inglês / Original' };
}

export function scoreArchiveSearchDoc(
  doc: ArchiveSearchDocInput,
  params: {
    titles: string[];
    releaseYear?: string | null;
    mediaType: 'movie' | 'tv';
    season?: number | null;
    preferPortuguese?: boolean;
  }
): number {
  const idStr = (doc.identifier || '').trim();
  if (!idStr) return -1;

  const titleStr = toJoinedString(doc.title);
  const descStr = toJoinedString(doc.description);
  const subjStr = toJoinedString(doc.subject);
  const combinedText = `${titleStr} ${descStr} ${subjStr} ${idStr}`;

  if (SHORT_OR_PROMO_RE.test(titleStr) || /\b(?:animated|animado)\b/i.test(titleStr)) {
    const wantedAnimated = params.titles.some((t) => /\b(?:animated|animado)\b/i.test(t));
    if (!wantedAnimated) return -1;
  }

  const titleMatch = hasStrongTitleMatch(`${titleStr} ${idStr.replace(/[_.-]+/g, ' ')}`, params.titles);
  const descMatch = hasStrongTitleMatch(descStr, params.titles);
  if (!titleMatch.matched && !descMatch.matched) return -1;

  // For TV series check season indicator if item explicitly names a DIFFERENT single season
  if (params.mediaType === 'tv' && params.season && params.season > 0) {
    const cleanTitleAndId = `${titleStr} ${idStr.replace(/[_.-]+/g, ' ')}`;
    const explicitSeasonMatch =
      cleanTitleAndId.match(
        /\b(?:season|temporada|temp\.?)\s*0*(\d{1,2})\b|\b0*(\d{1,2})\s*[ªa°]?\s*(?:temporada|temp)\b|\bs\s*0*(\d{1,2})(?:\s*e\s*\d{1,3}|\b)/i
      );
    const hasCompleteMulti =
      /\b(?:complete\s+series|completo|todas\s+as\s+temporadas)\b/i.test(cleanTitleAndId) &&
      !/\bs\s*0*\d{1,2}\s*e\s*\d{1,3}\b/i.test(cleanTitleAndId);
    if (explicitSeasonMatch && !hasCompleteMulti) {
      const docSeason = Number(
        explicitSeasonMatch[1] || explicitSeasonMatch[2] || explicitSeasonMatch[3]
      );
      if (docSeason > 0 && docSeason !== params.season) {
        return -1;
      }
    }
  }

  if (
    hasConflictingYear(
      stripDatesFromEpisodeTitle(titleStr),
      params.releaseYear,
      params.titles,
      params.mediaType
    )
  ) {
    return -1;
  }

  let score = titleMatch.matched ? 100 * titleMatch.score : 65 * descMatch.score;
  const lang = detectArchiveDocLanguage(doc);
  if (params.preferPortuguese !== false && lang.langCode === 'pt-br') {
    score += 45;
  }
  if (/paixaoflix/i.test(idStr)) {
    score += 35;
  }
  if (params.mediaType === 'tv' && params.season) {
    const seasonRe = new RegExp(
      `(?:temporada\\s*0*${params.season}|0*${params.season}[ªa°]?\\s*temporada|season\\s*0*${params.season}|s0*${params.season}\\b|temp\\.?\\s*0*${params.season})`,
      'i'
    );
    if (seasonRe.test(`${titleStr} ${idStr}`)) {
      score += 30;
    }
  }
  if (typeof doc.downloads === 'number' && doc.downloads > 0) {
    score += Math.min(20, Math.log10(doc.downloads + 1) * 5);
  }
  return score;
}

function parseArchiveDurationSeconds(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function extractEpisodeInfoFromFilename(filename: string): {
  season: number | null;
  episode: number | null;
} {
  const clean = stripDatesFromEpisodeTitle(filename).replace(/_/g, ' ');

  const seMatch = clean.match(
    /(?:^|[^a-z0-9])[st]\s*[-._]?\s*(\d{1,2})\s*[-._\s]*e(?:p|pis[oó]dio)?\s*[-._]?\s*(\d{1,3})(?:[^0-9]|$)/i
  );
  if (seMatch) {
    return { season: Number(seMatch[1]), episode: Number(seMatch[2]) };
  }

  const xMatch = clean.match(/(?:^|[^0-9])(\d{1,2})\s*x\s*(\d{1,3})(?:[^0-9]|$)/i);
  if (xMatch) {
    return { season: Number(xMatch[1]), episode: Number(xMatch[2]) };
  }

  const epOnlyMatch = clean.match(
    /\b(?:ep(?:is[oó]dio|isode)?|cap(?:[ií]tulo)?)\s*[-._#:]?\s*(\d{1,3})(?:[^0-9]|$)/i
  );
  if (epOnlyMatch) {
    return { season: null, episode: Number(epOnlyMatch[1]) };
  }

  const leadingNum = clean.match(/^(?:\s*)(\d{1,3})\s*[-._\s]/);
  if (leadingNum) {
    return { season: null, episode: Number(leadingNum[1]) };
  }

  return { season: null, episode: null };
}

export function matchArchiveEpisodeFile(
  files: ArchiveFileInput[],
  params: {
    mediaType: 'movie' | 'tv';
    season?: number | null;
    episode?: number | null;
    docTitle?: string;
    docIdentifier?: string;
  }
): ArchiveFileInput | null {
  if (!Array.isArray(files) || files.length === 0) return null;

  const minSize = params.mediaType === 'movie' ? 120_000_000 : 25_000_000;
  const minDuration = params.mediaType === 'movie' ? 2400 : 360;

  const mp4Candidates = files.filter((f) => {
    const name = (f.name || '').trim();
    if (!name || !/\.(?:mp4|mkv|m4v|webm|mov|ogv)$/i.test(name)) return false;
    if (SHORT_OR_PROMO_RE.test(name)) return false;
    const size = Number(f.size || 0);
    const lengthSec = parseArchiveDurationSeconds(f.length);
    if (size > 0 && size < minSize && lengthSec > 0 && lengthSec < minDuration) return false;
    if (size > 0 && size < minSize && lengthSec === 0) return false;
    if (size === 0 && lengthSec > 0 && lengthSec < minDuration) return false;
    return true;
  });

  if (mp4Candidates.length === 0) return null;

  if (params.mediaType === 'movie') {
    const scored = mp4Candidates
      .map((f) => {
        const name = f.name || '';
        const isIa = /\.ia\.mp4$/i.test(name) || /h\.264\s*ia/i.test(f.format || '');
        const isOrig = f.source === 'original';
        const isMpeg4 = /mpeg4|h\.264/i.test(f.format || '') || /\.(?:mp4|m4v|webm)$/i.test(name);
        const isMkv = /\.mkv$/i.test(name);
        const size = Number(f.size || 0);
        let score = 0;
        if (isMpeg4) score += 50;
        if (isMkv) score -= 15;
        if (isOrig) score += 30;
        if (!isIa) score += 20;
        score += Math.min(20, size / 200_000_000);
        return { f, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.f || null;
  }

  const targetSeason = params.season ?? 1;
  const targetEpisode = params.episode ?? 1;
  const docContext = `${params.docTitle || ''} ${(params.docIdentifier || '').replace(/[_.-]+/g, ' ')}`;
  const hasCompleteMulti =
    /\b(?:complete\s+series|completo|todas\s+as\s+temporadas)\b/i.test(docContext) &&
    !/\bs\s*0*\d{1,2}\s*e\s*\d{1,3}\b/i.test(docContext);
  const docSeasonMatch = hasCompleteMulti
    ? null
    : docContext.match(
        /\b(?:season|temporada|temp\.?)\s*0*(\d{1,2})\b|\b0*(\d{1,2})\s*[ªa°]?\s*(?:temporada|temp)\b|\bs\s*0*(\d{1,2})(?:\s*e\s*\d{1,3}|\b)/i
      );
  const docExplicitSeason = docSeasonMatch
    ? Number(docSeasonMatch[1] || docSeasonMatch[2] || docSeasonMatch[3])
    : null;

  const matched = mp4Candidates
    .map((f) => {
      const name = f.name || '';
      const info = extractEpisodeInfoFromFilename(name);
      if (info.episode !== targetEpisode) return null;

      if (info.season !== null) {
        if (info.season !== targetSeason) return null;
      } else if (docExplicitSeason !== null) {
        if (docExplicitSeason !== targetSeason) return null;
      } else if (targetSeason !== 1) {
        return null;
      }

      const isIa = /\.ia\.mp4$/i.test(name) || /h\.264\s*ia/i.test(f.format || '');
      const isOrig = f.source === 'original';
      const is720Or1080 = /(?:720p|1080p)/i.test(name);
      let score = 100;
      if (info.season === targetSeason) score += 40;
      if (isOrig) score += 25;
      if (!isIa) score += 20;
      if (is720Or1080) score += 10;
      return { f, score };
    })
    .filter((item): item is { f: ArchiveFileInput; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  return matched[0]?.f || null;
}

export function extractDailymotionEpisodeNumber(
  videoTitle: string,
  expectedSeason = 1
): { matched: boolean; hasExplicitSeason: boolean } {
  const cleaned = stripDatesFromEpisodeTitle(videoTitle || '');

  const seMatch = cleaned.match(
    /(?:^|[^a-z0-9])[st]\s*0*(\d{1,2})\s*[-._\s]*e(?:p|pis[oó]dio)?\s*0*(\d{1,4})(?:[^0-9]|$)/i
  );
  if (seMatch) {
    return {
      matched: Number(seMatch[1]) === expectedSeason,
      hasExplicitSeason: true,
    };
  }

  const tempEpMatch = cleaned.match(
    /\btemporada\s*0*(\d{1,2})\b[\s\-:|]*\b(?:ep(?:is[oó]dio)?|cap(?:[ií]tulo)?)\s*0*(\d{1,4})\b/i
  );
  if (tempEpMatch) {
    return {
      matched: Number(tempEpMatch[1]) === expectedSeason,
      hasExplicitSeason: true,
    };
  }

  return { matched: expectedSeason === 1, hasExplicitSeason: false };
}

export function extractChapterOrEpisodeFromTitle(
  videoTitle: string,
  expectedSeason = 1
): number | null {
  const cleaned = stripDatesFromEpisodeTitle(videoTitle || '');

  const seMatch = cleaned.match(
    /(?:^|[^a-z0-9])[st]\s*0*(\d{1,2})\s*[-._\s]*e(?:p|pis[oó]dio)?\s*0*(\d{1,4})(?:[^0-9]|$)/i
  );
  if (seMatch) {
    return Number(seMatch[1]) === expectedSeason ? Number(seMatch[2]) : null;
  }

  const tempEpMatch = cleaned.match(
    /\btemporada\s*0*(\d{1,2})\b[\s\-:|]*\b(?:ep(?:is[oó]dio)?|cap(?:[ií]tulo)?)\s*0*(\d{1,4})\b/i
  );
  if (tempEpMatch) {
    return Number(tempEpMatch[1]) === expectedSeason ? Number(tempEpMatch[2]) : null;
  }

  const capOrEp = cleaned.match(
    /\b(?:cap[ií]tulo|capitulo|cap\.?|epis[oó]dio|episodio|ep\.?|episode)\s*[-.:#]?\s*0*(\d{1,4})\b/i
  );
  if (capOrEp) {
    return expectedSeason === 1 ? Number(capOrEp[1]) : null;
  }

  return null;
}

export function selectBestDailymotionVideos(
  videos: DailymotionVideoInput[],
  params: {
    titles: string[];
    releaseYear?: string | null;
    mediaType: 'movie' | 'tv';
    season?: number | null;
    episode?: number | null;
  }
): Array<DailymotionVideoInput & { langCode: 'pt-br' | 'es-es' | 'en-us'; score: number }> {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  const minDuration = params.mediaType === 'movie' ? 3300 : 720;
  const targetSeason = params.season ?? 1;
  const targetEpisode = params.episode ?? 1;

  const scored: Array<
    DailymotionVideoInput & { langCode: 'pt-br' | 'es-es' | 'en-us'; score: number }
  > = [];

  for (const v of videos) {
    const id = (v.id || '').trim();
    const title = (v.title || '').trim();
    const duration = typeof v.duration === 'number' ? v.duration : 0;
    if (!id || !title || duration < minDuration) continue;
    if (SHORT_OR_PROMO_RE.test(title)) continue;

    const wantedAnimated = params.titles.some((t) => /\b(?:animado|animated)\b/i.test(t));
    if (!wantedAnimated && /\b(?:animado|animated)\b/i.test(title)) continue;

    const cleanedForDate = stripDatesFromEpisodeTitle(title);
    const titleMatch = hasStrongTitleMatch(cleanedForDate, params.titles);
    if (!titleMatch.matched) continue;

    let parsedEp: number | null = null;
    if (params.mediaType === 'tv') {
      parsedEp = extractChapterOrEpisodeFromTitle(title, targetSeason);
      if (parsedEp !== targetEpisode) continue;
    } else {
      if (!/\b(?:completo|full\s+movie|dublado|pel[ií]cula\s+completa)\b/i.test(title) && duration < 4200) {
        continue;
      }
    }

    const isPtChapterUpload =
      params.mediaType === 'tv' &&
      parsedEp === targetEpisode &&
      duration >= 1500 &&
      titleMatch.score >= 0.95 &&
      (/\b(?:cap[ií]tulo|capitulo|cap\.?|sbt|novela|completo|dublado)\b/i.test(title) ||
        v.language === 'pt');

    const yearConflicts = hasConflictingYear(
      cleanedForDate,
      params.releaseYear,
      params.titles,
      params.mediaType
    );
    if (yearConflicts && !isPtChapterUpload) {
      continue;
    }

    let langCode: 'pt-br' | 'es-es' | 'en-us' = 'pt-br';
    if (
      /\b(?:cap[ií]tulo|capitulo|epis[oó]dio|temporada|dublado|completo|sbt|globo|novela|portugu[eê]s)\b/i.test(
        title
      ) ||
      v.language === 'pt'
    ) {
      langCode = 'pt-br';
    } else if (/\b(?:espa[nñ]ol|latino|castellano|subtitulado|pel[ií]cula)\b/i.test(title)) {
      langCode = 'es-es';
    } else {
      langCode = 'en-us';
    }

    let score = titleMatch.score * 100;
    if (langCode === 'pt-br') score += 40;
    if (/\bcompleto\b/i.test(title)) score += 20;
    if (params.releaseYear && title.includes(params.releaseYear)) score += 25;
    if (yearConflicts) score -= 20;
    if (duration >= 1800) score += 10;

    scored.push({
      ...v,
      id,
      langCode,
      score,
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}

export interface FreeApiMovieResultInput {
  id?: string | null;
  title?: string | null;
  type?: string | null;
  year?: number | string | null;
  yearEnd?: number | string | null;
  rank?: number | null;
  cast?: string | null;
  poster?: string | null;
  watchUrl?: string | null;
  imdbUrl?: string | null;
}

export interface FreeApiAnimeResultInput {
  id?: number | null;
  title?: string | null;
  romaji?: string | null;
  format?: string | null;
  year?: number | string | null;
  episodes?: number | null;
  score?: number | null;
}

export function resolveFreeApiUrl(rawPathOrUrl?: string | null): string | null {
  const raw = (rawPathOrUrl || '').trim();
  if (!raw) return null;
  try {
    const resolved = new URL(raw, 'https://freeapi.pro/');
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export function selectBestFreeApiMovieMatch(
  results: FreeApiMovieResultInput[],
  criteria: {
    imdbId?: string | null;
    titles?: Array<string | null | undefined>;
    releaseYear?: string | number | null;
    mediaType?: 'movie' | 'tv';
  }
): (FreeApiMovieResultInput & { imdbId: string; normalizedMediaType: 'movie' | 'tv' }) | null {
  if (!Array.isArray(results) || results.length === 0) return null;

  const targetImdb = (criteria.imdbId || '').trim().toLowerCase();
  const targetYear = Number(String(criteria.releaseYear || '').slice(0, 4)) || 0;
  const targetTitles = (criteria.titles || [])
    .map((t) => normalizeMediaSearchText(t || ''))
    .filter(Boolean);

  let best: {
    item: FreeApiMovieResultInput;
    imdbId: string;
    normalizedMediaType: 'movie' | 'tv';
    score: number;
  } | null = null;

  for (const item of results) {
    const rawId = (item?.id || '').trim().toLowerCase();
    if (!/^tt\d{5,12}$/.test(rawId)) continue;

    const rawType = (item.type || '').trim().toLowerCase();
    const isTvType = /(?:tv series|mini series|tv mini series|tv special)/i.test(rawType);
    const isShortType = rawType === 'short';
    const normalizedMediaType: 'movie' | 'tv' = isTvType ? 'tv' : 'movie';

    if (targetImdb && rawId === targetImdb) {
      return { ...item, imdbId: rawId, normalizedMediaType };
    }

    if (criteria.mediaType === 'tv' && !isTvType) continue;
    if (criteria.mediaType === 'movie' && isTvType) continue;

    const candNorm = normalizeMediaSearchText(item.title || '');
    if (!candNorm && targetTitles.length > 0) continue;

    let score = 0;
    if (targetTitles.length > 0) {
      let bestTitleScore = 0;
      for (const tn of targetTitles) {
        if (candNorm === tn) {
          bestTitleScore = Math.max(bestTitleScore, 100);
        } else if (candNorm.includes(tn) || tn.includes(candNorm)) {
          const overlapRatio =
            Math.min(candNorm.length, tn.length) / Math.max(candNorm.length, tn.length, 1);
          bestTitleScore = Math.max(bestTitleScore, 60 + Math.round(overlapRatio * 30));
        } else {
          const tnTokens = extractMediaTitleTokens(tn);
          const candTokens = new Set(extractMediaTitleTokens(candNorm));
          if (tnTokens.length > 0) {
            const matchedCount = tnTokens.filter((tok) => candTokens.has(tok)).length;
            if (matchedCount === tnTokens.length) {
              bestTitleScore = Math.max(bestTitleScore, 75);
            } else if (matchedCount / tnTokens.length >= 0.75) {
              bestTitleScore = Math.max(bestTitleScore, 55);
            }
          }
        }
      }
      if (bestTitleScore === 0) continue;
      score += bestTitleScore;
    }

    const candYear = Number(item.year) || 0;
    if (targetYear > 0 && candYear > 0) {
      const diff = Math.abs(targetYear - candYear);
      if (diff === 0) score += 40;
      else if (diff === 1) score += 20;
      else if (diff > 2) {
        if (score < 100) continue;
        score -= 45;
      }
    }

    if (isShortType) score -= 30;
    if (typeof item.rank === 'number' && item.rank > 0) {
      score += Math.max(0, 20 - Math.floor(Math.log10(item.rank) * 3));
    }

    if (!best || score > best.score) {
      best = { item, imdbId: rawId, normalizedMediaType, score };
    }
  }

  if (!best || best.score < 55) return null;
  return {
    ...best.item,
    imdbId: best.imdbId,
    normalizedMediaType: best.normalizedMediaType,
  };
}

export function selectBestFreeApiAnimeMatch(
  results: FreeApiAnimeResultInput[],
  criteria: {
    titles?: Array<string | null | undefined>;
    releaseYear?: string | number | null;
    mediaType?: 'movie' | 'tv';
  }
): FreeApiAnimeResultInput | null {
  if (!Array.isArray(results) || results.length === 0) return null;

  const targetYear = Number(String(criteria.releaseYear || '').slice(0, 4)) || 0;
  const targetTitles = (criteria.titles || [])
    .map((t) => normalizeMediaSearchText(t || ''))
    .filter(Boolean);

  let best: { item: FreeApiAnimeResultInput; score: number } | null = null;

  for (const item of results) {
    if (!item?.id || typeof item.id !== 'number') continue;
    const fmt = (item.format || '').trim().toUpperCase();
    const isMovieFmt = fmt === 'MOVIE';
    if (criteria.mediaType === 'movie' && fmt && !isMovieFmt && fmt !== 'OVA' && fmt !== 'SPECIAL') {
      continue;
    }
    if (criteria.mediaType === 'tv' && isMovieFmt) {
      continue;
    }

    const candTitles = [item.title, item.romaji]
      .map((t) => normalizeMediaSearchText(t || ''))
      .filter(Boolean);
    if (candTitles.length === 0) continue;

    let titleScore = 0;
    for (const tn of targetTitles) {
      for (const cn of candTitles) {
        if (cn === tn) {
          titleScore = Math.max(titleScore, 100);
        } else if (cn.includes(tn) || tn.includes(cn)) {
          const ratio = Math.min(cn.length, tn.length) / Math.max(cn.length, tn.length, 1);
          titleScore = Math.max(titleScore, 60 + Math.round(ratio * 30));
        }
      }
    }
    if (targetTitles.length > 0 && titleScore === 0) continue;

    let score = titleScore;
    const candYear = Number(item.year) || 0;
    if (targetYear > 0 && candYear > 0) {
      const diff = Math.abs(targetYear - candYear);
      if (diff === 0) score += 35;
      else if (diff === 1) score += 15;
      else if (diff > 2) score -= 35;
    }
    if (typeof item.score === 'number') {
      score += Math.round(item.score / 10);
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best && best.score >= 55 ? best.item : null;
}

