import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  Maximize2,
  Palette,
  RefreshCw,
  RotateCcw,
  Tv,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  EmbedPlayResponse,
  MediaDetail,
  MediaType,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerConfig,
  SeasonDetail,
} from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

const COLOR_PRESETS = [
  { label: 'Azul Elétrico', hex: '00a8ff' },
  { label: 'Laranja Mega', hex: 'fb542b' },
  { label: 'Neon Roxo', hex: 'a855f7' },
  { label: 'Dourado', hex: 'f59e0b' },
];

export function PlayerPage() {
  const { type, tmdbId } = useParams<{ type: string; tmdbId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordPlayback, history } = useAuth();

  const mediaType: MediaType = type === 'tv' ? 'tv' : 'movie';
  const rawSeason = searchParams.get('season');
  const parsedSeason = rawSeason !== null && rawSeason.trim() !== '' ? Number(rawSeason) : 1;
  const seasonParam = Number.isInteger(parsedSeason) && parsedSeason >= 0 ? parsedSeason : 1;

  const rawEpisode = searchParams.get('episode');
  const parsedEpisode = rawEpisode !== null && rawEpisode.trim() !== '' ? Number(rawEpisode) : 1;
  const episodeParam = Number.isInteger(parsedEpisode) && parsedEpisode >= 1 ? parsedEpisode : 1;

  const [config, setConfig] = useState<PlayerConfig | null>(null);
  const [domain, setDomain] = useState<MegaEmbedDomain>('mgeb.lat');
  const [player, setPlayer] = useState<MegaEmbedPlayer>('vidstack');
  const [colorHex, setColorHex] = useState('00a8ff');
  const [embedData, setEmbedData] = useState<EmbedPlayResponse | null>(null);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null);

  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load configurable defaults from server
  useEffect(() => {
    apiRequest<PlayerConfig>('/api/player/config')
      .then((cfg) => {
        setConfig(cfg);
        setDomain(cfg.defaultDomain);
        setPlayer(cfg.defaultPlayer);
        setColorHex(cfg.defaultColorHex);
      })
      .catch(() => {});
  }, []);

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

  // Resolve MegaEmbed URL from backend PlayerService
  const loadEmbed = useCallback(async () => {
    if (!tmdbId) return;
    setEmbedData(null);
    setIframeLoading(true);
    setIframeTimedOut(false);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        domain,
        player,
        color: colorHex,
      });
      if (mediaType === 'tv') {
        params.set('season', String(seasonParam));
        params.set('episode', String(episodeParam));
      }
      const res = await apiRequest<EmbedPlayResponse>(
        `/api/player/${mediaType}/${tmdbId}?${params.toString()}`
      );
      setEmbedData(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao resolver player MegaEmbed.');
      setIframeLoading(false);
    }
  }, [tmdbId, mediaType, domain, player, colorHex, seasonParam, episodeParam]);

  useEffect(() => {
    void loadEmbed();
  }, [loadEmbed, reloadNonce]);

  // Record playback history automatically
  useEffect(() => {
    if (!detail) return;
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
      playerProvider: player,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.tmdbId, seasonParam, episodeParam, player]);

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

  return (
    <div className="min-h-screen bg-[#03050e] text-white flex flex-col">
      {/* Top Cinema Control Bar */}
      <header className="px-4 sm:px-6 py-3 ms-glass border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--ms-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg font-bold truncate">
              {detail?.title || `Conteúdo TMDB #${tmdbId}`}
            </h1>
            <p className="text-xs text-slate-400 font-mono-tabular truncate">
              {mediaType === 'tv'
                ? `Série · TMDB #${tmdbId} · T${seasonParam} Ep.${episodeParam}`
                : `Filme · TMDB #${tmdbId}`}{' '}
              · MegaEmbed ({player})
              {previousProgress ? ` · Retomado (${Math.round(previousProgress.progressPercent)}%)` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Player Provider Selector */}
          <select
            value={player}
            onChange={(e) => setPlayer(e.target.value as MegaEmbedPlayer)}
            aria-label="Selecionar player MegaEmbed"
            className="h-10 px-3 rounded-xl bg-black/50 border text-xs sm:text-sm text-white"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            {(config?.availablePlayers ?? ['vidstack', 'megaplay', 'megatube', 'clappr']).map((p) => (
              <option key={p} value={p}>
                Player: {p}
              </option>
            ))}
          </select>

          {/* Domain Selector */}
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as MegaEmbedDomain)}
            aria-label="Selecionar domínio MegaEmbed"
            className="h-10 px-3 rounded-xl bg-black/50 border text-xs sm:text-sm text-white"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            {(config?.availableDomains ?? ['mgeb.lat', 'mgeb.space']).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Color Selector */}
          <div className="flex items-center gap-1.5 px-2.5 h-10 rounded-xl bg-black/50 border" style={{ borderColor: 'var(--ms-border)' }}>
            <Palette className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setColorHex(preset.hex)}
                aria-label={`Cor do player: ${preset.label}`}
                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform ${
                  colorHex === preset.hex ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: `#${preset.hex}` }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="h-10 px-3 rounded-xl ms-glass text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Recarregar
          </button>

          <button
            type="button"
            onClick={handleFullscreenLandscape}
            className="h-10 px-3.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            Tela Cheia
          </button>
        </div>
      </header>

      {/* Main Responsive Player Area + Series Episode List */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        <div className={mediaType === 'tv' ? 'lg:col-span-8 xl:col-span-9 space-y-3' : 'lg:col-span-12 space-y-3'}>
          <div
            ref={containerRef}
            className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border shadow-2xl"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            {embedData?.embedUrl && !errorMsg && (
              <iframe
                key={`${embedData.embedUrl}-${reloadNonce}`}
                src={embedData.embedUrl}
                title={detail?.title || `Player MegaEmbed ${tmdbId}`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                referrerPolicy="no-referrer"
                onLoad={() => {
                  setIframeLoading(false);
                  setIframeTimedOut(false);
                }}
                onError={() => {
                  setIframeLoading(false);
                  setErrorMsg('Erro ao carregar o iframe do provedor.');
                }}
              />
            )}

            {iframeLoading && !errorMsg && (
              <div className="absolute inset-0 bg-[#050814]/90 flex flex-col items-center justify-center gap-3 p-6 text-center pointer-events-none">
                <div className="w-10 h-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-sm font-medium text-white">
                  Carregando reprodução via MegaEmbed ({domain})...
                </p>
                {iframeTimedOut && (
                  <p className="text-xs text-amber-300 max-w-md pointer-events-auto">
                    O provedor está demorando para responder. Você pode trocar o player/domínio acima ou tentar novamente.
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

          {embedData && (
            <div className="ms-glass rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <span className="font-mono-tabular truncate">
                Fonte incorporada: <strong className="text-sky-300">{embedData.embedUrl}</strong>
              </span>
              <button
                type="button"
                onClick={() => setDomain((d) => (d === 'mgeb.lat' ? 'mgeb.space' : 'mgeb.lat'))}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium whitespace-nowrap cursor-pointer"
              >
                Alternar domínio ({domain === 'mgeb.lat' ? 'mgeb.space' : 'mgeb.lat'})
              </button>
            </div>
          )}

          {embedData?.seriesSupportNote && (
            <div className="ms-glass rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-sky-200">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{embedData.seriesSupportNote}</p>
            </div>
          )}
        </div>

        {/* Episode Selector Sidebar for Series */}
        {mediaType === 'tv' && (
          <aside className="lg:col-span-4 xl:col-span-3 ms-glass rounded-2xl p-4 flex flex-col max-h-[600px]">
            <div className="space-y-2.5 pb-3 border-b" style={{ borderColor: 'var(--ms-border)' }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-sky-400" />
                  Episódios · Temp. {seasonParam}
                </h2>
                <Link
                  to={`/series/${tmdbId}`}
                  className="text-xs text-sky-300 hover:underline"
                >
                  Ver série
                </Link>
              </div>
              {detail?.seasons && detail.seasons.length > 0 && (
                <select
                  value={seasonParam}
                  onChange={(e) =>
                    setSearchParams({
                      season: e.target.value,
                      episode: '1',
                    })
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
                      setSearchParams({
                        season: String(ep.seasonNumber),
                        episode: String(ep.episodeNumber),
                      })
                    }
                    className={`w-full text-left p-2.5 rounded-xl transition-colors cursor-pointer ${
                      isCurrent ? 'text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                    style={isCurrent ? { backgroundColor: 'var(--ms-accent)' } : undefined}
                  >
                    <p className="text-xs font-mono-tabular opacity-80">
                      Episódio {ep.episodeNumber}
                    </p>
                    <p className="text-sm font-semibold truncate">{ep.name}</p>
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
