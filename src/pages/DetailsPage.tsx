import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  Clock,
  Film,
  Play,
  Share2,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatRuntimeMinutes } from '../../shared/catalogUtils';
import type { MediaDetail, MediaType, SeasonDetail } from '../../shared/types';
import { MediaRow } from '../components/MediaRow';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

interface DetailsPageProps {
  mediaType: MediaType;
}

export function DetailsPage({ mediaType }: DetailsPageProps) {
  const { id } = useParams<{ id: string }>();
  const { isFavorite, toggleFavorite } = useAuth();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sobre' | 'elenco' | 'recomendacoes'>('sobre');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    const endpoint = mediaType === 'tv' ? `/api/series/${id}` : `/api/movies/${id}`;
    apiRequest<MediaDetail>(endpoint)
      .then((res) => {
        if (!active) return;
        setDetail(res);
        if (mediaType === 'tv' && res.seasons && res.seasons.length > 0) {
          const firstRegular = res.seasons.find((s) => s.seasonNumber > 0) ?? res.seasons[0];
          setSelectedSeason(firstRegular.seasonNumber);
        }
      })
      .catch(() => {
        if (active) setDetail(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, mediaType]);

  useEffect(() => {
    if (mediaType !== 'tv' || !id) return;
    let active = true;
    setLoadingSeason(true);
    apiRequest<SeasonDetail>(`/api/series/${id}/seasons?season=${selectedSeason}`)
      .then((res) => {
        if (active) setSeasonDetail(res);
      })
      .catch(() => {
        if (active) setSeasonDetail(null);
      })
      .finally(() => {
        if (active) setLoadingSeason(false);
      });
    return () => {
      active = false;
    };
  }, [id, mediaType, selectedSeason]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-[360px] rounded-3xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="ms-glass rounded-2xl p-8 text-center space-y-3">
        <h1 className="font-display text-xl font-bold text-white">Conteúdo não encontrado</h1>
        <p className="text-sm text-slate-400">Verifique o identificador TMDB ou explore o catálogo.</p>
        <Link
          to="/explore"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--ms-accent)' }}
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  const trailer =
    detail.videos.find((v) => v.type === 'Trailer' && v.official) ?? detail.videos[0] ?? null;
  const favorited = isFavorite(detail.tmdbId, detail.mediaType);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: detail.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Link copiado');
        setTimeout(() => setShareFeedback(null), 2500);
      }
    } catch {
      // User canceled share
    }
  };

  return (
    <div className="space-y-8">
      {/* Cinematic Top Backdrop */}
      <section
        className="relative rounded-3xl overflow-hidden border"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <div className="relative min-h-[380px] sm:min-h-[440px] flex items-end">
          {detail.backdropPath || detail.posterPath ? (
            <img
              src={detail.backdropPath || detail.posterPath || ''}
              alt={detail.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0c2459] to-[#050814]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050814] via-[#050814]/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-black/30" />

          <div className="relative z-10 p-6 sm:p-10 w-full flex flex-col lg:flex-row gap-6 items-start lg:items-end">
            {detail.posterPath && (
              <img
                src={detail.posterPath}
                alt={detail.title}
                referrerPolicy="no-referrer"
                className="hidden sm:block w-40 lg:w-48 aspect-[2/3] object-cover rounded-2xl border border-white/15 shadow-2xl shrink-0"
              />
            )}

            <div className="flex-1 space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300 font-mono-tabular">
                <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="w-4 h-4 fill-amber-400" aria-hidden="true" />
                  {detail.voteAverage.toFixed(1)}/10 TMDB
                </span>
                <span aria-hidden="true">·</span>
                <span>{detail.releaseYear || '—'}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  {formatRuntimeMinutes(detail.runtime)}
                </span>
                {detail.genres && detail.genres.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300">
                      {detail.genres.map((g) => g.name).join(' / ')}
                    </span>
                  </>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight [text-wrap:balance]">
                {detail.title}
              </h1>

              {detail.originalTitle && detail.originalTitle !== detail.title && (
                <p className="text-xs sm:text-sm text-slate-400">
                  Título original: {detail.originalTitle}
                </p>
              )}

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                {detail.overview}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={
                    detail.mediaType === 'tv'
                      ? `/watch/tv/${detail.tmdbId}?season=${selectedSeason}&episode=1`
                      : `/watch/${detail.mediaType}/${detail.tmdbId}`
                  }
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
                      tmdbId: detail.tmdbId,
                      mediaType: detail.mediaType,
                      title: detail.title,
                      posterPath: detail.posterPath,
                      voteAverage: detail.voteAverage,
                      releaseYear: detail.releaseYear,
                    })
                  }
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white ms-glass hover:bg-white/15 cursor-pointer whitespace-nowrap"
                >
                  {favorited ? (
                    <>
                      <Check className="w-4 h-4 text-sky-300" aria-hidden="true" />
                      Na Minha Lista
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" aria-hidden="true" />
                      Adicionar aos Favoritos
                    </>
                  )}
                </button>

                {trailer && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-sky-200 ms-glass hover:bg-white/15 cursor-pointer whitespace-nowrap"
                  >
                    <Film className="w-4 h-4" aria-hidden="true" />
                    Ver Trailer
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-slate-200 ms-glass hover:bg-white/15 cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  {shareFeedback || 'Compartilhar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detail Tabs */}
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--ms-border)' }} role="tablist">
        {(
          [
            { id: 'sobre', label: 'Sobre' },
            { id: 'elenco', label: 'Elenco e Direção' },
            { id: 'recomendacoes', label: 'Recomendações' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
            style={activeTab === tab.id ? { backgroundColor: 'var(--ms-accent)' } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sobre' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ms-glass rounded-2xl p-4 space-y-1">
            <p className="text-xs text-slate-400">Direção / Criação</p>
            <p className="text-sm font-semibold text-white">{detail.director || 'Informação não informada'}</p>
          </div>
          <div className="ms-glass rounded-2xl p-4 space-y-1">
            <p className="text-xs text-slate-400">Idioma Original</p>
            <p className="text-sm font-semibold text-white uppercase">{detail.originalLanguage}</p>
          </div>
          <div className="ms-glass rounded-2xl p-4 space-y-1">
            <p className="text-xs text-slate-400">País de Origem</p>
            <p className="text-sm font-semibold text-white">
              {detail.originCountry?.join(', ') || 'Internacional'}
            </p>
          </div>
          <div className="ms-glass rounded-2xl p-4 space-y-1">
            <p className="text-xs text-slate-400">Identificador TMDB</p>
            <p className="text-sm font-semibold text-sky-300 font-mono-tabular">#{detail.tmdbId}</p>
          </div>
        </section>
      )}

      {activeTab === 'elenco' && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-white">Elenco Principal</h2>
          {detail.cast.length === 0 ? (
            <p className="text-sm text-slate-400">Informações de elenco indisponíveis.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {detail.cast.map((actor) => (
                <div key={actor.id} className="ms-glass rounded-2xl p-3 text-center space-y-2">
                  {actor.profilePath ? (
                    <img
                      src={actor.profilePath}
                      alt={actor.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full mx-auto object-cover border border-white/15"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto bg-slate-800 flex items-center justify-center text-sm font-bold text-sky-300">
                      {actor.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-white truncate">{actor.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{actor.character}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Seasons & Episodes for Series (Tela 4) */}
      {mediaType === 'tv' && detail.seasons && detail.seasons.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-white">
              Temporadas e Episódios
            </h2>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              aria-label="Selecionar temporada"
              className="h-10 px-4 rounded-xl bg-black/40 border text-sm text-white"
              style={{ borderColor: 'var(--ms-border)' }}
            >
              {detail.seasons.map((s) => (
                <option key={s.id} value={s.seasonNumber}>
                  {s.name} ({s.episodeCount} ep.)
                </option>
              ))}
            </select>
          </div>

          {loadingSeason ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(seasonDetail?.episodes ?? []).map((ep) => (
                <div
                  key={ep.id}
                  className="ms-glass rounded-2xl p-3.5 flex gap-3.5 items-center hover:border-sky-400/40 transition-colors"
                >
                  <div className="w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 relative">
                    {ep.stillPath ? (
                      <img
                        src={ep.stillPath}
                        alt={ep.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sky-400">
                        <Tv className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono-tabular text-sky-300">
                        T{ep.seasonNumber} · Ep. {ep.episodeNumber}
                      </span>
                      {ep.runtime && (
                        <span className="text-xs text-slate-400 font-mono-tabular">
                          {ep.runtime} min
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white truncate">{ep.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{ep.overview}</p>
                  </div>

                  <Link
                    to={`/watch/tv/${detail.tmdbId}?season=${ep.seasonNumber}&episode=${ep.episodeNumber}`}
                    aria-label={`Reproduzir ${ep.name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white shrink-0"
                    style={{ backgroundColor: 'var(--ms-accent)' }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <MediaRow title="Recomendações" items={detail.recommendations} />
      <MediaRow title="Títulos Semelhantes" items={detail.similar} />

      {/* YouTube Trailer Modal */}
      {trailerOpen && trailer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Trailer de ${detail.title}`}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-4xl ms-glass rounded-3xl overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--ms-border)' }}>
              <h2 className="font-display text-base font-bold text-white truncate">
                Trailer — {detail.title}
              </h2>
              <button
                type="button"
                onClick={() => setTrailerOpen(false)}
                aria-label="Fechar trailer"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                title={`Trailer ${detail.title}`}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
