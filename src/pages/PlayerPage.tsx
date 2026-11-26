import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  FastForward,
  Film,
  Maximize2,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatRuntimeMinutes } from '../../shared/catalogUtils';
import {
  PLAYER_LAST_ROUTE_KEY,
  parsePlayerPostMessageEvent,
  resolveNextEpisode,
  resolvePlayerBackTarget,
} from '../../shared/playerNavigation';
import type {
  IframeSandboxPolicy,
  MediaDetail,
  MediaType,
  PlayerAudioOption,
  PlayerBrandingConfig,
  SeasonDetail,
  StreamKind,
  SubtitleTrack,
  WatermarkPosition,
  WatermarkSize,
} from '../../shared/types';
import { WatchaPlayer } from '../components/player/WatchaPlayer';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { apiRequest } from '../services/apiClient';

interface CleanStreamPayload {
  tmdbId: number;
  mediaType: MediaType;
  embedUrl: string;
  streamKind?: StreamKind;
  sandboxPolicy?: IframeSandboxPolicy;
  referrerPolicy?: 'no-referrer' | 'strict-origin';
  seasonNumber?: number;
  episodeNumber?: number;
  branding?: PlayerBrandingConfig;
  audioOptions?: PlayerAudioOption[];
  subtitles?: SubtitleTrack[];
  posterUrl?: string | null;
  streamUnavailableReason?: string | null;
}

const WATERMARK_POSITION_MAP: Record<WatermarkPosition, string> = {
  'top-left': 'top-2.5 left-3 sm:top-3 sm:left-3.5',
  'top-right': 'top-1.5 right-2 sm:top-2 sm:right-2.5',
  'bottom-left': 'bottom-14 left-3 sm:bottom-16 sm:left-4',
  'bottom-right': 'bottom-14 right-3 sm:bottom-16 sm:right-4',
};

const WATERMARK_SIZE_MAP: Record<WatermarkSize, { box: string; icon: number; text: string }> = {
  sm: { box: 'px-2.5 py-1 gap-1.5', icon: 16, text: 'text-[11px]' },
  md: { box: 'px-3 py-1.5 gap-2', icon: 20, text: 'text-xs sm:text-sm' },
  lg: { box: 'px-3.5 py-2 gap-2.5', icon: 24, text: 'text-sm sm:text-base' },
};

export function PlayerPage() {
  const { type, tmdbId } = useParams<{ type: string; tmdbId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    recordPlayback,
    history,
    loading: authLoading,
    firebaseUser,
    profile,
    activeProfile,
  } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { siteConfig, runtimeSettings, playerBranding } = useSiteConfig();

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

  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerTimedOut, setPlayerTimedOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [fallbackActivityNonce, setFallbackActivityNonce] = useState(0);

  // Auto-next state
  const effectiveBranding = embedData?.branding ?? playerBranding;
  const [autoNextOverride, setAutoNextOverride] = useState<boolean | null>(null);
  const autoNextEnabled =
    autoNextOverride !== null
      ? autoNextOverride
      : activeProfile?.autoplayNext ?? effectiveBranding.autoNextEpisode;

  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [autoNextDismissed, setAutoNextDismissed] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const recordedKeyRef = useRef<string | null>(null);

  // Reset countdown when episode changes
  useEffect(() => {
    setNextCountdown(null);
    setAutoNextDismissed(false);
  }, [tmdbId, mediaType, seasonParam, episodeParam, reloadNonce]);

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
  const authPending = runtimeSettings.requireAuthForPlayer && authLoading;
  const authBlocked = runtimeSettings.requireAuthForPlayer && !authLoading && !firebaseUser;

  const loadEmbed = useCallback(async () => {
    if (!tmdbId || authPending || authBlocked) return;
    setEmbedData(null);
    setPlayerLoading(true);
    setPlayerTimedOut(false);
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
      if (res.streamUnavailableReason) {
        setErrorMsg(res.streamUnavailableReason);
        setPlayerLoading(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível iniciar a reprodução.');
      setPlayerLoading(false);
    }
  }, [tmdbId, authPending, authBlocked, mediaType, seasonParam, episodeParam]);

  useEffect(() => {
    void loadEmbed();
  }, [loadEmbed, reloadNonce]);

  // Preconnect dynamically to resolved stream origin for faster handshake
  useEffect(() => {
    if (!embedData?.embedUrl) return;
    let linkEl: HTMLLinkElement | null = null;
    try {
      const origin = new URL(embedData.embedUrl).origin;
      linkEl = document.createElement('link');
      linkEl.rel = 'preconnect';
      linkEl.href = origin;
      document.head.appendChild(linkEl);
    } catch {
      // Ignore malformed URLs
    }
    return () => {
      if (linkEl && linkEl.parentNode) {
        linkEl.parentNode.removeChild(linkEl);
      }
    };
  }, [embedData?.embedUrl]);

  const handleWatchProgress = useCallback(
    (pct: number) => {
      if (!detail) return;
      void recordPlayback({
        tmdbId: detail.tmdbId,
        mediaType: detail.mediaType,
        title: detail.title,
        posterPath: detail.posterPath,
        backdropPath: detail.backdropPath,
        progressPercent: Math.max(5, Math.min(99, pct)),
        seasonNumber: mediaType === 'tv' ? seasonParam : undefined,
        episodeNumber: mediaType === 'tv' ? episodeParam : undefined,
      });
    },
    [detail, mediaType, seasonParam, episodeParam, recordPlayback]
  );

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

  // Timeout guard if player does not become ready within configured seconds
  useEffect(() => {
    if (!playerLoading || authBlocked || authPending) return;
    const timeoutMs = Math.max(5, Math.min(30, runtimeSettings.embedTimeoutSeconds || 12)) * 1000;
    const timer = setTimeout(() => {
      setPlayerTimedOut(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [
    playerLoading,
    authBlocked,
    authPending,
    reloadNonce,
    fallbackActivityNonce,
    embedData?.embedUrl,
    runtimeSettings.embedTimeoutSeconds,
  ]);

  const currentEpisode =
    mediaType === 'tv'
      ? seasonDetail?.episodes.find((ep) => ep.episodeNumber === episodeParam) ?? null
      : null;

  const nextEpisode = useMemo(() => {
    if (mediaType !== 'tv') return null;
    return resolveNextEpisode({
      currentSeason: seasonParam,
      currentEpisode: episodeParam,
      seasons: detail?.seasons,
      episodes: seasonDetail?.episodes,
    });
  }, [mediaType, seasonParam, episodeParam, detail?.seasons, seasonDetail?.episodes]);

  const goToNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    setNextCountdown(null);
    setAutoNextDismissed(false);
    setSearchParams(
      {
        season: String(nextEpisode.seasonNumber),
        episode: String(nextEpisode.episodeNumber),
      },
      { replace: true }
    );
  }, [nextEpisode, setSearchParams]);

  const triggerNextCountdown = useCallback(() => {
    if (!nextEpisode || !autoNextEnabled || autoNextDismissed) return;
    setNextCountdown((curr) =>
      curr === null ? effectiveBranding.autoNextCountdownSeconds || 8 : curr
    );
  }, [
    nextEpisode,
    autoNextEnabled,
    autoNextDismissed,
    effectiveBranding.autoNextCountdownSeconds,
  ]);

  // Listen to player postMessage completion events (iframe embeds)
  useEffect(() => {
    if (mediaType !== 'tv' || !nextEpisode) return;
    const handleMessage = (event: MessageEvent) => {
      const parsed = parsePlayerPostMessageEvent(event.data);
      if (parsed.nextRequested && autoNextEnabled) {
        goToNextEpisode();
      } else if (parsed.ended) {
        triggerNextCountdown();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mediaType, nextEpisode, autoNextEnabled, goToNextEpisode, triggerNextCountdown]);

  // Fallback runtime timer for iframe embeds when episode runtime is known
  useEffect(() => {
    if (
      mediaType !== 'tv' ||
      !nextEpisode ||
      !autoNextEnabled ||
      autoNextDismissed ||
      playerLoading ||
      errorMsg ||
      embedData?.streamKind !== 'iframe'
    ) {
      return;
    }
    const runtimeMinutes = currentEpisode?.runtime ?? detail?.runtime ?? null;
    if (!runtimeMinutes || runtimeMinutes < 5) return;
    const countdownSec = effectiveBranding.autoNextCountdownSeconds || 8;
    const triggerDelayMs = Math.max(15_000, (runtimeMinutes * 60 - countdownSec) * 1000);
    const timer = setTimeout(() => {
      triggerNextCountdown();
    }, triggerDelayMs);
    return () => clearTimeout(timer);
  }, [
    mediaType,
    nextEpisode,
    autoNextEnabled,
    autoNextDismissed,
    playerLoading,
    errorMsg,
    embedData?.streamKind,
    currentEpisode?.runtime,
    detail?.runtime,
    effectiveBranding.autoNextCountdownSeconds,
    triggerNextCountdown,
  ]);

  // Drive active next-episode countdown tick
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      goToNextEpisode();
      return;
    }
    const timer = setTimeout(() => {
      setNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, goToNextEpisode]);

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

  const streamKind: StreamKind = embedData?.streamKind ?? 'iframe';

  const playerAccentHex = `#${effectiveBranding.colorHex || siteConfig.accentColorHex || '00a8ff'}`;
  const watermarkLabel =
    effectiveBranding.watermarkText.trim() || siteConfig.siteName || 'MegaStream';
  const watermarkLogo = effectiveBranding.watermarkLogoUrl.trim() || siteConfig.logoUrl || '';
  const wmSizeCfg = WATERMARK_SIZE_MAP[effectiveBranding.watermarkSize || 'md'];
  const wmPosClass = WATERMARK_POSITION_MAP[effectiveBranding.watermarkPosition || 'top-left'];
  const totalCountdown = effectiveBranding.autoNextCountdownSeconds || 8;

  return (
    <div
      className="min-h-screen bg-[#03050e] text-white flex flex-col"
      style={{ '--ms-player-accent': playerAccentHex } as React.CSSProperties}
    >
      {/* Clean Custom MegaStream Cinema Control Bar */}
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
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider shrink-0"
                style={{ color: playerAccentHex }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: playerAccentHex }}
                />
                {watermarkLabel}
              </span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <h1 className="font-display text-base sm:text-lg font-bold truncate">
                {detail?.title || 'Reproduzindo conteúdo'}
              </h1>
            </div>
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

        <div className="flex flex-wrap items-center gap-2">
          {mediaType === 'tv' && (
            <button
              type="button"
              onClick={() => setAutoNextOverride((prev) => !(prev ?? autoNextEnabled))}
              aria-pressed={autoNextEnabled}
              className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                autoNextEnabled
                  ? 'bg-white/10 text-white border-white/25'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
              style={
                autoNextEnabled
                  ? { borderColor: `${playerAccentHex}88`, color: '#ffffff' }
                  : undefined
              }
              title="Alternar avanço automático para o próximo episódio"
            >
              <FastForward
                className="w-3.5 h-3.5"
                style={autoNextEnabled ? { color: playerAccentHex } : undefined}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Auto-próximo:</span>
              <span>{autoNextEnabled ? 'Ativo' : 'Desativado'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="h-10 px-3.5 rounded-xl ms-glass text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          <button
            type="button"
            onClick={handleFullscreenLandscape}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: playerAccentHex }}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            Tela Cheia
          </button>
        </div>
      </header>

      {/* Main Clean Video Area + Title / Episode Details */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        <div
          className={
            mediaType === 'tv' && !theaterMode
              ? 'lg:col-span-8 xl:col-span-9 space-y-5'
              : 'lg:col-span-12 space-y-5'
          }
        >
          <div
            ref={containerRef}
            className={`relative w-full rounded-2xl overflow-hidden bg-black border shadow-2xl ${
              errorMsg || authBlocked ? 'min-h-[260px] sm:aspect-video' : 'aspect-video'
            }`}
            style={{ borderColor: `${playerAccentHex}55` }}
          >
            {authBlocked ? (
              <div className="w-full min-h-[260px] sm:absolute sm:inset-0 bg-[#050814] flex flex-col items-center justify-center gap-4 px-5 py-7 sm:p-6 text-center">
                <AlertTriangle className="w-9 h-9 sm:w-10 sm:h-10 text-sky-400 shrink-0" />
                <div className="space-y-1.5 max-w-md">
                  <p className="text-base font-bold text-white">Login necessário para assistir</p>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    O administrador restringiu o player apenas para usuários autenticados na plataforma.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 justify-center pt-1">
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: playerAccentHex }}
                  >
                    Entrar na Conta
                  </Link>
                  <button
                    type="button"
                    onClick={handleExitPlayer}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {embedData?.embedUrl && !errorMsg && (
                  <WatchaPlayer
                    key={`${embedData.embedUrl}-${reloadNonce}`}
                    streamUrl={embedData.embedUrl}
                    streamKind={streamKind}
                    sandboxPolicy={embedData.sandboxPolicy}
                    referrerPolicy={embedData.referrerPolicy}
                    title={detail?.title || 'Reproduzindo conteúdo'}
                    subtitleMeta={
                      mediaType === 'tv'
                        ? `Temp. ${seasonParam} · Ep. ${episodeParam}${
                            currentEpisode?.name ? ` — ${currentEpisode.name}` : ''
                          }`
                        : detail?.releaseYear || undefined
                    }
                    posterUrl={embedData.posterUrl || detail?.backdropPath}
                    accentColor={playerAccentHex}
                    audioOptions={embedData.audioOptions}
                    subtitles={embedData.subtitles}
                    preferredLang={effectiveBranding.preferredLang}
                    defaultAspectMode={effectiveBranding.defaultAspectMode}
                    autoEnableSubtitles={effectiveBranding.autoEnableSubtitles}
                    defaultSubtitleSize={effectiveBranding.defaultSubtitleSize}
                    defaultSubtitleColor={effectiveBranding.defaultSubtitleColor}
                    defaultSubtitleBg={effectiveBranding.defaultSubtitleBg}
                    allowTvCast={effectiveBranding.allowTvCast}
                    allowPipMode={effectiveBranding.allowPipMode}
                    allowTheaterMode={effectiveBranding.allowTheaterMode}
                    initialProgressPercent={previousProgress?.progressPercent}
                    autoNextEnabled={autoNextEnabled}
                    onToggleAutoNext={() => setAutoNextOverride((prev) => !(prev ?? autoNextEnabled))}
                    nextEpisode={nextEpisode}
                    onNextEpisode={goToNextEpisode}
                    isCountdownActive={nextCountdown !== null}
                    onEnded={triggerNextCountdown}
                    onProgress={handleWatchProgress}
                    theaterMode={theaterMode}
                    onToggleTheater={() => setTheaterMode((prev) => !prev)}
                    onRequestFullscreenContainer={handleFullscreenLandscape}
                    onReady={() => {
                      setPlayerLoading(false);
                      setPlayerTimedOut(false);
                    }}
                    onAttemptingFallback={() => {
                      setPlayerTimedOut(false);
                      setFallbackActivityNonce((n) => n + 1);
                    }}
                    onStreamError={(msg) => {
                      setPlayerLoading(false);
                      setErrorMsg(msg);
                    }}
                  />
                )}

                {/* Watermark Overlay only for external fallback iframes when explicitly enabled */}
                {!errorMsg && streamKind === 'iframe' && effectiveBranding.watermarkEnabled && (
                  <div
                    data-testid="player-watermark"
                    className={`absolute ${wmPosClass} z-10 pointer-events-none select-none flex items-center rounded-xl bg-[#050814]/92 backdrop-blur-md border border-white/15 shadow-lg ${wmSizeCfg.box}`}
                    style={{ opacity: effectiveBranding.watermarkOpacity }}
                  >
                    {watermarkLogo ? (
                      <img
                        src={watermarkLogo}
                        alt={watermarkLabel}
                        referrerPolicy="no-referrer"
                        style={{ width: wmSizeCfg.icon, height: wmSizeCfg.icon }}
                        className="rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <svg
                        width={wmSizeCfg.icon}
                        height={wmSizeCfg.icon}
                        viewBox="0 0 40 40"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 7.2C9 4.8 11.6 3.3 13.7 4.5L34.2 16.3C36.3 17.5 36.3 20.5 34.2 21.7L13.7 33.5C11.6 34.7 9 33.2 9 30.8V7.2Z"
                          stroke={playerAccentHex}
                          strokeWidth="3.2"
                          fill={`${playerAccentHex}33`}
                        />
                        <path
                          d="M15.5 13.4C15.5 12.1 16.9 11.3 18 12L27.8 17.6C28.9 18.2 28.9 19.8 27.8 20.4L18 26C16.9 26.7 15.5 25.9 15.5 24.6V13.4Z"
                          fill="#ffffff"
                        />
                      </svg>
                    )}
                    <span
                      className={`font-display font-extrabold tracking-tight text-white drop-shadow ${wmSizeCfg.text}`}
                    >
                      {watermarkLabel}
                    </span>
                  </div>
                )}

                {/* Auto-Next Episode Countdown Card */}
                {nextCountdown !== null && nextEpisode && !errorMsg && (
                  <div
                    role="dialog"
                    aria-label="Próximo episódio automático"
                    className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 w-[min(92%,340px)] rounded-2xl bg-[#070b18]/95 backdrop-blur-xl border border-white/15 p-4 shadow-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-mono-tabular font-bold uppercase tracking-wider"
                          style={{ color: playerAccentHex }}
                        >
                          Próximo episódio em {nextCountdown}s
                        </p>
                        <p className="font-display text-sm font-bold text-white truncate mt-0.5">
                          T{nextEpisode.seasonNumber} · E{nextEpisode.episodeNumber} — {nextEpisode.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNextCountdown(null);
                          setAutoNextDismissed(true);
                        }}
                        aria-label="Cancelar próximo episódio automático"
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full transition-all duration-700"
                        style={{
                          width: `${Math.max(0, Math.min(100, (nextCountdown / totalCountdown) * 100))}%`,
                          backgroundColor: playerAccentHex,
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={goToNextEpisode}
                        className="flex-1 h-9 px-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ backgroundColor: playerAccentHex }}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                        Assistir Agora
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNextCountdown(null);
                          setAutoNextDismissed(true);
                        }}
                        className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {!errorMsg && (!embedData || streamKind === 'iframe') && (
                  <div
                    className={`absolute inset-0 bg-[#050814]/85 flex flex-col items-center justify-center gap-3 p-6 text-center transition-opacity duration-300 pointer-events-none ${
                      playerLoading ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${playerAccentHex} transparent ${playerAccentHex} ${playerAccentHex}` }}
                    />
                    <p className="text-sm font-medium text-white">Carregando reprodução...</p>
                    {playerTimedOut && playerLoading && (
                      <div className="space-y-2.5 max-w-md pointer-events-auto">
                        <p className="text-xs text-slate-300">
                          Este player está demorando para responder ou não possui stream disponível no momento.
                        </p>
                        <button
                          type="button"
                          onClick={() => setReloadNonce((n) => n + 1)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                          style={{ backgroundColor: playerAccentHex }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          Tentar Novamente
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="w-full min-h-[260px] sm:absolute sm:inset-0 bg-[#050814] flex flex-col items-center justify-center gap-4 px-5 py-7 sm:p-6 text-center">
                    <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-400/25 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <p className="text-sm sm:text-base font-bold text-white">
                        Reprodução indisponível no momento
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {errorMsg}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setReloadNonce((n) => n + 1)}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: playerAccentHex }}
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        Tentar Novamente
                      </button>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-semibold text-white"
                        >
                          Painel Adm
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleExitPlayer}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-semibold text-white cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                        Voltar
                      </button>
                    </div>
                  </div>
                )}
              </>
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
                    <span
                      className="text-xs font-semibold font-mono-tabular"
                      style={{ color: playerAccentHex }}
                    >
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
                        <span style={{ color: playerAccentHex }}>
                          {detail.genres.map((g) => g.name).join(' / ')}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    {mediaType === 'tv' ? (
                      <Tv className="w-4 h-4 shrink-0" style={{ color: playerAccentHex }} aria-hidden="true" />
                    ) : (
                      <Film className="w-4 h-4 shrink-0" style={{ color: playerAccentHex }} aria-hidden="true" />
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
          <aside
            className={
              theaterMode
                ? 'lg:col-span-12 ms-glass rounded-2xl p-4 flex flex-col max-h-[520px]'
                : 'lg:col-span-4 xl:col-span-3 ms-glass rounded-2xl p-4 flex flex-col max-h-[680px]'
            }
          >
            <div className="space-y-2.5 pb-3 border-b" style={{ borderColor: 'var(--ms-border)' }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4" style={{ color: playerAccentHex }} />
                  Episódios · Temp. {seasonParam}
                </h2>
                <Link
                  to={`/series/${tmdbId}`}
                  className="text-xs hover:underline"
                  style={{ color: playerAccentHex }}
                >
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
                    style={isCurrent ? { backgroundColor: playerAccentHex } : undefined}
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
