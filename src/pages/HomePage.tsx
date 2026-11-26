import React, { useEffect, useState } from 'react';
import { Bookmark, Check, ChevronRight, Play, Sparkles, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { GenreItem, MediaItem } from '../../shared/types';
import type { WatchProviderOption } from '../../shared/catalogUtils';
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
  novelas?: MediaItem[];
  animes?: MediaItem[];
  doramas?: MediaItem[];
  brazilian?: MediaItem[];
  genres: { movie: GenreItem[]; tv: GenreItem[]; unified?: GenreItem[] };
  providers?: WatchProviderOption[];
  source: 'tmdb' | 'demo';
  demoMode: boolean;
}

export function HomePage() {
  const { history, isFavorite, toggleFavorite, removeFromHistory } = useAuth();
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

      {/* Quick Genre & Streaming Bar */}
      <section className="space-y-3" aria-label="Categorias e plataformas TMDB">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-white">Explorar Catálogo TMDB</h2>
          <div className="flex items-center gap-4">
            <Link
              to="/explore"
              className="text-xs sm:text-sm font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap"
            >
              Ver catálogo completo
            </Link>
            <Link
              to="/ai"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              IA Inteligente
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1">
          <Link
            to="/explore"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Todos os Títulos
          </Link>
          <Link
            to="/explore?type=movie"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Filmes
          </Link>
          <Link
            to="/explore?type=tv"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Séries
          </Link>
          <Link
            to="/explore?type=tv&genre=10766"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Novelas
          </Link>
          <Link
            to="/explore?genre=16&lang=ja"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Animes
          </Link>
          <Link
            to="/explore?type=tv&country=KR"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Doramas
          </Link>
          <Link
            to="/explore?country=BR"
            className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
          >
            Brasil
          </Link>
          {(data.genres.unified && data.genres.unified.length > 0
            ? data.genres.unified
            : data.genres.movie
          ).map((g) => (
            <Link
              key={g.id}
              to={`/explore?genre=${g.id}`}
              className="px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
            >
              {g.name}
            </Link>
          ))}
        </div>

        {data.providers && data.providers.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0 pr-1">
              Por Streaming:
            </span>
            {data.providers.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to={`/explore?provider=${p.id}`}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:border-sky-400/50 transition-colors whitespace-nowrap shrink-0"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3" aria-label="Continuar Assistindo">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
              Continuar Assistindo
            </h2>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-sky-300 hover:text-sky-200 transition-colors"
            >
              Ver todos
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 ms-scrollbar-hide snap-x">
            {history.map((item) => {
              const resumeUrl = `/watch/${item.mediaType}/${item.tmdbId}${
                item.seasonNumber
                  ? `?season=${item.seasonNumber}&episode=${item.episodeNumber || 1}`
                  : ''
              }`;
              const thumb = item.backdropPath || item.posterPath;
              const pct = Math.min(100, Math.max(5, Math.round(item.progressPercent)));

              return (
                <article
                  key={`${item.mediaType}-${item.tmdbId}`}
                  className="group relative flex-shrink-0 w-[220px] sm:w-[250px] snap-start"
                >
                  <Link
                    to={resumeUrl}
                    className="block rounded-2xl overflow-hidden bg-[#0a122a] border transition-transform duration-300 group-hover:scale-[1.02] group-hover:border-sky-400/50"
                    style={{ borderColor: 'var(--ms-border)' }}
                  >
                    <div className="relative aspect-video overflow-hidden bg-slate-900">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center p-3 text-center text-xs text-slate-400">
                          {item.title}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white ms-glow"
                          style={{ backgroundColor: 'var(--ms-accent)' }}
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-200 font-mono-tabular">
                        <span className="px-2 py-0.5 rounded-md bg-black/75 border border-white/15">
                          {item.mediaType === 'tv' && item.seasonNumber
                            ? `T${item.seasonNumber} · Ep.${item.episodeNumber || 1}`
                            : 'Filme'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-black/75 border border-white/15">
                          {pct}%
                        </span>
                      </div>

                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: 'var(--ms-accent-bright)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="px-3 py-2.5">
                      <h3 className="text-sm font-semibold text-white truncate">{item.title}</h3>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void removeFromHistory(item.tmdbId, item.mediaType);
                    }}
                    aria-label={`Remover ${item.title} de Continuar Assistindo`}
                    title="Remover de Continuar Assistindo"
                    className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/75 border border-white/15 text-slate-200 hover:text-white hover:bg-red-600/80 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
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

      {data.onAirSeries && data.onAirSeries.length > 0 && (
        <MediaRow
          title="Séries no Ar e Episódios de Hoje"
          items={data.onAirSeries}
          seeMoreTo="/explore?type=tv&sort=release_date"
        />
      )}

      {data.novelas && data.novelas.length > 0 && (
        <MediaRow
          title="Novelas e Dramaturgia"
          items={data.novelas}
          seeMoreTo="/explore?type=tv&genre=10766"
        />
      )}

      {data.animes && data.animes.length > 0 && (
        <MediaRow
          title="Animes e Animações"
          items={data.animes}
          seeMoreTo="/explore?genre=16&lang=ja"
        />
      )}

      {data.brazilian && data.brazilian.length > 0 && (
        <MediaRow
          title="Cinema e Séries do Brasil"
          items={data.brazilian}
          seeMoreTo="/explore?country=BR"
        />
      )}

      {data.doramas && data.doramas.length > 0 && (
        <MediaRow
          title="Doramas e Produções Asiáticas"
          items={data.doramas}
          seeMoreTo="/explore?type=tv&country=KR"
        />
      )}

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
