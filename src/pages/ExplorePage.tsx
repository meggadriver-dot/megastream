import React, { useCallback, useEffect, useState } from 'react';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { GenreItem, MediaItem, PaginatedCatalogResponse } from '../../shared/types';
import { DemoBanner } from '../components/DemoBanner';
import { MediaCard } from '../components/MediaCard';
import { apiRequest } from '../services/apiClient';

const QUICK_CATEGORIES = [
  { id: 'all', label: 'Todos', type: 'all' as const, genre: '' },
  { id: 'movie', label: 'Filmes', type: 'movie' as const, genre: '' },
  { id: 'tv', label: 'Séries', type: 'tv' as const, genre: '' },
  { id: '16', label: 'Animações', type: 'movie' as const, genre: '16' },
  { id: '99', label: 'Documentários', type: 'movie' as const, genre: '99' },
  { id: '28', label: 'Ação', type: 'movie' as const, genre: '28' },
  { id: '12', label: 'Aventura', type: 'movie' as const, genre: '12' },
  { id: '35', label: 'Comédia', type: 'movie' as const, genre: '35' },
  { id: '18', label: 'Drama', type: 'movie' as const, genre: '18' },
  { id: '27', label: 'Terror', type: 'movie' as const, genre: '27' },
  { id: '878', label: 'Ficção Científica', type: 'movie' as const, genre: '878' },
  { id: '10749', label: 'Romance', type: 'movie' as const, genre: '10749' },
  { id: '53', label: 'Suspense', type: 'movie' as const, genre: '53' },
];

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>(
    (searchParams.get('type') as 'all' | 'movie' | 'tv') || 'all'
  );
  const [genreId, setGenreId] = useState(searchParams.get('genre') || '');
  const [year, setYear] = useState(searchParams.get('year') || '');
  const [minRating, setMinRating] = useState(searchParams.get('rating') || '');
  const [language, setLanguage] = useState(searchParams.get('lang') || 'all');
  const [country, setCountry] = useState(searchParams.get('country') || 'all');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'release_date'>(
    (searchParams.get('sort') as 'popularity' | 'rating' | 'release_date') || 'popularity'
  );

  const [genres, setGenres] = useState<{ movie: GenreItem[]; tv: GenreItem[] }>({
    movie: [],
    tv: [],
  });
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const qFromUrl = searchParams.get('q') || '';
    const tFromUrl = (searchParams.get('type') as 'all' | 'movie' | 'tv') || 'all';
    const gFromUrl = searchParams.get('genre') || '';
    setQuery(qFromUrl);
    setDebouncedQuery(qFromUrl);
    setMediaType(tFromUrl);
    setGenreId(gFromUrl);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    apiRequest<{ movie: GenreItem[]; tv: GenreItem[] }>('/api/genres')
      .then(setGenres)
      .catch(() => {});
  }, []);

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
        if (year) params.set('year', year);
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
    [country, debouncedQuery, genreId, language, mediaType, minRating, sortBy, year]
  );

  useEffect(() => {
    void fetchCatalog(1, false);
  }, [fetchCatalog]);

  const handleQuickCategory = (cat: (typeof QUICK_CATEGORIES)[number]) => {
    setMediaType(cat.type);
    setGenreId(cat.genre);
    const next = new URLSearchParams();
    if (cat.type !== 'all') next.set('type', cat.type);
    if (cat.genre) next.set('genre', cat.genre);
    if (query.trim()) next.set('q', query.trim());
    setSearchParams(next);
  };

  const activeGenresList = mediaType === 'tv' ? genres.tv : genres.movie;

  return (
    <div className="space-y-6">
      <DemoBanner visible={demoMode} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Explorar Catálogo
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-mono-tabular">
            {totalResults.toLocaleString('pt-BR')} resultados encontrados · Página {page} de {totalPages}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ms-glass text-sm font-medium text-white hover:bg-white/10 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <SlidersHorizontal className="w-4 h-4 text-sky-400" aria-hidden="true" />
          Filtros Avançados
        </button>
      </div>

      {/* Category Pills Bar (Interactive Filter Controls) */}
      <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1" role="group" aria-label="Categorias rápidas">
        {QUICK_CATEGORIES.map((cat) => {
          const isActive = mediaType === cat.type && genreId === cat.genre;
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
              placeholder="Pesquisar título no catálogo TMDB..."
              aria-label="Pesquisar título no catálogo"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              style={{ borderColor: 'var(--ms-border)' }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'popularity' | 'rating' | 'release_date')}
            aria-label="Ordenar resultados"
            className="h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white focus:outline-none"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            <option value="popularity">Mais Populares</option>
            <option value="rating">Melhor Avaliação</option>
            <option value="release_date">Ordem de Lançamento</option>
          </select>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t" style={{ borderColor: 'var(--ms-border)' }}>
            <div>
              <label htmlFor="filter-genre" className="block text-xs text-slate-400 mb-1">
                Gênero
              </label>
              <select
                id="filter-genre"
                value={genreId}
                onChange={(e) => setGenreId(e.target.value)}
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
              <label htmlFor="filter-year" className="block text-xs text-slate-400 mb-1">
                Ano
              </label>
              <input
                id="filter-year"
                type="number"
                min={1950}
                max={2030}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ex: 2024"
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
                onChange={(e) => setMinRating(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="">Qualquer nota</option>
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
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="all">Todos</option>
                <option value="pt">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
                <option value="ja">Japonês</option>
                <option value="ko">Coreano</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-country" className="block text-xs text-slate-400 mb-1">
                País de origem
              </label>
              <select
                id="filter-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="all">Todos</option>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
                <option value="GB">Reino Unido</option>
                <option value="JP">Japão</option>
                <option value="KR">Coreia do Sul</option>
                <option value="FR">França</option>
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
            Ajuste a pesquisa ou limpe os filtros para explorar mais filmes e séries.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setMediaType('all');
              setGenreId('');
              setYear('');
              setMinRating('');
              setLanguage('all');
              setCountry('all');
              setSearchParams({});
            }}
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

          {page < totalPages && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchCatalog(page + 1, true)}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white ms-glow transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                {loadingMore ? 'Carregando mais títulos...' : `Carregar mais (Página ${page + 1} de ${totalPages})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
