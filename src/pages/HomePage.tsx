import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Play, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { GenreItem, MediaItem } from '../../shared/types';
import { DemoBanner } from '../components/DemoBanner';
import { MediaRow } from '../components/MediaRow';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

interface HomeCatalogPayload {
  featured: MediaItem | null;
  trending: MediaItem[];
  popularMovies: MediaItem[];
  nowPlayingMovies: MediaItem[];
  topRatedMovies: MediaItem[];
  upcomingMovies: MediaItem[];
  popularSeries: MediaItem[];
  topRatedSeries: MediaItem[];
  onAirSeries: MediaItem[];
  genres: { movie: GenreItem[]; tv: GenreItem[] };
  source: 'tmdb' | 'demo';
  demoMode: boolean;
}

export function HomePage() {
  const { history, isFavorite, toggleFavorite } = useAuth();
  const [data, setData] = useState<HomeCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<HomeCatalogPayload>('/api/catalog/home')
      .then((res) => {
        if (!active) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar catálogo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const heroPool = data?.trending?.slice(0, 5) ?? [];
  const featured = heroPool[heroIdx] ?? data?.featured ?? null;

  useEffect(() => {
    if (heroPool.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % heroPool.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [heroPool.length]);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse" aria-busy="true">
        <div className="h-[340px] sm:h-[440px] rounded-3xl bg-white/5" />
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-white/10" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="w-[180px] aspect-[2/3] rounded-2xl bg-white/5 shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ms-glass rounded-2xl p-8 text-center space-y-3">
        <h1 className="font-display text-xl font-bold text-white">
          Não foi possível carregar o catálogo
        </h1>
        <p className="text-sm text-slate-300">{error || 'Tente novamente em alguns instantes.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--ms-accent)' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const featuredFav = featured ? isFavorite(featured.tmdbId, featured.mediaType) : false;

  const continueWatchingItems: MediaItem[] = history.map((h) => ({
    id: h.tmdbId,
    tmdbId: h.tmdbId,
    mediaType: h.mediaType,
    title: h.title,
    originalTitle: h.title,
    overview: '',
    posterPath: h.posterPath,
    backdropPath: h.backdropPath,
    releaseDate: '',
    releaseYear: `${Math.round(h.progressPercent)}%`,
    voteAverage: 0,
    voteCount: 0,
    popularity: 100,
    genreIds: [],
    originalLanguage: 'pt',
    source: data.source,
  }));

  return (
    <div className="space-y-8">
      <DemoBanner visible={data.demoMode} />

      {/* Dynamic Hero Banner */}
      {featured && (
        <motion.section
          key={`${featured.mediaType}-${featured.tmdbId}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="relative rounded-3xl overflow-hidden min-h-[360px] sm:min-h-[440px] lg:min-h-[490px] flex items-end border"
          style={{ borderColor: 'var(--ms-border)' }}
        >
          {featured.backdropPath || featured.posterPath ? (
            <img
              src={featured.backdropPath || featured.posterPath || ''}
              alt={featured.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0c2459] via-[#050814] to-black" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-[#050814] via-[#050814]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-black/30" />

          <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-sky-300 font-medium">
              <span>{featured.mediaType === 'tv' ? 'Série em Destaque' : 'Filme em Destaque'}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-400 font-mono-tabular">
                <Star className="w-3.5 h-3.5 fill-amber-400" aria-hidden="true" />
                {featured.voteAverage.toFixed(1)}
              </span>
              {featured.releaseYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{featured.releaseYear}</span>
                </>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight [text-wrap:balance]">
              {featured.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 line-clamp-3 leading-relaxed">
              {featured.overview}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={`/watch/${featured.mediaType}/${featured.tmdbId}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ms-glow transition-transform hover:scale-[1.02] whitespace-nowrap"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                Assistir Agora
              </Link>

              <button
                type="button"
                onClick={() =>
                  toggleFavorite({
                    tmdbId: featured.tmdbId,
                    mediaType: featured.mediaType,
                    title: featured.title,
                    posterPath: featured.posterPath,
                    voteAverage: featured.voteAverage,
                    releaseYear: featured.releaseYear,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white ms-glass hover:bg-white/15 transition-colors whitespace-nowrap cursor-pointer"
              >
                {featuredFav ? (
                  <>
                    <Check className="w-4 h-4 text-sky-300" aria-hidden="true" />
                    Na Minha Lista
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" aria-hidden="true" />
                    Minha Lista
                  </>
                )}
              </button>

              <Link
                to={featured.mediaType === 'tv' ? `/series/${featured.tmdbId}` : `/movie/${featured.tmdbId}`}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                Mais detalhes
              </Link>
            </div>

            {heroPool.length > 1 && (
              <div className="flex items-center gap-2 pt-2" role="tablist" aria-label="Destaques">
                {heroPool.map((item, idx) => (
                  <button
                    key={`${item.mediaType}-${item.tmdbId}`}
                    type="button"
                    role="tab"
                    aria-selected={idx === heroIdx}
                    aria-label={`Destaque ${idx + 1}: ${item.title}`}
                    onClick={() => setHeroIdx(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === heroIdx ? 'w-8 bg-sky-400' : 'w-3 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Quick Genre Bar */}
      <section className="space-y-3" aria-label="Categorias por gênero">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Categorias</h2>
          <Link
            to="/ai"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-sky-300 hover:text-sky-200"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Descobrir com IA Inteligente
          </Link>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1">
          {data.genres.movie.slice(0, 10).map((g) => (
            <Link
              key={g.id}
              to={`/explore?type=movie&genre=${g.id}`}
              className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </section>

      {continueWatchingItems.length > 0 && (
        <MediaRow
          title="Continuar Assistindo"
          items={continueWatchingItems}
          seeMoreTo="/history"
        />
      )}

      <MediaRow
        title="Tendências da Semana"
        items={data.trending}
        seeMoreTo="/explore"
      />

      <MediaRow
        title="Filmes Populares"
        items={data.popularMovies}
        seeMoreTo="/explore?type=movie"
      />

      <MediaRow
        title="Séries Populares"
        items={data.popularSeries}
        seeMoreTo="/explore?type=tv"
      />

      <MediaRow
        title="Lançamentos e Em Cartaz"
        items={Array.from(
          new Map(
            [...data.nowPlayingMovies, ...data.upcomingMovies].map((m) => [
              `${m.mediaType}-${m.tmdbId}`,
              m,
            ])
          ).values()
        ).slice(0, 16)}
        seeMoreTo="/explore?type=movie&sort=release_date"
      />

      <MediaRow
        title="Mais Bem Avaliados"
        items={Array.from(
          new Map(
            [...data.topRatedMovies, ...data.topRatedSeries].map((m) => [
              `${m.mediaType}-${m.tmdbId}`,
              m,
            ])
          ).values()
        ).slice(0, 16)}
        seeMoreTo="/explore?sort=rating"
      />
    </div>
  );
}
