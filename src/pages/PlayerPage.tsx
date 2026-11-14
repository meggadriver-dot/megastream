import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Film,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Star,
  Tv,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatRuntimeMinutes } from '../../shared/catalogUtils';
import { PLAYER_LAST_ROUTE_KEY, resolvePlayerBackTarget } from '../../shared/playerNavigation';
import type { MediaDetail, MediaType, SeasonDetail } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

interface CleanStreamPayload {
  tmdbId: number;
  mediaType: MediaType;
  embedUrl: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export function PlayerPage() {
  const { type, tmdbId } = useParams<{ type: string; tmdbId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordPlayback, history, loading: authLoading, firebaseUser } = useAuth();

  const mediaType: MediaType = type === 'tv' ? 'tv' : 'movie';
  const rawSeason = searchParams.get('season');
  const parsedSeason = rawSeason !== null && rawSeason.trim() !== '' ? Number(rawSeason) : 1;
  const seasonParam = Number.isInteger(parsedSeason) && parsedSeason >= 0 ? parsedSeason : 1;

  const rawEpisode = searchParams.get('episode');
  const parsedEpisode = rawEpisode !== null && rawEpisode.trim() !== '' ? Number(rawEpisode) : 1;
  const episodeParam = Number.isInteger(parsedEpisode) && parsedEpisode >= 1 ? parsedEpisode : 1;

  const [embedData, setEmbedData] = useState<CleanStreamPayload | null>(null);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null);

  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const recordedKeyRef = useRef<string | null>(null);

  // Load media metadata & seasons
  useEffect(() => {
    if (!tmdbId) return;
    const detailUrl = mediaType === 'tv' ? `/api/series/${tmdbId}` : `/api/movies/${tmdbId}`;
    apiRequest<MediaDetail>(detailUrl)
      .then((res) => {
        setDetail(res);
      })
      .catch(() => {});
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaType !== 'tv' || !tmdbId) return;
    apiRequest<SeasonDetail>(`/api/series/${tmdbId}/seasons?season=${seasonParam}`)
      .then(setSeasonDetail)
      .catch(() => {});
  }, [tmdbId, mediaType, seasonParam]);

  // Resolve playback URL from backend using admin's global configuration
  const loadEmbed = useCallback(async () => {
    if (!tmdbId) return;
    setEmbedData(null);
    setIframeLoading(true);
    setIframeTimedOut(false);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (mediaType === 'tv') {
        params.set('season', String(seasonParam));
        params.set('episode', String(episodeParam));
      }
      const queryStr = params.toString();
      const res = await apiRequest<CleanStreamPayload>(
        `/api/player/${mediaType}/${tmdbId}${queryStr ? `?${queryStr}` : ''}`
      );
      setEmbedData(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível iniciar a reprodução.');
      setIframeLoading(false);
    }
  }, [tmdbId, mediaType, seasonParam, episodeParam]);

  useEffect(() => {
    void loadEmbed();
  }, [loadEmbed, reloadNonce]);

  // Record playback history automatically after auth settles
  useEffect(() => {
    if (authLoading || !detail) return;
    const recKey = `${firebaseUser?.uid ?? 'guest'}:${detail.mediaType}:${detail.tmdbId}:${
      mediaType === 'tv' ? seasonParam : 0
    }:${mediaType === 'tv' ? episodeParam : 0}`;
    if (recordedKeyRef.current === recKey) return;
    recordedKeyRef.current = recKey;

    const prev = history.find(
      (h) => h.tmdbId === detail.tmdbId && h.mediaType === detail.mediaType
    );
    void recordPlayback({
      tmdbId: detail.tmdbId,
      mediaType: detail.mediaType,
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      progressPercent: prev ? Math.min(95, prev.progressPercent + 10) : 15,
      seasonNumber: mediaType === 'tv' ? seasonParam : undefined,
      episodeNumber: mediaType === 'tv' ? episodeParam : undefined,
    });
  }, [
    authLoading,
    firebaseUser?.uid,
    detail,
    mediaType,
    seasonParam,
    episodeParam,
    history,
    recordPlayback,
  ]);

  // Timeout guard if embedded iframe does not fire onLoad within 12s
  useEffect(() => {
    if (!iframeLoading) return;
    const timer = setTimeout(() => {
      setIframeTimedOut(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [iframeLoading, reloadNonce, embedData?.embedUrl]);

  const handleFullscreenLandscape = async () => {
    try {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore browser fullscreen restriction
    }
  };

  const previousProgress = history.find(
    (h) => h.tmdbId === Number(tmdbId) && h.mediaType === mediaType
  );

  const currentEpisode =
    mediaType === 'tv'
      ? seasonDetail?.episodes.find((ep) => ep.episodeNumber === episodeParam) ?? null
      : null;

  const handleExitPlayer = () => {
    let lastNonPlayerRoute: string | null = null;
    try {
      lastNonPlayerRoute = sessionStorage.getItem(PLAYER_LAST_ROUTE_KEY);
    } catch {
      lastNonPlayerRoute = null;
    }
    const target = resolvePlayerBackTarget({
      lastNonPlayerRoute,
      mediaType,
      tmdbId,
    });
    navigate(target, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#03050e] text-white flex flex-col">
      {/* Clean Cinema Control Bar */}
      <header
        className="px-4 sm:px-6 py-3 ms-glass border-b flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleExitPlayer}
            aria-label="Voltar"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg font-bold truncate">
              {detail?.title || 'Reproduzindo conteúdo'}
            </h1>
            <p className="text-xs text-slate-400 font-mono-tabular truncate">
              {mediaType === 'tv'
                ? `Série · Temporada ${seasonParam} · Episódio ${episodeParam}${
                    currentEpisode?.name ? ` — ${currentEpisode.name}` : ''
                  }`
                : `Filme${detail?.releaseYear ? ` · ${detail.releaseYear}` : ''}${
                    detail?.runtime ? ` · ${formatRuntimeMinutes(detail.runtime)}` : ''
                  }`}
              {previousProgress ? ` · Retomado (${Math.round(previousProgress.progressPercent)}%)` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="h-10 px-3.5 rounded-xl ms-glass text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Recarregar
          </button>

          <button
            type="button"
            onClick={handleFullscreenLandscape}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            Tela Cheia
          </button>
        </div>
      </header>

      {/* Main Clean Video Area + Title / Episode Details */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        <div className={mediaType === 'tv' ? 'lg:col-span-8 xl:col-span-9 space-y-5' : 'lg:col-span-12 space-y-5'}>
          <div
            ref={containerRef}
            className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border shadow-2xl"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            {embedData?.embedUrl && !errorMsg && (
              <iframe
                key={`${embedData.embedUrl}-${reloadNonce}`}
                src={embedData.embedUrl}
                title={detail?.title || 'Player de vídeo'}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                referrerPolicy="no-referrer"
                onLoad={() => {
                  setIframeLoading(false);
                  setIframeTimedOut(false);
                }}
                onError={() => {
                  setIframeLoading(false);
                  setErrorMsg('Não foi possível iniciar a reprodução deste título no momento.');
                }}
              />
            )}

            {iframeLoading && !errorMsg && (
              <div className="absolute inset-0 bg-[#050814]/90 flex flex-col items-center justify-center gap-3 p-6 text-center pointer-events-none">
                <div className="w-10 h-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-sm font-medium text-white">Carregando reprodução...</p>
                {iframeTimedOut && (
                  <p className="text-xs text-slate-300 max-w-md pointer-events-auto">
                    O vídeo está demorando para iniciar. Clique em Recarregar no topo para tentar novamente.
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="absolute inset-0 bg-[#050814] flex flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <p className="text-base font-semibold text-white">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--ms-accent)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            )}
          </div>

          {/* Clean Movie / Series / Episode Information Card */}
          {detail && (
            <section
              className="ms-glass rounded-2xl p-5 sm:p-6 space-y-4"
              aria-label="Informações do título"
            >
              {currentEpisode && (
                <div className="pb-4 border-b space-y-2" style={{ borderColor: 'var(--ms-border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-300 font-mono-tabular">
                      Temporada {currentEpisode.seasonNumber} · Episódio {currentEpisode.episodeNumber}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-tabular">
                      {currentEpisode.runtime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {currentEpisode.runtime} min
                        </span>
                      )}
                      {currentEpisode.airDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          {currentEpisode.airDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                    {currentEpisode.name}
                  </h2>
                  {currentEpisode.overview && (
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {currentEpisode.overview}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 font-mono-tabular">
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" aria-hidden="true" />
                      {detail.voteAverage.toFixed(1)}/10
                    </span>
                    {detail.releaseYear && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{detail.releaseYear}</span>
                      </>
                    )}
                    {detail.runtime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatRuntimeMinutes(detail.runtime)}</span>
                      </>
                    )}
                    {detail.genres && detail.genres.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-300">
                          {detail.genres.map((g) => g.name).join(' / ')}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    {mediaType === 'tv' ? (
                      <Tv className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <Film className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                    )}
                    {detail.title}
                  </h3>

                  {detail.overview && (
                    <p className="text-sm text-slate-300 leading-relaxed">{detail.overview}</p>
                  )}

                  {detail.director && (
                    <p className="text-xs text-slate-400 pt-1">
                      Direção / Criação: <span className="text-slate-200">{detail.director}</span>
                    </p>
                  )}
                </div>

                <Link
                  to={mediaType === 'tv' ? `/series/${detail.tmdbId}` : `/movie/${detail.tmdbId}`}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  Ver ficha completa
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* Clean Episode Selector Sidebar for Series */}
        {mediaType === 'tv' && (
          <aside className="lg:col-span-4 xl:col-span-3 ms-glass rounded-2xl p-4 flex flex-col max-h-[680px]">
            <div className="space-y-2.5 pb-3 border-b" style={{ borderColor: 'var(--ms-border)' }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-sky-400" />
                  Episódios · Temp. {seasonParam}
                </h2>
                <Link to={`/series/${tmdbId}`} className="text-xs text-sky-300 hover:underline">
                  Ver série
                </Link>
              </div>
              {detail?.seasons && detail.seasons.length > 0 && (
                <select
                  value={seasonParam}
                  onChange={(e) =>
                    setSearchParams(
                      {
                        season: e.target.value,
                        episode: '1',
                      },
                      { replace: true }
                    )
                  }
                  aria-label="Selecionar temporada no player"
                  className="w-full h-9 px-3 rounded-xl bg-black/50 border text-xs text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                >
                  {detail.seasons.map((s) => (
                    <option key={s.id} value={s.seasonNumber}>
                      {s.name} ({s.episodeCount} ep.)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-3">
              {(seasonDetail?.episodes ?? []).map((ep) => {
                const isCurrent = ep.episodeNumber === episodeParam;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() =>
                      setSearchParams(
                        {
                          season: String(ep.seasonNumber),
                          episode: String(ep.episodeNumber),
                        },
                        { replace: true }
                      )
                    }
                    className={`w-full text-left p-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-2.5 ${
                      isCurrent ? 'text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                    style={isCurrent ? { backgroundColor: 'var(--ms-accent)' } : undefined}
                  >
                    {ep.stillPath && (
                      <img
                        src={ep.stillPath}
                        alt={ep.name}
                        referrerPolicy="no-referrer"
                        className="w-16 aspect-video rounded-lg object-cover shrink-0 bg-black/40"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-mono-tabular opacity-80">
                        Episódio {ep.episodeNumber}
                        {ep.runtime ? ` · ${ep.runtime}m` : ''}
                      </p>
                      <p className="text-sm font-semibold truncate">{ep.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
