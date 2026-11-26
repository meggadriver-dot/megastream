import type { CatalogSortBy, GenreItem, MediaItem, MediaType, PlanId, SubscriptionPlan } from './types.ts';

export interface CatalogFilterParams {
  mediaType?: 'all' | 'movie' | 'tv';
  genreId?: number | null;
  year?: number | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  minRating?: number | null;
  language?: string | null;
  country?: string | null;
  watchProvider?: number | null;
  sortBy?: CatalogSortBy;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface WatchProviderOption {
  id: number;
  name: string;
}

export const TMDB_BR_WATCH_PROVIDERS: WatchProviderOption[] = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Amazon Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 1899, name: 'Max' },
  { id: 307, name: 'Globoplay' },
  { id: 350, name: 'Apple TV+' },
  { id: 531, name: 'Paramount+' },
  { id: 283, name: 'Crunchyroll' },
  { id: 167, name: 'Claro video' },
  { id: 47, name: 'Looke' },
  { id: 11, name: 'MUBI' },
  { id: 2156, name: 'Mercado Play' },
];

export interface CatalogDecadeOption {
  id: string;
  label: string;
  yearFrom: number;
  yearTo: number;
}

export const CATALOG_DECADES: CatalogDecadeOption[] = [
  { id: '2020s', label: '2020 – Atual', yearFrom: 2020, yearTo: 2030 },
  { id: '2010s', label: 'Anos 2010', yearFrom: 2010, yearTo: 2019 },
  { id: '2000s', label: 'Anos 2000', yearFrom: 2000, yearTo: 2009 },
  { id: '1990s', label: 'Anos 90', yearFrom: 1990, yearTo: 1999 },
  { id: '1980s', label: 'Anos 80', yearFrom: 1980, yearTo: 1989 },
  { id: 'classic', label: 'Clássicos (até 1979)', yearFrom: 1900, yearTo: 1979 },
];

/**
 * TMDB uses different genre IDs for equivalent concepts between Movies and TV
 * (e.g. Action=28 in Movie vs Action & Adventure=10759 in TV).
 */
const MOVIE_TO_TV_GENRE_MAP: Record<number, number | null> = {
  28: 10759, // Ação -> Action & Adventure
  12: 10759, // Aventura -> Action & Adventure
  14: 10765, // Fantasia -> Sci-Fi & Fantasy
  878: 10765, // Ficção científica -> Sci-Fi & Fantasy
  10752: 10768, // Guerra -> War & Politics
  27: 9648, // Terror -> Mistério/Suspense (closest TV match)
  53: 9648, // Suspense -> Mistério
  10749: 18, // Romance -> Drama
  36: 99, // História -> Documentário
  10402: null, // Música (Movie-only)
  10770: null, // Cinema TV (Movie-only)
};

const TV_TO_MOVIE_GENRE_MAP: Record<number, number | null> = {
  10759: 28, // Action & Adventure -> Ação
  10765: 878, // Sci-Fi & Fantasy -> Ficção científica
  10768: 10752, // War & Politics -> Guerra
  10762: 10751, // Kids -> Família
  10766: null, // Soap / Novelas (TV-only)
  10764: null, // Reality (TV-only)
  10763: null, // News (TV-only)
  10767: null, // Talk (TV-only)
};

export function resolveTmdbGenreForMediaType(
  genreId: number | null | undefined,
  targetType: MediaType
): { genreId: number | undefined; compatible: boolean } {
  if (!genreId || !Number.isFinite(genreId)) {
    return { genreId: undefined, compatible: true };
  }
  if (targetType === 'tv') {
    if (Object.prototype.hasOwnProperty.call(MOVIE_TO_TV_GENRE_MAP, genreId)) {
      const mapped = MOVIE_TO_TV_GENRE_MAP[genreId];
      return mapped ? { genreId: mapped, compatible: true } : { genreId: undefined, compatible: false };
    }
    return { genreId, compatible: true };
  }
  if (Object.prototype.hasOwnProperty.call(TV_TO_MOVIE_GENRE_MAP, genreId)) {
    const mapped = TV_TO_MOVIE_GENRE_MAP[genreId];
    return mapped ? { genreId: mapped, compatible: true } : { genreId: undefined, compatible: false };
  }
  return { genreId, compatible: true };
}

export function mergeUnifiedTmdbGenres(movieGenres: GenreItem[], tvGenres: GenreItem[]): GenreItem[] {
  const byId = new Map<number, GenreItem>();
  for (const g of movieGenres) {
    if (g?.id && g?.name) byId.set(g.id, g);
  }
  const tvLabels: Record<number, string> = {
    10766: 'Novelas (Soap)',
    10762: 'Infantil (Kids)',
    10764: 'Reality Show',
    10767: 'Talk Show',
    10763: 'Notícias',
    10759: 'Ação e Aventura (Séries)',
    10765: 'Sci-Fi e Fantasia (Séries)',
    10768: 'Guerra e Política (Séries)',
  };
  for (const g of tvGenres) {
    if (!g?.id || !g?.name) continue;
    if (!byId.has(g.id)) {
      byId.set(g.id, { id: g.id, name: tvLabels[g.id] || g.name });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export type ParsedCatalogSearchTarget =
  | { kind: 'imdb'; imdbId: string }
  | { kind: 'tmdb_typed'; mediaType: MediaType; tmdbId: number }
  | { kind: 'tmdb_numeric'; tmdbId: number; rawQuery: string }
  | { kind: 'text'; rawQuery: string };

export function parseCatalogSearchTarget(raw: string): ParsedCatalogSearchTarget {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'text', rawQuery: '' };

  // Full TMDB URLs: https://www.themoviedb.org/tv/47-el-chavo-del-ocho or /movie/550
  const tmdbUrlMatch = trimmed.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdbUrlMatch) {
    return {
      kind: 'tmdb_typed',
      mediaType: tmdbUrlMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie',
      tmdbId: Number(tmdbUrlMatch[2]),
    };
  }

  // Explicit prefix: movie/550, tv/47, tmdb:movie:550, tmdb:47
  const typedMatch = trimmed.match(/^(?:tmdb:)?(movie|tv)[/:](\d+)$/i);
  if (typedMatch) {
    return {
      kind: 'tmdb_typed',
      mediaType: typedMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie',
      tmdbId: Number(typedMatch[2]),
    };
  }

  // IMDb ID: tt0903747
  const imdbMatch = trimmed.match(/^(tt\d{5,12})$/i);
  if (imdbMatch) {
    return { kind: 'imdb', imdbId: imdbMatch[1].toLowerCase() };
  }

  // Bare TMDB ID (not a 4-digit year alone unless prefixed with #/tmdb:)
  const prefixedNumeric = trimmed.match(/^(?:#|tmdb:)(\d{1,8})$/i);
  if (prefixedNumeric) {
    return {
      kind: 'tmdb_numeric',
      tmdbId: Number(prefixedNumeric[1]),
      rawQuery: trimmed,
    };
  }

  if (/^\d{1,8}$/.test(trimmed)) {
    const num = Number(trimmed);
    // Keep bare 4-digit years like "1994" or "2024" as title/numeric dual lookup
    if (num > 0) {
      return { kind: 'tmdb_numeric', tmdbId: num, rawQuery: trimmed };
    }
  }

  return { kind: 'text', rawQuery: trimmed };
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Mensal',
    subtitle: 'Flexibilidade total para começar',
    priceBrl: 29.9,
    billingLabel: 'R$ 29,90 / mês',
    periodDays: 30,
    benefits: [
      'Acesso completo ao catálogo de filmes e séries',
      'IA Inteligente com recomendações personalizadas',
      'Sincronização de Minha Lista e Histórico na nuvem',
      'Sem fidelidade — cancele quando desejar',
    ],
  },
  {
    id: 'quarterly',
    name: 'Trimestral',
    subtitle: 'Mais popular · Melhor custo-benefício',
    priceBrl: 59.9,
    billingLabel: 'R$ 59,90 / 3 meses',
    periodDays: 90,
    popular: true,
    benefits: [
      'Economize 33% comparado ao plano mensal',
      'Acesso completo em smartphones, tablets e TVs',
      'Listas personalizadas ilimitadas com IA',
      'Prioridade nos novos recursos da plataforma',
    ],
  },
  {
    id: 'annual',
    name: 'Anual',
    subtitle: 'Experiência definitiva o ano inteiro',
    priceBrl: 199.9,
    billingLabel: 'R$ 199,90 / ano',
    periodDays: 365,
    benefits: [
      'Equivalente a mais de 2 meses grátis no ano',
      'Todos os 5 temas exclusivos desbloqueados',
      'Suporte prioritário e canais autorizados ao vivo',
      'Controle parental e múltiplos perfis de acesso',
    ],
  },
];

export function getPlanById(planId: PlanId): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? null;
}

export function sanitizePlainText(value: string, maxLength = 200): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function filterAndSortMedia(
  items: MediaItem[],
  filters: CatalogFilterParams
): { items: MediaItem[]; totalResults: number; totalPages: number; page: number } {
  const query = (filters.query ?? '').trim().toLowerCase();
  const pageSize = Math.max(1, Math.min(40, filters.pageSize ?? 20));
  const requestedPage = Math.max(1, filters.page ?? 1);

  const filtered = items.filter((item) => {
    if (filters.mediaType && filters.mediaType !== 'all' && item.mediaType !== filters.mediaType) {
      return false;
    }
    if (filters.genreId) {
      const resolved = resolveTmdbGenreForMediaType(filters.genreId, item.mediaType);
      if (!resolved.compatible) return false;
      if (resolved.genreId && !item.genreIds.includes(resolved.genreId) && !item.genreIds.includes(filters.genreId)) {
        return false;
      }
    }
    const itemYear = Number(item.releaseYear);
    if (filters.year && itemYear !== filters.year) {
      return false;
    }
    if (filters.yearFrom && (!Number.isFinite(itemYear) || itemYear < filters.yearFrom)) {
      return false;
    }
    if (filters.yearTo && (!Number.isFinite(itemYear) || itemYear > filters.yearTo)) {
      return false;
    }
    if (typeof filters.minRating === 'number' && filters.minRating > 0 && item.voteAverage < filters.minRating) {
      return false;
    }
    if (filters.language && filters.language !== 'all' && item.originalLanguage !== filters.language) {
      return false;
    }
    if (
      filters.country &&
      filters.country !== 'all' &&
      !(item.originCountry ?? []).includes(filters.country)
    ) {
      return false;
    }
    if (query) {
      const hay = `${item.title} ${item.originalTitle} ${item.overview} ${item.tmdbId}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === 'rating') {
      return b.voteAverage - a.voteAverage;
    }
    if (filters.sortBy === 'votes') {
      return b.voteCount - a.voteCount;
    }
    if (filters.sortBy === 'release_date') {
      return (b.releaseDate || '').localeCompare(a.releaseDate || '');
    }
    if (filters.sortBy === 'release_date_asc') {
      return (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');
    }
    if (filters.sortBy === 'title_asc') {
      return a.title.localeCompare(b.title, 'pt-BR');
    }
    return b.popularity - a.popularity;
  });

  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    totalResults,
    totalPages,
    page,
  };
}

export function deduplicateMediaByTmdbId(items: MediaItem[]): MediaItem[] {
  const seen = new Map<string, MediaItem>();
  for (const item of items) {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

export function formatRuntimeMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return 'Duração N/D';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}min`;
  return `${hrs}h ${mins}min`;
}

export function formatBrlCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
