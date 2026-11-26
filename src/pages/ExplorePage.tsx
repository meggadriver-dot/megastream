import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  CATALOG_DECADES,
  TMDB_BR_WATCH_PROVIDERS,
  type WatchProviderOption,
} from '../../shared/catalogUtils';
import type {
  CatalogSortBy,
  GenreItem,
  MediaItem,
  PaginatedCatalogResponse,
} from '../../shared/types';
import { DemoBanner } from '../components/DemoBanner';
import { MediaCard } from '../components/MediaCard';
import { apiRequest } from '../services/apiClient';

interface QuickCategoryItem {
  id: string;
  label: string;
  type: 'all' | 'movie' | 'tv';
  genre: string;
  lang?: string;
  country?: string;
}

const QUICK_CATEGORIES: QuickCategoryItem[] = [
  { id: 'all', label: 'Todos', type: 'all', genre: '' },
  { id: 'movie', label: 'Filmes', type: 'movie', genre: '' },
  { id: 'tv', label: 'Séries', type: 'tv', genre: '' },
  { id: 'novelas', label: 'Novelas', type: 'tv', genre: '10766' },
  { id: 'animes', label: 'Animes', type: 'all', genre: '16', lang: 'ja' },
  { id: 'doramas', label: 'Doramas', type: 'tv', genre: '', country: 'KR' },
  { id: 'brasil', label: 'Brasil', type: 'all', genre: '', country: 'BR' },
  { id: '16', label: 'Animações', type: 'all', genre: '16' },
  { id: '10762', label: 'Infantil', type: 'tv', genre: '10762' },
  { id: '99', label: 'Documentários', type: 'all', genre: '99' },
  { id: '28', label: 'Ação', type: 'all', genre: '28' },
  { id: '12', label: 'Aventura', type: 'all', genre: '12' },
  { id: '35', label: 'Comédia', type: 'all', genre: '35' },
  { id: '18', label: 'Drama', type: 'all', genre: '18' },
  { id: '27', label: 'Terror', type: 'movie', genre: '27' },
  { id: '878', label: 'Ficção Científica', type: 'all', genre: '878' },
  { id: '14', label: 'Fantasia', type: 'all', genre: '14' },
  { id: '10749', label: 'Romance', type: 'all', genre: '10749' },
  { id: '53', label: 'Suspense', type: 'movie', genre: '53' },
  { id: '80', label: 'Crime', type: 'all', genre: '80' },
  { id: '9648', label: 'Mistério', type: 'all', genre: '9648' },
  { id: '10751', label: 'Família', type: 'all', genre: '10751' },
];

const VALID_SORTS: readonly CatalogSortBy[] = [
  'popularity',
  'rating',
  'votes',
  'release_date',
  'release_date_asc',
  'title_asc',
];

function parseSortParam(raw: string | null): CatalogSortBy {
  return raw && VALID_SORTS.includes(raw as CatalogSortBy) ? (raw as CatalogSortBy) : 'popularity';
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>(
    searchParams.get('type') === 'movie' || searchParams.get('type') === 'tv'
      ? (searchParams.get('type') as 'movie' | 'tv')
      : 'all'
  );
  const [genreId, setGenreId] = useState(searchParams.get('genre') || '');
  const [year, setYear] = useState(searchParams.get('year') || '');
  const [decade, setDecade] = useState(searchParams.get('decade') || '');
  const [provider, setProvider] = useState(searchParams.get('provider') || '');
  const [minRating, setMinRating] = useState(searchParams.get('rating') || '');
  const [language, setLanguage] = useState(searchParams.get('lang') || 'all');
  const [country, setCountry] = useState(searchParams.get('country') || 'all');
  const [sortBy, setSortBy] = useState<CatalogSortBy>(parseSortParam(searchParams.get('sort')));
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isFinite(p) && p >= 1 ? Math.min(500, Math.round(p)) : 1;
  });

  const [genres, setGenres] = useState<{
    movie: GenreItem[];
    tv: GenreItem[];
    unified?: GenreItem[];
    providers?: WatchProviderOption[];
  }>({
    movie: [],
    tv: [],
    unified: [],
    providers: TMDB_BR_WATCH_PROVIDERS,
  });
  const [items, setItems] = useState<MediaItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(
      searchParams.get('year') ||
        searchParams.get('decade') ||
        searchParams.get('provider') ||
        searchParams.get('rating') ||
        (searchParams.get('lang') && searchParams.get('lang') !== 'all') ||
        (searchParams.get('country') && searchParams.get('country') !== 'all')
    )
  );

  // Sync incoming URL changes (e.g. navigation from HomePage links or header search)
  useEffect(() => {
    const qUrl = searchParams.get('q') || '';
    const tRaw = searchParams.get('type');
    const tUrl: 'all' | 'movie' | 'tv' = tRaw === 'movie' || tRaw === 'tv' ? tRaw : 'all';
    const gUrl = searchParams.get('genre') || '';
    const yUrl = searchParams.get('year') || '';
    const dUrl = searchParams.get('decade') || '';
    const pUrl = searchParams.get('provider') || '';
    const rUrl = searchParams.get('rating') || '';
    const lUrl = searchParams.get('lang') || 'all';
    const cUrl = searchParams.get('country') || 'all';
    const sUrl = parseSortParam(searchParams.get('sort'));
    const pageRaw = Number(searchParams.get('page'));
    const pgUrl = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(500, Math.round(pageRaw)) : 1;

    setQuery(qUrl);
    setDebouncedQuery(qUrl);
    setMediaType(tUrl);
    setGenreId(gUrl);
    setYear(yUrl);
    setDecade(dUrl);
    setProvider(pUrl);
    setMinRating(rUrl);
    setLanguage(lUrl);
    setCountry(cUrl);
    setSortBy(sUrl);
    setPage(pgUrl);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery((prev) => {
        if (prev !== query) {
          setPage(1);
        }
        return query;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    apiRequest<{
      movie: GenreItem[];
      tv: GenreItem[];
      unified?: GenreItem[];
      providers?: WatchProviderOption[];
    }>('/api/genres')
      .then((res) =>
        setGenres({
          movie: res.movie ?? [],
          tv: res.tv ?? [],
          unified: res.unified ?? [],
          providers: res.providers ?? TMDB_BR_WATCH_PROVIDERS,
        })
      )
      .catch(() => {});
  }, []);

  const syncUrlParams = useCallback(
    (overrides: Partial<{
      q: string;
      type: 'all' | 'movie' | 'tv';
      genre: string;
      year: string;
      decade: string;
      provider: string;
      rating: string;
      lang: string;
      country: string;
      sort: CatalogSortBy;
      page: number;
    }>) => {
      const nextState = {
        q: overrides.q ?? query,
        type: overrides.type ?? mediaType,
        genre: overrides.genre ?? genreId,
        year: overrides.year ?? year,
        decade: overrides.decade ?? decade,
        provider: overrides.provider ?? provider,
        rating: overrides.rating ?? minRating,
        lang: overrides.lang ?? language,
        country: overrides.country ?? country,
        sort: overrides.sort ?? sortBy,
        page: overrides.page ?? page,
      };
      const next = new URLSearchParams();
      if (nextState.q.trim()) next.set('q', nextState.q.trim());
      if (nextState.type !== 'all') next.set('type', nextState.type);
      if (nextState.genre) next.set('genre', nextState.genre);
      if (nextState.year) next.set('year', nextState.year);
      if (nextState.decade) next.set('decade', nextState.decade);
      if (nextState.provider) next.set('provider', nextState.provider);
      if (nextState.rating) next.set('rating', nextState.rating);
      if (nextState.lang && nextState.lang !== 'all') next.set('lang', nextState.lang);
      if (nextState.country && nextState.country !== 'all') next.set('country', nextState.country);
      if (nextState.sort !== 'popularity') next.set('sort', nextState.sort);
      if (nextState.page > 1) next.set('page', String(nextState.page));
      setSearchParams(next, { replace: true });
    },
    [country, decade, genreId, language, mediaType, minRating, page, provider, query, setSearchParams, sortBy, year]
  );

  const fetchCatalog = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('type', mediaType);
        params.set('sortBy', sortBy);
        params.set('page', String(targetPage));
        if (genreId) params.set('genreId', genreId);
        if (year) {
          params.set('year', year);
        } else if (decade) {
          const d = CATALOG_DECADES.find((item) => item.id === decade);
          if (d) {
            params.set('yearFrom', String(d.yearFrom));
            params.set('yearTo', String(d.yearTo));
          }
        }
        if (provider) params.set('provider', provider);
        if (minRating) params.set('minRating', minRating);
        if (language !== 'all') params.set('language', language);
        if (country !== 'all') params.set('country', country);
        if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());

        const res = await apiRequest<PaginatedCatalogResponse>(
          `/api/discover?${params.toString()}`
        );
        setItems((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((m) => `${m.mediaType}-${m.tmdbId}`));
          const fresh = res.items.filter((m) => !seen.has(`${m.mediaType}-${m.tmdbId}`));
          return [...prev, ...fresh];
        });
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalResults(res.totalResults);
        setDemoMode(res.demoMode);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [country, debouncedQuery, decade, genreId, language, mediaType, minRating, provider, sortBy, year]
  );

  useEffect(() => {
    void fetchCatalog(page, false);
  }, [fetchCatalog, page]);

  const handleQuickCategory = (cat: QuickCategoryItem) => {
    const nextLang = cat.lang ?? 'all';
    const nextCountry = cat.country ?? 'all';
    setMediaType(cat.type);
    setGenreId(cat.genre);
    setLanguage(nextLang);
    setCountry(nextCountry);
    setPage(1);
    syncUrlParams({
      type: cat.type,
      genre: cat.genre,
      lang: nextLang,
      country: nextCountry,
      page: 1,
    });
  };

  const handleResetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setMediaType('all');
    setGenreId('');
    setYear('');
    setDecade('');
    setProvider('');
    setMinRating('');
    setLanguage('all');
    setCountry('all');
    setSortBy('popularity');
    setPage(1);
    setSearchParams({});
  };

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setPage(clamped);
    syncUrlParams({ page: clamped });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumpPageInput);
    if (!Number.isFinite(num) || num < 1) return;
    goToPage(Math.round(num));
    setJumpPageInput('');
  };

  const activeGenresList =
    mediaType === 'tv'
      ? genres.tv
      : mediaType === 'movie'
        ? genres.movie
        : genres.unified && genres.unified.length > 0
          ? genres.unified
          : genres.movie;

  const activeProviders = genres.providers ?? TMDB_BR_WATCH_PROVIDERS;
  const hasActiveFilters = Boolean(
    debouncedQuery.trim() ||
      mediaType !== 'all' ||
      genreId ||
      year ||
      decade ||
      provider ||
      minRating ||
      language !== 'all' ||
      country !== 'all' ||
      sortBy !== 'popularity'
  );

  // Build compact page button list (e.g. 1 ... 4 5 6 ... 500)
  const pageButtons: Array<number | 'ellipsis'> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
  } else {
    pageButtons.push(1);
    if (page > 3) pageButtons.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pageButtons.push(i);
    if (page < totalPages - 2) pageButtons.push('ellipsis');
    pageButtons.push(totalPages);
  }

  return (
    <div className="space-y-6">
      <DemoBanner visible={demoMode} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Explorar Catálogo TMDB
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-mono-tabular">
            {totalResults.toLocaleString('pt-BR')} resultados disponíveis · Página {page} de {totalPages}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ms-glass text-sm font-medium text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-4 h-4 text-sky-400" aria-hidden="true" />
            {showAdvanced ? 'Ocultar Filtros' : 'Filtros Avançados'}
          </button>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1" role="group" aria-label="Categorias rápidas">
        {QUICK_CATEGORIES.map((cat) => {
          const isActive =
            mediaType === cat.type &&
            genreId === cat.genre &&
            language === (cat.lang ?? 'all') &&
            country === (cat.country ?? 'all');
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleQuickCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isActive ? 'text-white ms-glow' : 'ms-glass text-slate-300 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: 'var(--ms-accent)' } : undefined}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search + Advanced Filters Panel */}
      <div className="ms-glass rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar título, ator, diretor, ID TMDB (ex: tv/47) ou IMDb (tt...)..."
              aria-label="Pesquisar em todo o catálogo TMDB"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              style={{ borderColor: 'var(--ms-border)' }}
            />
          </div>

          <select
            value={mediaType}
            onChange={(e) => {
              const nextType = e.target.value as 'all' | 'movie' | 'tv';
              setMediaType(nextType);
              setPage(1);
              syncUrlParams({ type: nextType, page: 1 });
            }}
            aria-label="Filtrar por formato"
            className="h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white focus:outline-none"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            <option value="all">Filmes e Séries</option>
            <option value="movie">Somente Filmes</option>
            <option value="tv">Somente Séries</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              const nextSort = parseSortParam(e.target.value);
              setSortBy(nextSort);
              setPage(1);
              syncUrlParams({ sort: nextSort, page: 1 });
            }}
            aria-label="Ordenar resultados"
            className="h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white focus:outline-none"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            <option value="popularity">Mais Populares</option>
            <option value="rating">Melhor Avaliação</option>
            <option value="votes">Mais Votados</option>
            <option value="release_date">Lançamentos Recentes</option>
            <option value="release_date_asc">Mais Antigos (Clássicos)</option>
            <option value="title_asc">Ordem Alfabética (A–Z)</option>
          </select>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t" style={{ borderColor: 'var(--ms-border)' }}>
            <div>
              <label htmlFor="filter-genre" className="block text-xs text-slate-400 mb-1">
                Gênero TMDB
              </label>
              <select
                id="filter-genre"
                value={genreId}
                onChange={(e) => {
                  const val = e.target.value;
                  setGenreId(val);
                  setPage(1);
                  syncUrlParams({ genre: val, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="">Todos os gêneros</option>
                {activeGenresList.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-provider" className="block text-xs text-slate-400 mb-1">
                Plataforma / Streaming
              </label>
              <select
                id="filter-provider"
                value={provider}
                onChange={(e) => {
                  const val = e.target.value;
                  setProvider(val);
                  setPage(1);
                  syncUrlParams({ provider: val, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="">Todas as plataformas</option>
                {activeProviders.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-decade" className="block text-xs text-slate-400 mb-1">
                Década / Época
              </label>
              <select
                id="filter-decade"
                value={decade}
                onChange={(e) => {
                  const val = e.target.value;
                  setDecade(val);
                  if (val) setYear('');
                  setPage(1);
                  syncUrlParams({ decade: val, year: val ? '' : year, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="">Qualquer época</option>
                {CATALOG_DECADES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-year" className="block text-xs text-slate-400 mb-1">
                Ano específico
              </label>
              <input
                id="filter-year"
                type="number"
                min={1900}
                max={2030}
                value={year}
                onChange={(e) => {
                  const val = e.target.value;
                  setYear(val);
                  if (val) setDecade('');
                  setPage(1);
                  syncUrlParams({ year: val, decade: val ? '' : decade, page: 1 });
                }}
                placeholder="Ex: 1998 ou 2024"
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>

            <div>
              <label htmlFor="filter-rating" className="block text-xs text-slate-400 mb-1">
                Avaliação mínima
              </label>
              <select
                id="filter-rating"
                value={minRating}
                onChange={(e) => {
                  const val = e.target.value;
                  setMinRating(val);
                  setPage(1);
                  syncUrlParams({ rating: val, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="">Qualquer nota</option>
                <option value="5">5.0+ TMDB</option>
                <option value="6">6.0+ TMDB</option>
                <option value="7">7.0+ TMDB</option>
                <option value="8">8.0+ TMDB</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-lang" className="block text-xs text-slate-400 mb-1">
                Idioma original
              </label>
              <select
                id="filter-lang"
                value={language}
                onChange={(e) => {
                  const val = e.target.value;
                  setLanguage(val);
                  setPage(1);
                  syncUrlParams({ lang: val, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="all">Todos os idiomas</option>
                <option value="pt">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
                <option value="ja">Japonês</option>
                <option value="ko">Coreano</option>
                <option value="fr">Francês</option>
                <option value="it">Italiano</option>
                <option value="de">Alemão</option>
                <option value="tr">Turco</option>
                <option value="zh">Chinês</option>
                <option value="hi">Hindi</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-country" className="block text-xs text-slate-400 mb-1">
                País de origem
              </label>
              <select
                id="filter-country"
                value={country}
                onChange={(e) => {
                  const val = e.target.value;
                  setCountry(val);
                  setPage(1);
                  syncUrlParams({ country: val, page: 1 });
                }}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="all">Todos os países</option>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
                <option value="GB">Reino Unido</option>
                <option value="JP">Japão</option>
                <option value="KR">Coreia do Sul</option>
                <option value="MX">México</option>
                <option value="TR">Turquia</option>
                <option value="FR">França</option>
                <option value="ES">Espanha</option>
                <option value="IT">Itália</option>
                <option value="DE">Alemanha</option>
                <option value="IN">Índia</option>
                <option value="AR">Argentina</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="ms-glass rounded-2xl p-10 text-center space-y-3">
          <Filter className="w-8 h-8 text-sky-400 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-white">
            Nenhum título encontrado com esses filtros
          </h2>
          <p className="text-sm text-slate-400">
            Ajuste a pesquisa ou limpe os filtros para explorar todos os filmes e séries do TMDB.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 pt-4">
              {page < totalPages && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchCatalog(page + 1, true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold text-white ms-glow transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--ms-accent)' }}
                >
                  {loadingMore
                    ? 'Carregando mais títulos...'
                    : `Carregar mais na grade (Página ${page + 1} de ${totalPages})`}
                </button>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  aria-label="Página anterior"
                  className="min-h-[40px] px-3 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Anterior
                </button>

                {pageButtons.map((entry, idx) =>
                  entry === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-2 text-slate-500 text-sm">
                      ...
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => goToPage(entry)}
                      aria-current={entry === page ? 'page' : undefined}
                      className={`min-h-[40px] min-w-[40px] px-3 rounded-xl text-xs sm:text-sm font-mono-tabular font-semibold transition-colors cursor-pointer ${
                        entry === page
                          ? 'text-white ms-glow'
                          : 'ms-glass text-slate-300 hover:text-white'
                      }`}
                      style={entry === page ? { backgroundColor: 'var(--ms-accent)' } : undefined}
                    >
                      {entry}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  aria-label="Próxima página"
                  className="min-h-[40px] px-3 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <form onSubmit={handleJumpPage} className="inline-flex items-center gap-1.5 ml-1">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder="Pág."
                    aria-label="Ir para página específica"
                    className="w-20 h-10 px-2.5 rounded-xl bg-black/40 border text-xs sm:text-sm text-white font-mono-tabular"
                    style={{ borderColor: 'var(--ms-border)' }}
                  />
                  <button
                    type="submit"
                    className="h-10 px-3 rounded-xl ms-glass text-xs font-semibold text-sky-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    Ir
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
