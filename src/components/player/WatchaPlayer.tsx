import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import QRCode from 'qrcode';
import {
  Captions,
  Cast,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FastForward,
  Gauge,
  Languages,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Tv,
  Unlock,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import {
  buildAndroidIntentUrl,
  buildM3uPlaylistContent,
  buildVlcStreamUrl,
  isLocalhostOrigin,
  resolveLanShareUrl,
  sanitizeM3uFileName,
  toAbsoluteStreamUrl,
} from '../../../shared/castUtils';
import {
  shouldShowSkipNextInPlayer,
  type NextEpisodeTarget,
} from '../../../shared/playerNavigation';
import {
  hasNextPlayableCandidate,
  pickNextPlayableCandidate,
  shouldAutoRetryMutedOnPlayError,
} from '../../../shared/playerFailover';
import { getCustomSourceLangMeta } from '../../../shared/playerUrl';
import { convertSrtToVtt, parseVttCues, type VttCueItem } from '../../../shared/subtitleUtils';
import type {
  IframeSandboxPolicy,
  NetworkInfoResponse,
  PlayerAspectMode,
  PlayerAudioOption,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  StreamKind,
  SubtitleTrack,
} from '../../../shared/types';

type AspectMode = PlayerAspectMode;
type SubtitleSize = PlayerSubtitleSize;
type SubtitleColor = PlayerSubtitleColor;
type SubtitleBg = PlayerSubtitleBg;
type SettingsPanelView = 'root' | 'quality' | 'speed' | 'aspect';
type ActivePopover = 'none' | 'audio' | 'subtitles' | 'settings' | 'cast';

interface SubtitleAppearance {
  size: SubtitleSize;
  color: SubtitleColor;
  bg: SubtitleBg;
  offsetSeconds: number;
}

interface WatchaPlayerProps {
  streamUrl: string;
  streamKind: StreamKind;
  sandboxPolicy?: IframeSandboxPolicy;
  referrerPolicy?: 'no-referrer' | 'strict-origin';
  title: string;
  subtitleMeta?: string;
  posterUrl?: string | null;
  accentColor: string;
  audioOptions?: PlayerAudioOption[];
  subtitles?: SubtitleTrack[];
  preferredLang?: 'pt' | 'en';
  defaultAspectMode?: AspectMode;
  autoEnableSubtitles?: boolean;
  defaultSubtitleSize?: SubtitleSize;
  defaultSubtitleColor?: SubtitleColor;
  defaultSubtitleBg?: SubtitleBg;
  allowTvCast?: boolean;
  allowPipMode?: boolean;
  allowTheaterMode?: boolean;
  initialProgressPercent?: number;
  autoNextEnabled?: boolean;
  onToggleAutoNext?: () => void;
  nextEpisode?: NextEpisodeTarget | null;
  onNextEpisode?: () => void;
  isCountdownActive?: boolean;
  onEnded?: () => void;
  onProgress?: (percent: number) => void;
  theaterMode?: boolean;
  onToggleTheater?: () => void;
  onRequestFullscreenContainer?: () => void;
  onStreamError?: (msg: string) => void;
  onReady?: () => void;
  onAttemptingFallback?: () => void;
}

const DEFAULT_SUB_STYLE: SubtitleAppearance = {
  size: 'md',
  color: 'white',
  bg: 'box',
  offsetSeconds: 0,
};

const SUB_STYLE_STORAGE_KEY = 'ms_watcha_sub_style_v1';
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const EMPTY_AUDIO_OPTIONS: PlayerAudioOption[] = [];
const EMPTY_SUBTITLES: SubtitleTrack[] = [];

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const total = Math.floor(totalSeconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function WatchaPlayer({
  streamUrl,
  streamKind,
  sandboxPolicy = 'strict_no_ads',
  referrerPolicy = 'strict-origin',
  title,
  subtitleMeta,
  posterUrl,
  accentColor,
  audioOptions = EMPTY_AUDIO_OPTIONS,
  subtitles = EMPTY_SUBTITLES,
  preferredLang = 'pt',
  defaultAspectMode = 'contain',
  autoEnableSubtitles = false,
  defaultSubtitleSize = 'md',
  defaultSubtitleColor = 'white',
  defaultSubtitleBg = 'box',
  allowTvCast = true,
  allowPipMode = true,
  allowTheaterMode = true,
  initialProgressPercent,
  autoNextEnabled = true,
  onToggleAutoNext,
  nextEpisode,
  onNextEpisode,
  isCountdownActive = false,
  onEnded,
  onProgress,
  theaterMode = false,
  onToggleTheater,
  onRequestFullscreenContainer,
  onStreamError,
  onReady,
  onAttemptingFallback,
}: WatchaPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<number | null>(null);
  const resumeAppliedForUrlRef = useRef<string | null>(null);
  const pendingRestoreTimeRef = useRef<number | null>(null);
  const lastReportedPctRef = useRef<number>(0);
  const initialProgressPercentRef = useRef<number | undefined>(initialProgressPercent);
  const onStreamErrorRef = useRef(onStreamError);
  const onReadyRef = useRef(onReady);
  const onAttemptingFallbackRef = useRef(onAttemptingFallback);
  const hasUserChangedAspectRef = useRef(false);
  const hasCustomLocalSubStyleRef = useRef(false);
  const userToggledSubRef = useRef<string | null>(null);
  const autoSubAppliedForUrlRef = useRef<string | null>(null);
  const failedAudioIdsRef = useRef<Set<string>>(new Set());
  const failedStreamUrlsRef = useRef<Set<string>>(new Set());
  const lastFailedUrlTriggeredRef = useRef<string | null>(null);
  const candidateReadyRef = useRef<boolean>(false);
  const lastProgressSnapshotRef = useRef<{ time: number; updatedAt: number }>({
    time: 0,
    updatedAt: Date.now(),
  });

  useEffect(() => {
    initialProgressPercentRef.current = initialProgressPercent;
  }, [initialProgressPercent]);

  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onAttemptingFallbackRef.current = onAttemptingFallback;
  }, [onAttemptingFallback]);

  // Active stream source (switchable via Idioma or automatic runtime failover)
  const [selectedAudioId, setSelectedAudioId] = useState<string>(
    audioOptions[0]?.id || 'default'
  );
  const [activeBackupStream, setActiveBackupStream] = useState<{
    streamUrl: string;
    streamKind: StreamKind;
  } | null>(null);

  const activeStream = useMemo(() => {
    const found = audioOptions.find((o) => o.id === selectedAudioId);
    const base =
      found || {
        id: 'default',
        label: preferredLang === 'en' ? 'Inglês / Original' : 'Dublado (PT-BR)',
        languageLabel: preferredLang === 'en' ? 'Inglês / Original' : 'Dublado (PT-BR)',
        lang: preferredLang === 'en' ? 'en-us' : 'pt-br',
        streamUrl,
        streamKind,
      };
    if (activeBackupStream) {
      return {
        ...base,
        streamUrl: activeBackupStream.streamUrl,
        streamKind: activeBackupStream.streamKind,
      };
    }
    return base;
  }, [audioOptions, selectedAudioId, activeBackupStream, preferredLang, streamUrl, streamKind]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [autoMutedNotice, setAutoMutedNotice] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [aspectMode, setAspectMode] = useState<AspectMode>(defaultAspectMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  // UI overlays & popovers
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activePopover, setActivePopover] = useState<ActivePopover>('none');
  const [settingsView, setSettingsView] = useState<SettingsPanelView>('root');
  const [seekFeedback, setSeekFeedback] = useState<{ label: string; side: 'left' | 'right' } | null>(
    null
  );
  const [sourceSwitchToast, setSourceSwitchToast] = useState<string | null>(null);
  const [hoverSeek, setHoverSeek] = useState<{ pct: number; time: number } | null>(null);

  // HLS quality & internal audio tracks
  const [qualityLevels, setQualityLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [detectedHeight, setDetectedHeight] = useState<number>(0);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<Array<{ index: number; label: string }>>([]);
  const [currentHlsAudio, setCurrentHlsAudio] = useState<number>(0);

  // Subtitles state
  const [localSubtitles, setLocalSubtitles] = useState<SubtitleTrack[]>([]);
  const allSubtitles = useMemo(
    () => [...localSubtitles, ...subtitles],
    [localSubtitles, subtitles]
  );
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [subCues, setSubCues] = useState<VttCueItem[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subStyle, setSubStyle] = useState<SubtitleAppearance>(() => {
    try {
      const saved = localStorage.getItem(SUB_STYLE_STORAGE_KEY);
      if (saved) {
        hasCustomLocalSubStyleRef.current = true;
        return { ...DEFAULT_SUB_STYLE, ...(JSON.parse(saved) as Partial<SubtitleAppearance>) };
      }
    } catch {
      // ignore
    }
    return {
      size: defaultSubtitleSize,
      color: defaultSubtitleColor,
      bg: defaultSubtitleBg,
      offsetSeconds: 0,
    };
  });

  // TV Mirroring / Cast & Same-Wi-Fi LAN Origin state
  const [castQrDataUrl, setCastQrDataUrl] = useState<string>('');
  const [castStatusMsg, setCastStatusMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [directCopied, setDirectCopied] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoResponse | null>(null);
  const [useLanOrigin, setUseLanOrigin] = useState<boolean>(true);
  const [isCastConnected, setIsCastConnected] = useState<boolean>(false);
  const [castDeviceName, setCastDeviceName] = useState<string>('');

  useEffect(() => {
    const checkCastApi = () => {
      const gCast = (window as unknown as { cast?: { framework?: { CastContext?: { getInstance: () => { getCurrentSession: () => { getCastDevice?: () => { friendlyName?: string } } | null; addEventListener: (event: string, handler: (e: { sessionState?: string }) => void) => void } } } } }).cast;
      if (gCast?.framework?.CastContext?.getInstance) {
        try {
          const castContext = gCast.framework.CastContext.getInstance();
          const current = castContext.getCurrentSession();
          if (current) {
            setIsCastConnected(true);
            setCastDeviceName(current.getCastDevice?.()?.friendlyName || 'Google Cast');
          }
          const framework = (window as unknown as { cast?: { framework?: { CastContextEventType?: { SESSION_STATE_CHANGED?: string }; SessionState?: { SESSION_STARTED?: string; SESSION_RESUMED?: string; SESSION_ENDED?: string } } } }).cast?.framework;
          if (framework?.CastContextEventType?.SESSION_STATE_CHANGED && framework?.SessionState) {
            castContext.addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, (evt) => {
              if (
                evt.sessionState === framework.SessionState?.SESSION_STARTED ||
                evt.sessionState === framework.SessionState?.SESSION_RESUMED
              ) {
                const s = castContext.getCurrentSession();
                setIsCastConnected(true);
                setCastDeviceName(s?.getCastDevice?.()?.friendlyName || 'Google Cast');
                setCastStatusMsg(`Conectado ao ${s?.getCastDevice?.()?.friendlyName || 'Google Cast'}!`);
              } else if (evt.sessionState === framework.SessionState?.SESSION_ENDED) {
                setIsCastConnected(false);
                setCastDeviceName('');
                setCastStatusMsg('Transmissão Google Cast encerrada.');
              }
            });
          }
        } catch {
          // Ignore initialization error if SDK is still loading
        }
      }
    };

    checkCastApi();
    window.addEventListener('google-cast-api-ready', checkCastApi);
    return () => {
      window.removeEventListener('google-cast-api-ready', checkCastApi);
    };
  }, []);

  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const hasLocalhostOrigin = isLocalhostOrigin(browserOrigin);
  const effectiveCastOrigin =
    hasLocalhostOrigin && useLanOrigin && networkInfo?.preferredLanOrigin
      ? networkInfo.preferredLanOrigin
      : browserOrigin;
  const castPageUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return resolveLanShareUrl(window.location.href, effectiveCastOrigin);
  }, [effectiveCastOrigin]);

  const directStreamUrl = useMemo(
    () => toAbsoluteStreamUrl(activeStream.streamUrl, effectiveCastOrigin),
    [activeStream.streamUrl, effectiveCastOrigin]
  );
  const androidIntentUrl = useMemo(
    () => buildAndroidIntentUrl(activeStream.streamUrl, title, effectiveCastOrigin),
    [activeStream.streamUrl, title, effectiveCastOrigin]
  );
  const vlcStreamUrl = useMemo(
    () => buildVlcStreamUrl(activeStream.streamUrl, effectiveCastOrigin),
    [activeStream.streamUrl, effectiveCastOrigin]
  );

  const updateSubStyle = useCallback(
    (updater: (prev: SubtitleAppearance) => SubtitleAppearance) => {
      hasCustomLocalSubStyleRef.current = true;
      setSubStyle((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(SUB_STYLE_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  // Sync admin default aspect mode unless viewer switched aspect manually
  useEffect(() => {
    if (!hasUserChangedAspectRef.current) {
      setAspectMode(defaultAspectMode);
    }
  }, [defaultAspectMode]);

  // Sync admin default subtitle styling unless viewer customized subtitles locally
  useEffect(() => {
    if (!hasCustomLocalSubStyleRef.current) {
      setSubStyle((prev) => ({
        ...prev,
        size: defaultSubtitleSize,
        color: defaultSubtitleColor,
        bg: defaultSubtitleBg,
      }));
    }
  }, [defaultSubtitleSize, defaultSubtitleColor, defaultSubtitleBg]);

  // Auto-enable subtitles in preferred language when configured by Admin
  useEffect(() => {
    if (
      !autoEnableSubtitles ||
      allSubtitles.length === 0 ||
      autoSubAppliedForUrlRef.current === streamUrl ||
      userToggledSubRef.current === streamUrl
    ) {
      return;
    }
    autoSubAppliedForUrlRef.current = streamUrl;
    const preferredTrack =
      preferredLang === 'en'
        ? allSubtitles.find((s) => s.lang === 'eng') || allSubtitles[0]
        : allSubtitles.find((s) => s.lang === 'pob') ||
          allSubtitles.find((s) => s.lang === 'por') ||
          allSubtitles[0];
    if (preferredTrack) {
      setSelectedSubtitleId(preferredTrack.id);
    }
  }, [autoEnableSubtitles, allSubtitles, preferredLang, streamUrl]);

  useEffect(() => {
    failedAudioIdsRef.current.clear();
    failedStreamUrlsRef.current.clear();
    lastFailedUrlTriggeredRef.current = null;
    setActiveBackupStream(null);
    setSelectedAudioId(audioOptions[0]?.id || 'default');
    setIsEnded(false);
  }, [streamUrl, audioOptions]);

  const scheduleHideControls = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    setControlsVisible(true);
    if (activePopover !== 'none') return;
    idleTimerRef.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) {
        setControlsVisible(false);
      }
    }, 3200);
  }, [activePopover]);

  useEffect(() => {
    scheduleHideControls();
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [scheduleHideControls, isPlaying]);

  // Track fullscreen status
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const attemptAutoPlay = useCallback((video: HTMLVideoElement) => {
    const p = video.play();
    if (!p || typeof p.catch !== 'function') return;
    p.catch((err: unknown) => {
      if (shouldAutoRetryMutedOnPlayError(err) && !video.muted) {
        video.muted = true;
        setIsMuted(true);
        setAutoMutedNotice(true);
        video.play().catch(() => {});
      }
    });
  }, []);

  const triggerNextBackupOptionOrError = useCallback(
    (fallbackMsg: string) => {
      const currentUrl = activeStream.streamUrl;
      if (currentUrl && lastFailedUrlTriggeredRef.current === currentUrl) {
        return;
      }
      if (currentUrl) {
        lastFailedUrlTriggeredRef.current = currentUrl;
        failedStreamUrlsRef.current.add(currentUrl);
      }

      const next = pickNextPlayableCandidate({
        activeOptionId: activeStream.id,
        activeStreamUrl: currentUrl,
        audioOptions,
        failedAudioIds: failedAudioIdsRef.current,
        failedStreamUrls: failedStreamUrlsRef.current,
      });

      if (next) {
        onAttemptingFallbackRef.current?.();
        if (videoRef.current && Number.isFinite(videoRef.current.currentTime)) {
          pendingRestoreTimeRef.current = videoRef.current.currentTime;
        }
        if (next.kind === 'backup') {
          setActiveBackupStream({
            streamUrl: next.streamUrl,
            streamKind: next.streamKind,
          });
        } else {
          failedAudioIdsRef.current.add(activeStream.id);
          const targetOpt = audioOptions.find((o) => o.id === next.targetOptionId);
          if (targetOpt && next.streamUrl === targetOpt.streamUrl) {
            setActiveBackupStream(null);
          } else {
            setActiveBackupStream({
              streamUrl: next.streamUrl,
              streamKind: next.streamKind,
            });
          }
          setSelectedAudioId(next.targetOptionId);
          if (next.switchedLanguage) {
            setSourceSwitchToast(`Fonte indisponível · Reproduzindo: ${next.languageLabel}`);
          }
        }
        return;
      }

      failedAudioIdsRef.current.add(activeStream.id);
      setIsBuffering(false);
      onReadyRef.current?.();
      onStreamErrorRef.current?.(fallbackMsg);
    },
    [activeStream.id, activeStream.streamUrl, audioOptions]
  );

  const triggerFailoverRef = useRef(triggerNextBackupOptionOrError);
  useEffect(() => {
    triggerFailoverRef.current = triggerNextBackupOptionOrError;
  }, [triggerNextBackupOptionOrError]);

  const activeFailoverSnapshotRef = useRef({
    activeOptionId: activeStream.id,
    audioOptions,
  });
  activeFailoverSnapshotRef.current = {
    activeOptionId: activeStream.id,
    audioOptions,
  };

  // Load HLS, direct video, or fallback embed iframe cleanly
  useEffect(() => {
    setQualityLevels([]);
    setCurrentQuality(-1);
    setDetectedHeight(0);
    setHlsAudioTracks([]);
    candidateReadyRef.current = false;
    lastFailedUrlTriggeredRef.current = null;
    lastProgressSnapshotRef.current = { time: 0, updatedAt: Date.now() };

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (activeStream.streamKind === 'iframe') {
      setIsBuffering(true);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      return;
    }

    const video = videoRef.current;
    if (!video || !activeStream.streamUrl) return;

    setIsBuffering(true);

    const hasMore = hasNextPlayableCandidate({
      activeOptionId: activeFailoverSnapshotRef.current.activeOptionId,
      activeStreamUrl: activeStream.streamUrl,
      audioOptions: activeFailoverSnapshotRef.current.audioOptions,
      failedAudioIds: failedAudioIdsRef.current,
      failedStreamUrls: failedStreamUrlsRef.current,
    });
    const watchdogMs = hasMore ? 9500 : 16500;
    let watchdogTimer: number | null = window.setTimeout(() => {
      if (!candidateReadyRef.current) {
        triggerFailoverRef.current('Tempo limite excedido ao carregar esta fonte de vídeo.');
      }
    }, watchdogMs);

    const clearWatchdog = () => {
      if (watchdogTimer !== null) {
        window.clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const restoreIfNeeded = () => {
      if (pendingRestoreTimeRef.current !== null && Number.isFinite(pendingRestoreTimeRef.current)) {
        video.currentTime = pendingRestoreTimeRef.current;
        pendingRestoreTimeRef.current = null;
        return;
      }
      const resumePct = initialProgressPercentRef.current;
      if (
        resumeAppliedForUrlRef.current !== streamUrl &&
        resumePct &&
        resumePct > 2 &&
        resumePct < 95 &&
        Number.isFinite(video.duration) &&
        video.duration > 30
      ) {
        resumeAppliedForUrlRef.current = streamUrl;
        video.currentTime = Math.floor((video.duration * resumePct) / 100);
      }
    };

    const onLoadedMeta = () => {
      setDuration(video.duration || 0);
      if (video.videoHeight > 0) setDetectedHeight(video.videoHeight);
      restoreIfNeeded();
      onReadyRef.current?.();
    };
    const onPlayableFrame = () => {
      if (video.videoHeight > 0) setDetectedHeight(video.videoHeight);
      if (video.videoWidth > 0 || video.readyState >= 3) {
        candidateReadyRef.current = true;
        clearWatchdog();
      }
    };
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('canplay', onPlayableFrame);
    video.addEventListener('playing', onPlayableFrame);

    if (activeStream.streamKind === 'hls') {
      if (Hls.isSupported()) {
        let networkRetries = 0;
        let mediaRetries = 0;
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startFragPrefetch: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 30,
          manifestLoadingTimeOut: 8000,
          fragLoadingTimeOut: 12000,
        });
        hlsRef.current = hls;
        hls.loadSource(activeStream.streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          networkRetries = 0;
          setIsBuffering(false);
          onReadyRef.current?.();
          const levels = (data.levels || []).map((lvl, idx) => ({
            index: idx,
            label: lvl.height ? `${lvl.height}p` : `Qualidade ${idx + 1}`,
          }));
          setQualityLevels(levels);
          setCurrentQuality(hls.currentLevel);
          if (data.levels?.length === 1 && data.levels[0].height) {
            setDetectedHeight(data.levels[0].height);
          }

          if (hls.audioTracks && hls.audioTracks.length > 0) {
            setHlsAudioTracks(
              hls.audioTracks.map((tr, idx) => ({
                index: idx,
                label: tr.name || tr.lang || `Faixa ${idx + 1}`,
              }))
            );
            setCurrentHlsAudio(hls.audioTrack);
          }

          attemptAutoPlay(video);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
          const lvl = hls.levels?.[data.level];
          if (lvl?.height) setDetectedHeight(lvl.height);
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
          setHlsAudioTracks(
            (data.audioTracks || []).map((tr, idx) => ({
              index: idx,
              label: tr.name || tr.lang || `Faixa ${idx + 1}`,
            }))
          );
          setCurrentHlsAudio(hls.audioTrack);
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data?.fatal) return;
          const httpStatus = (data as { response?: { code?: number } })?.response?.code;
          const isPermanentHttpErr =
            httpStatus === 401 || httpStatus === 403 || httpStatus === 404 || httpStatus === 410;
          if (!isPermanentHttpErr && data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
            networkRetries += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
            mediaRetries += 1;
            hls.recoverMediaError();
          } else {
            clearWatchdog();
            triggerFailoverRef.current('Falha ao carregar o stream de vídeo.');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activeStream.streamUrl;
        video.load();
        attemptAutoPlay(video);
      } else {
        clearWatchdog();
        triggerFailoverRef.current('Este navegador não suporta reprodução HLS.');
      }
    } else {
      video.src = activeStream.streamUrl;
      video.load();
      attemptAutoPlay(video);
    }

    return () => {
      clearWatchdog();
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('canplay', onPlayableFrame);
      video.removeEventListener('playing', onPlayableFrame);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } else {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [activeStream.streamUrl, activeStream.streamKind, streamUrl, attemptAutoPlay]);

  // Fetch and parse active WebVTT cues cleanly whenever subtitle selection changes
  useEffect(() => {
    if (selectedSubtitleId === 'off') {
      setSubCues([]);
      return;
    }
    const track = allSubtitles.find((t) => t.id === selectedSubtitleId);
    if (!track) {
      setSubCues([]);
      return;
    }

    let cancelled = false;
    setSubLoading(true);
    fetch(track.url)
      .then((res) => (res.ok ? res.text() : ''))
      .then((vttText) => {
        if (cancelled) return;
        setSubCues(parseVttCues(vttText));
      })
      .catch(() => {
        if (!cancelled) setSubCues([]);
      })
      .finally(() => {
        if (!cancelled) setSubLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubtitleId, allSubtitles]);

  // Compute current active subtitle cue(s) with offset
  const activeSubtitleText = useMemo(() => {
    if (selectedSubtitleId === 'off' || subCues.length === 0) return '';
    const adjustedTime = currentTime - subStyle.offsetSeconds;
    const matches = subCues.filter((c) => adjustedTime >= c.start && adjustedTime <= c.end);
    return matches.map((c) => c.text).join('\n');
  }, [selectedSubtitleId, subCues, currentTime, subStyle.offsetSeconds]);

  // Fetch local Wi-Fi network info and generate QR code when Cast modal is opened
  useEffect(() => {
    if (activePopover !== 'cast') return;
    if (!networkInfo) {
      fetch('/api/system/network-info')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: NetworkInfoResponse | null) => {
          if (data && typeof data.port === 'number') setNetworkInfo(data);
        })
        .catch(() => {});
    }
    const cleanShareUrl = castPageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!cleanShareUrl) return;
    QRCode.toDataURL(cleanShareUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#050814', light: '#ffffff' },
    })
      .then(setCastQrDataUrl)
      .catch(() => setCastQrDataUrl(''));
  }, [activePopover, castPageUrl, networkInfo]);

  // Mid-playback stall watchdog: if buffering/playing hangs > 12.5s without advancing, fail over automatically
  useEffect(() => {
    if (activeStream.streamKind === 'iframe' || isEnded) return;
    const interval = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.ended || v.paused && !isBuffering) return;
      if (!candidateReadyRef.current) return;
      const elapsedSinceProgress = Date.now() - lastProgressSnapshotRef.current.updatedAt;
      if (elapsedSinceProgress > 12_500) {
        const hasMore = hasNextPlayableCandidate({
          activeOptionId: activeFailoverSnapshotRef.current.activeOptionId,
          activeStreamUrl: activeStream.streamUrl,
          audioOptions: activeFailoverSnapshotRef.current.audioOptions,
          failedAudioIds: failedAudioIdsRef.current,
          failedStreamUrls: failedStreamUrlsRef.current,
        });
        if (hasMore) {
          triggerFailoverRef.current('Stream travado · Alternando automaticamente para outra fonte...');
        }
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [activeStream.streamKind, activeStream.streamUrl, isBuffering, isEnded]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || isLocked) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    scheduleHideControls();
  }, [isLocked, scheduleHideControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video || isLocked) return;
      const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      video.currentTime = target;
      setCurrentTime(target);
      setSeekFeedback({
        label: delta > 0 ? `+${delta}s` : `${delta}s`,
        side: delta > 0 ? 'right' : 'left',
      });
      window.setTimeout(() => setSeekFeedback(null), 650);
      scheduleHideControls();
    },
    [isLocked, scheduleHideControls]
  );

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      setAutoMutedNotice(false);
      if (video.volume === 0) {
        video.volume = 0.7;
        setVolume(0.7);
      }
    }
  }, []);

  const handleVolumeChange = useCallback((nextVal: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, nextVal));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (clamped > 0) {
      setAutoMutedNotice(false);
    }
  }, []);

  const handleChangeSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
    setPlaybackRate(rate);
  }, []);

  const handleChangeQuality = useCallback((levelIndex: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = levelIndex;
    }
    setCurrentQuality(levelIndex);
  }, []);

  const handleSwitchAudioOption = useCallback(
    (optionId: string) => {
      const targetOption = audioOptions.find((o) => o.id === optionId);
      const video = videoRef.current;
      if (video && Number.isFinite(video.currentTime)) {
        pendingRestoreTimeRef.current = video.currentTime;
      }
      setActiveBackupStream(null);
      setSelectedAudioId(optionId);
      setActivePopover('none');
      if (targetOption) {
        setSourceSwitchToast(`Idioma alterado: ${targetOption.languageLabel || targetOption.label}`);
      }
    },
    [audioOptions]
  );

  useEffect(() => {
    if (!sourceSwitchToast) return;
    const t = window.setTimeout(() => setSourceSwitchToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [sourceSwitchToast]);

  const handleSwitchHlsAudioTrack = useCallback((idx: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.audioTrack = idx;
    }
    setCurrentHlsAudio(idx);
  }, []);

  const handleUploadLocalSubtitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const vtt = convertSrtToVtt(text);
        const blob = new Blob([vtt], { type: 'text/vtt' });
        const blobUrl = URL.createObjectURL(blob);
        const id = `local_${Date.now()}`;
        setLocalSubtitles((prev) => [
          { id, label: `Arquivo: ${file.name}`, lang: 'local', url: blobUrl },
          ...prev,
        ]);
        setSelectedSubtitleId(id);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    []
  );

  const handleTogglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      // ignore unsupported PiP error
    }
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (onRequestFullscreenContainer) {
      onRequestFullscreenContainer();
      return;
    }
    const target = wrapperRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }, [onRequestFullscreenContainer]);

  const handlePromptGoogleCastDirect = useCallback(async () => {
    setCastStatusMsg(null);
    const win = window as unknown as {
      cast?: {
        framework?: {
          CastContext: {
            getInstance: () => {
              getCurrentSession: () => {
                getCastDevice?: () => { friendlyName?: string };
                loadMedia: (req: unknown) => Promise<void>;
              } | null;
              requestSession: () => Promise<void>;
              endCurrentSession: (stopCasting: boolean) => void;
            };
          };
        };
      };
      chrome?: {
        cast?: {
          media?: {
            MediaInfo: new (contentId: string, contentType: string) => {
              metadata: { title?: string; subtitle?: string; images?: Array<{ url: string }> };
              streamType: number;
            };
            GenericMediaMetadata: new () => {
              title?: string;
              subtitle?: string;
              images?: Array<{ url: string }>;
            };
            StreamType: { LIVE: number; BUFFERED: number };
            LoadRequest: new (mediaInfo: unknown) => {
              autoplay: boolean;
              currentTime?: number;
            };
          };
        };
      };
    };

    const castContext = win.cast?.framework?.CastContext?.getInstance?.();
    if (castContext) {
      try {
        setCastStatusMsg('Conectando ao Google Cast...');
        let session = castContext.getCurrentSession();
        if (!session) {
          await castContext.requestSession();
          session = castContext.getCurrentSession();
        }
        if (session && win.chrome?.cast?.media) {
          const deviceName = session.getCastDevice?.()?.friendlyName || 'Google Cast';
          const isHls =
            activeStream.streamKind === 'hls' || /\.m3u8(?:$|[?#])/i.test(directStreamUrl);
          const mimeType = isHls ? 'application/x-mpegurl' : 'video/mp4';
          const { MediaInfo, GenericMediaMetadata, StreamType, LoadRequest } = win.chrome.cast.media;

          const mediaInfo = new MediaInfo(directStreamUrl, mimeType);
          mediaInfo.metadata = new GenericMediaMetadata();
          mediaInfo.metadata.title = title;
          mediaInfo.metadata.subtitle = subtitleMeta || 'MegaStream';
          if (posterUrl) {
            mediaInfo.metadata.images = [{ url: posterUrl }];
          }
          mediaInfo.streamType = isHls ? StreamType.LIVE : StreamType.BUFFERED;

          const request = new LoadRequest(mediaInfo);
          request.autoplay = true;
          const v = videoRef.current;
          if (v && Number.isFinite(v.currentTime) && v.currentTime > 0) {
            request.currentTime = v.currentTime;
          }

          await session.loadMedia(request);
          setIsCastConnected(true);
          setCastDeviceName(deviceName);
          setCastStatusMsg(`Reprodução direta iniciada na TV (${deviceName})!`);
          if (v && !v.paused) {
            v.pause();
          }
          return;
        }
      } catch (err: unknown) {
        const str = String(err || '');
        if (!str.includes('cancel')) {
          console.warn('Google Cast direct error:', err);
        }
      }
    }

    // Fallback to HTML5 Remote Playback API
    const video = videoRef.current as (HTMLVideoElement & {
      remote?: { prompt?: () => Promise<void>; state?: string };
    }) | null;
    if (video?.remote?.prompt) {
      try {
        await video.remote.prompt();
        setCastStatusMsg('Seletor Google Cast aberto no dispositivo. Escolha sua TV para reproduzir.');
        return;
      } catch {
        // user cancelled prompt
      }
    }

    setCastStatusMsg(
      'Para transmitir direto para a TV, use o Google Chrome ou Edge na mesma rede Wi-Fi do seu Chromecast / Smart TV, ou use o QR Code / URL direta abaixo.'
    );
  }, [activeStream.streamKind, directStreamUrl, posterUrl, subtitleMeta, title]);

  const handleStopGoogleCast = useCallback(() => {
    try {
      const win = window as unknown as {
        cast?: { framework?: { CastContext?: { getInstance: () => { endCurrentSession: (stop: boolean) => void } } } };
      };
      win.cast?.framework?.CastContext?.getInstance()?.endCurrentSession(true);
    } catch {
      // ignore
    }
    setIsCastConnected(false);
    setCastDeviceName('');
    setCastStatusMsg('Transmissão Google Cast encerrada.');
  }, []);

  const handlePromptAirPlay = useCallback(() => {
    const video = videoRef.current as (HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: () => void;
    }) | null;
    if (!video?.webkitShowPlaybackTargetPicker) {
      setCastStatusMsg(
        'AirPlay está disponível apenas no navegador Safari (iPhone, iPad ou Mac).'
      );
      return;
    }
    video.webkitShowPlaybackTargetPicker();
    setCastStatusMsg('Seletor AirPlay aberto.');
  }, []);

  const handleCopyCastLink = useCallback(async () => {
    const shareTarget = castPageUrl || window.location.href;
    try {
      await navigator.clipboard.writeText(shareTarget);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setCastStatusMsg(`Copie este endereço para abrir na Smart TV: ${shareTarget}`);
    }
  }, [castPageUrl]);

  const handleCopyDirectStreamUrl = useCallback(async () => {
    if (!directStreamUrl) return;
    try {
      await navigator.clipboard.writeText(directStreamUrl);
      setDirectCopied(true);
      setCastStatusMsg(
        'URL direta do vídeo copiada! Cole no TV Smarters, IPTV Smarters, VLC ou player da Smart TV.'
      );
      window.setTimeout(() => setDirectCopied(false), 2200);
    } catch {
      setCastStatusMsg('Não foi possível copiar automaticamente. Use o botão de baixar .M3U.');
    }
  }, [directStreamUrl]);

  const handleDownloadM3u = useCallback(() => {
    if (!activeStream.streamUrl) return;
    const displayTitle = subtitleMeta ? `${title} - ${subtitleMeta}` : title;
    const content = buildM3uPlaylistContent({
      title: displayTitle,
      streamUrl: activeStream.streamUrl,
      posterUrl,
      groupTitle: 'MegaStream',
      origin: effectiveCastOrigin,
    });
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeM3uFileName(displayTitle);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setCastStatusMsg(
      'Arquivo .M3U baixado! Abra no TV Smarters Pro, IPTV Smarters, TiviMate ou Android.'
    );
  }, [activeStream.streamUrl, subtitleMeta, title, posterUrl, effectiveCastOrigin]);

  // Keyboard shortcuts while player is mounted
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekBy(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange((videoRef.current?.volume ?? 1) + 0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange((videoRef.current?.volume ?? 1) - 0.1);
      } else if (e.key.toLowerCase() === 'm') {
        handleToggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        handleFullscreen();
      } else if (e.key.toLowerCase() === 'c') {
        if (allSubtitles.length > 0) {
          userToggledSubRef.current = streamUrl;
          setSelectedSubtitleId((prev) => (prev === 'off' ? allSubtitles[0].id : 'off'));
        }
      } else if (e.key === 'Escape') {
        setActivePopover('none');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    togglePlay,
    seekBy,
    handleVolumeChange,
    handleToggleMute,
    handleFullscreen,
    allSubtitles,
    streamUrl,
  ]);

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = seekBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration || isLocked) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextTime = pct * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeekBarMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = seekBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeek({ pct: pct * 100, time: pct * duration });
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  const videoAspectClass =
    aspectMode === 'cover'
      ? 'object-cover'
      : aspectMode === 'fill'
        ? 'object-fill'
        : aspectMode === 'cinema'
          ? 'object-cover scale-y-[0.82]'
          : 'object-contain';

  const subFontSizeClass =
    subStyle.size === 'sm'
      ? 'text-xs sm:text-sm'
      : subStyle.size === 'lg'
        ? 'text-lg sm:text-2xl'
        : 'text-sm sm:text-lg';

  const subColorClass =
    subStyle.color === 'yellow'
      ? 'text-amber-300'
      : subStyle.color === 'cyan'
        ? 'text-sky-300'
        : 'text-white';

  const subBgClass =
    subStyle.bg === 'box'
      ? 'bg-black/80 px-3 py-1 rounded-lg'
      : subStyle.bg === 'shadow'
        ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
        : '';

  const aspectLabels: Record<AspectMode, string> = {
    contain: 'Padrão (Ajustar)',
    cover: 'Preencher (Zoom)',
    fill: 'Esticar Tela',
    cinema: 'Cinema 21:9',
  };

  const currentQualityLabel =
    currentQuality === -1
      ? detectedHeight > 0
        ? `Auto (${detectedHeight}p)`
        : 'Auto'
      : qualityLevels.find((l) => l.index === currentQuality)?.label || 'Auto';

  const activeLangTag = getCustomSourceLangMeta(activeStream.lang).shortTag;
  const isIframeMode = activeStream.streamKind === 'iframe';

  return (
    <div
      ref={wrapperRef}
      data-testid="watcha-player"
      data-aspect={aspectMode}
      data-subtitle={selectedSubtitleId}
      data-active-source={activeStream.id}
      className={`relative w-full h-full bg-black select-none overflow-hidden group ${
        isIframeMode ? 'flex flex-col' : ''
      }`}
      onMouseMove={scheduleHideControls}
      onTouchStart={scheduleHideControls}
    >
      {isIframeMode ? (
        <iframe
          key={activeStream.streamUrl}
          src={activeStream.streamUrl}
          title={title}
          className="w-full flex-1 min-h-0 border-0 bg-black"
          sandbox={
            sandboxPolicy === 'none'
              ? undefined
              : 'allow-scripts allow-same-origin allow-forms allow-presentation'
          }
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy={referrerPolicy}
          onLoad={() => {
            setIsBuffering(false);
            onReadyRef.current?.();
          }}
          onError={() => {
            triggerNextBackupOptionOrError('Não foi possível carregar este servidor de vídeo.');
          }}
        />
      ) : (
        /* Pure Native Video Element (Zero Watermarks, Zero Ads) */
        <video
          ref={videoRef}
          poster={posterUrl || undefined}
          playsInline
          className={`w-full h-full bg-black transition-transform duration-200 ${videoAspectClass}`}
          onClick={() => {
            if (activePopover !== 'none') {
              setActivePopover('none');
              return;
            }
            togglePlay();
          }}
          onDoubleClick={() => {
            if (!isLocked) handleFullscreen();
          }}
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            setIsEnded(false);
          }}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onLoadedData={() => {
            const v = videoRef.current;
            if (v && v.videoWidth === 0 && v.readyState >= 2) {
              triggerNextBackupOptionOrError(
                'O navegador não suporta o codec de vídeo desta fonte.'
              );
            }
          }}
          onCanPlay={() => {
            const v = videoRef.current;
            if (v && v.videoWidth === 0 && v.readyState >= 2) {
              triggerNextBackupOptionOrError(
                'O navegador não suporta o codec de vídeo desta fonte.'
              );
              return;
            }
            candidateReadyRef.current = true;
            setIsBuffering(false);
            onReadyRef.current?.();
          }}
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (!v) return;
            setCurrentTime(v.currentTime);
            if (Math.abs(v.currentTime - lastProgressSnapshotRef.current.time) > 0.1) {
              lastProgressSnapshotRef.current = { time: v.currentTime, updatedAt: Date.now() };
            }
            if (v.videoHeight > 0 && v.videoHeight !== detectedHeight) {
              setDetectedHeight(v.videoHeight);
            }
            if (v.duration > 0 && v.currentTime < v.duration - 2 && isEnded) {
              setIsEnded(false);
            }
            if (v.buffered.length > 0) {
              setBufferedEnd(v.buffered.end(v.buffered.length - 1));
            }
            if (v.duration > 0 && onProgress) {
              const pct = Math.round((v.currentTime / v.duration) * 100);
              if (Math.abs(pct - lastReportedPctRef.current) >= 5) {
                lastReportedPctRef.current = pct;
                onProgress(pct);
              }
            }
          }}
          onDurationChange={() => {
            if (videoRef.current) setDuration(videoRef.current.duration || 0);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setIsEnded(true);
            onEnded?.();
          }}
          onError={() => {
            if (!videoRef.current?.getAttribute('src')) return;
            if (activeStream.streamKind === 'video' || !hlsRef.current) {
              triggerNextBackupOptionOrError('Não foi possível reproduzir este arquivo de vídeo.');
            }
          }}
        />
      )}

      {/* Language / Fallback Switch Toast Feedback */}
      {sourceSwitchToast && (
        <div
          role="status"
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-xl bg-[#070b18]/92 border border-white/15 text-xs font-semibold text-white shadow-xl whitespace-nowrap max-w-[90%] truncate ${
            autoMutedNotice && isMuted && !isIframeMode && !isLocked ? 'top-24' : 'top-14'
          }`}
        >
          {sourceSwitchToast}
        </div>
      )}

      {/* One-Click Unmute Notice when Browser Blocked Unmuted Autoplay */}
      {autoMutedNotice && isMuted && !isIframeMode && !isLocked && (
        <button
          type="button"
          onClick={handleToggleMute}
          data-testid="watcha-unmute-btn"
          className="absolute top-14 left-3 sm:left-4 z-[28] h-9 px-3.5 rounded-xl bg-[#070b18]/90 hover:bg-[#070b18] border border-white/20 text-xs font-semibold text-white flex items-center gap-2 shadow-xl cursor-pointer"
        >
          <VolumeX className="w-3.5 h-3.5" style={{ color: accentColor }} aria-hidden="true" />
          Som silenciado · Ativar som
        </button>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !isIframeMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div
            className="w-12 h-12 rounded-full border-[3px] border-white/20 animate-spin"
            style={{ borderTopColor: accentColor }}
          />
        </div>
      )}

      {/* Seek -10s / +10s Visual Feedback */}
      {seekFeedback && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-20 px-4 py-2 rounded-full bg-black/75 border border-white/15 text-white font-mono-tabular text-sm font-bold ${
            seekFeedback.side === 'left' ? 'left-8 sm:left-16' : 'right-8 sm:right-16'
          }`}
        >
          {seekFeedback.label}
        </div>
      )}

      {/* Custom Styled Subtitles Overlay */}
      {activeSubtitleText && (
        <div
          data-testid="watcha-subtitle-overlay"
          className={`pointer-events-none absolute inset-x-4 z-[15] flex justify-center text-center transition-all duration-150 ${
            controlsVisible ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-10'
          }`}
        >
          <span
            className={`max-w-[88%] whitespace-pre-line font-semibold leading-snug ${subFontSizeClass} ${subColorClass} ${subBgClass}`}
          >
            {activeSubtitleText}
          </span>
        </div>
      )}

      {/* Center Play Overlay When Paused (and not locked / popover closed) */}
      {!isIframeMode && !isPlaying && !isBuffering && !isLocked && activePopover === 'none' && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproduzir vídeo"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[15] w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white shadow-2xl border border-white/20 bg-black/65 hover:scale-105 transition-transform cursor-pointer"
        >
          <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current ml-1" style={{ color: accentColor }} />
        </button>
      )}

      {/* Locked State Minimal Unlock Trigger */}
      {isLocked && (
        <div className="absolute top-4 right-4 z-30">
          <button
            type="button"
            onClick={() => {
              setIsLocked(false);
              scheduleHideControls();
            }}
            className="h-11 px-4 rounded-xl bg-black/80 border border-white/20 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
          >
            <Unlock className="w-4 h-4" style={{ color: accentColor }} />
            Desbloquear Tela
          </button>
        </div>
      )}

      {/* Top Scrim Bar inside Player */}
      {!isLocked && !isIframeMode && (
        <div
          className={`absolute inset-x-0 top-0 z-20 px-4 py-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-3 transition-opacity duration-200 ${
            controlsVisible || !isPlaying || activePopover !== 'none'
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="min-w-0">
            <p className="font-display text-sm sm:text-base font-bold text-white truncate">
              {title}
            </p>
            {subtitleMeta && (
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">{subtitleMeta}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {allowTvCast && (
              <button
                type="button"
                onClick={() => setActivePopover((p) => (p === 'cast' ? 'none' : 'cast'))}
                className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                  isCastConnected
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                    : 'bg-black/55 hover:bg-black/80 border-white/15 text-white'
                }`}
                title={
                  isCastConnected
                    ? `Transmitindo no ${castDeviceName || 'Google Cast'}`
                    : 'Google Cast · Reprodução Direta na TV'
                }
                aria-label="Google Cast na TV"
              >
                {isCastConnected ? (
                  <span className="relative flex h-2 w-2 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                ) : (
                  <Cast className="w-4 h-4" style={{ color: accentColor }} />
                )}
                <span>
                  {isCastConnected
                    ? castDeviceName
                      ? `TV: ${castDeviceName}`
                      : 'Cast Conectado'
                    : 'Google Cast'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActivePopover('none');
                setIsLocked(true);
              }}
              className="w-10 h-10 rounded-xl bg-black/55 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center cursor-pointer"
              title="Bloquear toques na tela"
              aria-label="Bloquear tela"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Watcha-Style Control Bar */}
      {!isLocked && (
        <div
          className={
            isIframeMode
              ? 'relative z-20 px-2.5 sm:px-4 py-2 bg-[#070b18] border-t border-white/10 shrink-0'
              : `absolute inset-x-0 bottom-0 z-20 pt-8 sm:pt-10 pb-2 sm:pb-2.5 px-2 sm:px-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-200 ${
                  controlsVisible || !isPlaying || activePopover !== 'none'
                    ? 'opacity-100'
                    : 'opacity-0 pointer-events-none'
                }`
          }
        >
          {/* Scrubbable Seek Bar (Video/HLS Mode) */}
          {!isIframeMode && (
            <div
              ref={seekBarRef}
              role="slider"
              aria-label="Linha do tempo do vídeo"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              onClick={handleSeekBarClick}
              onMouseMove={handleSeekBarMove}
              onMouseLeave={() => setHoverSeek(null)}
              className="relative h-5 flex items-center cursor-pointer group/seek mb-1"
            >
              {hoverSeek && (
                <div
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/15 text-[11px] font-mono-tabular text-white"
                  style={{ left: `${hoverSeek.pct}%` }}
                >
                  {formatClock(hoverSeek.time)}
                </div>
              )}

              <div className="w-full h-1.5 group-hover/seek:h-2 transition-all rounded-full bg-white/20 overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-white/30"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
                />
              </div>

              <div
                className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md -translate-x-1/2 opacity-0 group-hover/seek:opacity-100 transition-opacity"
                style={{ left: `${progressPct}%`, border: `2px solid ${accentColor}` }}
              />
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Playback Group */}
            {isIframeMode ? (
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 truncate">
                  Idioma ativo: {activeStream.languageLabel || activeStream.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0 overflow-hidden">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                  className="w-8 h-9 sm:w-11 sm:h-11 rounded-xl hover:bg-white/10 text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  aria-label="Voltar 10 segundos"
                  title="Voltar 10s (←)"
                  className="hidden sm:flex w-10 h-11 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white items-center justify-center cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  aria-label="Avançar 10 segundos"
                  title="Avançar 10s (→)"
                  className="hidden sm:flex w-10 h-11 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white items-center justify-center cursor-pointer shrink-0"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1 group/vol">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                    className="w-8 h-9 sm:w-10 sm:h-11 rounded-xl hover:bg-white/10 text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    aria-label="Controle de volume"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="hidden md:block w-16 lg:w-20 h-1 cursor-pointer accent-white"
                  />
                </div>

                <span className="text-[10px] sm:text-xs font-mono-tabular tracking-tight sm:tracking-normal text-slate-200 px-0.5 sm:px-1.5 whitespace-nowrap truncate">
                  {formatClock(currentTime)} <span className="text-slate-500">/</span>{' '}
                  {formatClock(duration)}
                </span>
              </div>
            )}

            {/* Right Watcha Controls: Idioma, Legenda, Configurações, Cast, PiP, Teatro, Fullscreen */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActivePopover((p) => (p === 'audio' ? 'none' : 'audio'))}
                aria-label="Idioma e Áudio"
                title="Idioma Disponível"
                className={`h-9 sm:h-10 px-1.5 sm:px-2.5 rounded-xl flex items-center gap-1 sm:gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  activePopover === 'audio'
                    ? 'bg-white/20 text-white'
                    : 'hover:bg-white/10 text-slate-200'
                }`}
              >
                <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={audioOptions.length > 1 ? { color: accentColor } : undefined} />
                <span className="hidden lg:inline">Idioma</span>
                {audioOptions.length >= 1 && (
                  <span className="text-[10px] font-mono-tabular text-slate-300">
                    ({activeLangTag})
                  </span>
                )}
              </button>

              {!isIframeMode && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover((p) => (p === 'subtitles' ? 'none' : 'subtitles'))
                    }
                    aria-label="Legendas"
                    title="Legendas (C)"
                    className={`h-9 sm:h-10 px-1.5 sm:px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      activePopover === 'subtitles' || selectedSubtitleId !== 'off'
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Captions
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                      style={selectedSubtitleId !== 'off' ? { color: accentColor } : undefined}
                    />
                    <span className="hidden lg:inline">Legenda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsView('root');
                      setActivePopover((p) => (p === 'settings' ? 'none' : 'settings'));
                    }}
                    aria-label="Configurações do Player"
                    title="Configurações (Qualidade, Velocidade, Proporção)"
                    className={`h-9 sm:h-10 px-1.5 sm:px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      activePopover === 'settings'
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xl:inline">Configurações</span>
                  </button>

                  {allowTvCast && (
                    <button
                      type="button"
                      onClick={() => setActivePopover((p) => (p === 'cast' ? 'none' : 'cast'))}
                      aria-label="Google Cast e Transmissão para TV"
                      title="Google Cast (Chromecast, Google TV, Smart TV)"
                      className={`flex h-9 sm:h-10 px-2 sm:px-2.5 rounded-xl items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                        isCastConnected
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                          : activePopover === 'cast'
                          ? 'bg-white/20 text-white'
                          : 'hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <Cast className="w-4 h-4" style={{ color: isCastConnected ? '#60a5fa' : undefined }} />
                      <span className="hidden sm:inline">
                        {isCastConnected
                          ? castDeviceName
                            ? `Cast (${castDeviceName})`
                            : 'Cast Conectado'
                          : 'Google Cast'}
                      </span>
                    </button>
                  )}

                  {allowPipMode && (
                    <button
                      type="button"
                      onClick={handleTogglePip}
                      aria-label="Mini Player (Picture-in-Picture)"
                      title="Mini Player (PiP)"
                      className="hidden sm:flex w-10 h-10 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white items-center justify-center cursor-pointer"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {allowTheaterMode && onToggleTheater && (
                <button
                  type="button"
                  onClick={onToggleTheater}
                  aria-label="Modo Teatro"
                  aria-pressed={theaterMode}
                  title="Modo Teatro"
                  className={`hidden md:flex w-10 h-10 rounded-xl items-center justify-center cursor-pointer ${
                    theaterMode ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <RectangleHorizontal className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleFullscreen}
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                title="Tela Cheia (F)"
                className="w-8 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-white/10 text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Player End-of-Episode Skip to Next Button (Shown ONLY in final 45s / end of episode) */}
      {shouldShowSkipNextInPlayer({
        hasNextEpisode: Boolean(nextEpisode && onNextEpisode),
        durationSeconds: duration,
        currentTimeSeconds: currentTime,
        isEnded,
      }) &&
        !isCountdownActive &&
        !isLocked &&
        activePopover === 'none' &&
        nextEpisode &&
        onNextEpisode && (
          <div className="absolute bottom-20 right-4 sm:bottom-24 sm:right-6 z-[25] rounded-2xl bg-[#070b18]/92 backdrop-blur-xl border border-white/15 p-3 shadow-2xl flex items-center gap-3 max-w-[min(90%,340px)]">
            <div className="min-w-0">
              <p className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                {nextEpisode.isNewSeason ? 'Próxima Temporada' : 'Próximo Episódio'} · T
                {nextEpisode.seasonNumber}·E{nextEpisode.episodeNumber}
              </p>
              <p className="text-xs font-bold text-white truncate">{nextEpisode.title}</p>
            </div>
            <button
              type="button"
              data-testid="watcha-skip-next"
              onClick={onNextEpisode}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              Pular para Próximo
            </button>
          </div>
        )}

      {/* POPOVER 1: Idioma Disponível */}
      {activePopover === 'audio' && (
        <div
          role="dialog"
          aria-label="Selecionar idioma e áudio"
          className={`${
            isFullscreen
              ? 'absolute bottom-16 right-4 w-72 max-h-[75%]'
              : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto max-sm:max-h-[68vh] sm:absolute sm:bottom-16 sm:right-4 sm:w-72 sm:max-h-[75%]'
          } z-[90] overflow-y-auto rounded-2xl bg-[#070b18]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-2`}
        >
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-white/10">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Idioma Disponível
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Escolha o idioma de reprodução
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePopover('none')}
              aria-label="Fechar menu de idioma"
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
            {(audioOptions.length > 0 ? audioOptions : [activeStream]).map((opt) => {
              const selected = opt.id === activeStream.id;
              const langTitle = opt.languageLabel || opt.label;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSwitchAudioOption(opt.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-white/15 text-white border border-white/15'
                      : 'text-slate-300 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <p className="text-xs font-semibold text-white truncate min-w-0">
                    {langTitle}
                  </p>
                  {selected && <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />}
                </button>
              );
            })}

            {hlsAudioTracks.length > 1 && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <p className="text-[11px] text-slate-400 px-1">Faixas internas do vídeo</p>
                {hlsAudioTracks.map((tr) => (
                  <button
                    key={tr.index}
                    type="button"
                    onClick={() => handleSwitchHlsAudioTrack(tr.index)}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer ${
                      currentHlsAudio === tr.index
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{tr.label}</span>
                    {currentHlsAudio === tr.index && (
                      <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPOVER 2: Legendas + Personalização */}
      {activePopover === 'subtitles' && (
        <div
          role="dialog"
          aria-label="Configurações de legenda"
          className={`${
            isFullscreen
              ? 'absolute bottom-16 right-4 w-80 max-h-[78%]'
              : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto max-sm:max-h-[72vh] sm:absolute sm:bottom-16 sm:right-4 sm:w-80 sm:max-h-[78%]'
          } z-[90] overflow-y-auto rounded-2xl bg-[#070b18]/95 backdrop-blur-xl border border-white/15 p-3.5 shadow-2xl space-y-3`}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Captions className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Legendas ({allSubtitles.length}) {subLoading ? '(carregando...)' : ''}
            </span>
            <button
              type="button"
              onClick={() => setActivePopover('none')}
              aria-label="Fechar legendas"
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => {
                userToggledSubRef.current = streamUrl;
                setSelectedSubtitleId('off');
              }}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                selectedSubtitleId === 'off'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>Desativada</span>
              {selectedSubtitleId === 'off' && (
                <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
              )}
            </button>

            {allSubtitles.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  userToggledSubRef.current = streamUrl;
                  setSelectedSubtitleId(sub.id);
                }}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  selectedSubtitleId === sub.id
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="truncate">{sub.label}</span>
                {selectedSubtitleId === sub.id && (
                  <Check className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                )}
              </button>
            ))}

            {allSubtitles.length === 0 && (
              <p className="text-[11px] text-slate-400 px-2 py-1">
                Nenhuma legenda automática encontrada para este título. Você pode carregar um arquivo .SRT ou .VTT abaixo.
              </p>
            )}
          </div>

          {/* Upload custom SRT/VTT */}
          <label className="w-full h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-3.5 h-3.5" style={{ color: accentColor }} />
            Carregar arquivo (.SRT / .VTT)
            <input
              type="file"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              onChange={handleUploadLocalSubtitle}
              className="hidden"
            />
          </label>

          {/* Subtitle Styling & Sync */}
          <div className="pt-2 border-t border-white/10 space-y-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Tamanho</span>
              <div className="flex gap-1">
                {(['sm', 'md', 'lg'] as SubtitleSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateSubStyle((s) => ({ ...s, size: sz }))}
                    className={`px-2 py-1 rounded-lg font-semibold cursor-pointer ${
                      subStyle.size === sz
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz === 'sm' ? 'P' : sz === 'md' ? 'M' : 'G'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">Cor</span>
              <div className="flex gap-1">
                {(
                  [
                    { id: 'white', label: 'Branco' },
                    { id: 'yellow', label: 'Amarelo' },
                    { id: 'cyan', label: 'Azul' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateSubStyle((s) => ({ ...s, color: c.id }))}
                    className={`px-2 py-1 rounded-lg font-semibold cursor-pointer ${
                      subStyle.color === c.id
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">Fundo</span>
              <div className="flex gap-1">
                {(
                  [
                    { id: 'box', label: 'Caixa' },
                    { id: 'shadow', label: 'Sombra' },
                    { id: 'none', label: 'Limpo' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => updateSubStyle((s) => ({ ...s, bg: b.id }))}
                    className={`px-2 py-1 rounded-lg font-semibold cursor-pointer ${
                      subStyle.bg === b.id
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300">Sincronização</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateSubStyle((s) => ({
                      ...s,
                      offsetSeconds: Math.max(-10, Number((s.offsetSeconds - 0.5).toFixed(1))),
                    }))
                  }
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tabular cursor-pointer"
                >
                  -0.5s
                </button>
                <span className="font-mono-tabular text-white w-11 text-center">
                  {subStyle.offsetSeconds > 0
                    ? `+${subStyle.offsetSeconds}s`
                    : `${subStyle.offsetSeconds}s`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateSubStyle((s) => ({
                      ...s,
                      offsetSeconds: Math.min(10, Number((s.offsetSeconds + 0.5).toFixed(1))),
                    }))
                  }
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tabular cursor-pointer"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPOVER 3: Watcha-Style Configurações (Qualidade, Velocidade, Proporção, Auto-próximo) */}
      {activePopover === 'settings' && (
        <div
          role="dialog"
          aria-label="Configurações avançadas do player"
          className={`${
            isFullscreen
              ? 'absolute bottom-16 right-4 w-72 max-h-[75%]'
              : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto max-sm:max-h-[68vh] sm:absolute sm:bottom-16 sm:right-4 sm:w-72 sm:max-h-[75%]'
          } z-[90] overflow-y-auto rounded-2xl bg-[#070b18]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-1.5`}
        >
          {settingsView === 'root' && (
            <>
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  Configurações do Player
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopover('none')}
                  aria-label="Fechar configurações"
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSettingsView('quality')}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center justify-between text-white cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Tv className="w-3.5 h-3.5 text-slate-300" />
                  Qualidade
                </span>
                <span className="text-slate-300 flex items-center gap-1 font-mono-tabular">
                  {currentQualityLabel}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsView('speed')}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center justify-between text-white cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Gauge className="w-3.5 h-3.5 text-slate-300" />
                  Velocidade
                </span>
                <span className="text-slate-300 flex items-center gap-1 font-mono-tabular">
                  {playbackRate === 1 ? 'Normal' : `${playbackRate}x`}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsView('aspect')}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center justify-between text-white cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <RectangleHorizontal className="w-3.5 h-3.5 text-slate-300" />
                  Proporção
                </span>
                <span className="text-slate-300 flex items-center gap-1">
                  {aspectLabels[aspectMode]}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {onToggleAutoNext && (
                <button
                  type="button"
                  onClick={onToggleAutoNext}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center justify-between text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <FastForward className="w-3.5 h-3.5 text-slate-300" />
                    Auto-próximo episódio
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: autoNextEnabled ? accentColor : '#94a3b8' }}
                  >
                    {autoNextEnabled ? 'Ativo' : 'Desativado'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActivePopover('cast')}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center justify-between text-white cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Cast className="w-3.5 h-3.5 text-slate-300" />
                  Transmitir para TV & Apps
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </>
          )}

          {settingsView === 'quality' && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSettingsView('root')}
                className="w-full px-2 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Qualidade de Vídeo
              </button>
              <button
                type="button"
                onClick={() => {
                  handleChangeQuality(-1);
                  setSettingsView('root');
                }}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  currentQuality === -1 ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>
                  {detectedHeight > 0
                    ? `Automática (${detectedHeight}p · Recomendada)`
                    : 'Automática (Recomendada)'}
                </span>
                {currentQuality === -1 && (
                  <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                )}
              </button>
              {qualityLevels.map((lvl) => (
                <button
                  key={lvl.index}
                  type="button"
                  onClick={() => {
                    handleChangeQuality(lvl.index);
                    setSettingsView('root');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    currentQuality === lvl.index
                      ? 'bg-white/15 text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{lvl.label}</span>
                  {currentQuality === lvl.index && (
                    <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  )}
                </button>
              ))}

              {qualityLevels.length <= 1 &&
                activeStream.backupStreams &&
                activeStream.backupStreams.length > 0 && (
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <p className="text-[11px] text-slate-400 px-1">
                      Opções de transmissão ({activeStream.languageLabel || activeStream.label})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current && Number.isFinite(videoRef.current.currentTime)) {
                          pendingRestoreTimeRef.current = videoRef.current.currentTime;
                        }
                        setActiveBackupStream(null);
                        setSettingsView('root');
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                        !activeBackupStream
                          ? 'bg-white/15 text-white'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>Qualidade Principal (#1)</span>
                      {!activeBackupStream && (
                        <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      )}
                    </button>
                    {activeStream.backupStreams.map((b, bIdx) => {
                      const selectedBackup = activeBackupStream?.streamUrl === b.streamUrl;
                      return (
                        <button
                          key={b.streamUrl}
                          type="button"
                          onClick={() => {
                            if (videoRef.current && Number.isFinite(videoRef.current.currentTime)) {
                              pendingRestoreTimeRef.current = videoRef.current.currentTime;
                            }
                            setActiveBackupStream(b);
                            setSettingsView('root');
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                            selectedBackup
                              ? 'bg-white/15 text-white'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span>Alternativa (#{bIdx + 2})</span>
                          {selectedBackup && (
                            <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {settingsView === 'speed' && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSettingsView('root')}
                className="w-full px-2 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Velocidade de Reprodução
              </button>
              {PLAYBACK_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    handleChangeSpeed(spd);
                    setSettingsView('root');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    playbackRate === spd
                      ? 'bg-white/15 text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{spd === 1 ? 'Normal (1x)' : `${spd}x`}</span>
                  {playbackRate === spd && (
                    <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {settingsView === 'aspect' && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSettingsView('root')}
                className="w-full px-2 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Proporção da Tela
              </button>
              {(Object.keys(aspectLabels) as AspectMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    hasUserChangedAspectRef.current = true;
                    setAspectMode(mode);
                    setSettingsView('root');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    aspectMode === mode
                      ? 'bg-white/15 text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{aspectLabels[mode]}</span>
                  {aspectMode === mode && (
                    <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POPOVER 4: Espelhar na TV & Apps Externos (Chromecast, AirPlay, TV Smarters .M3U, Android, VLC, QR Code) */}
      {activePopover === 'cast' && (
        <div
          role="dialog"
          aria-label="Espelhar na TV"
          className={`${
            isFullscreen ? 'absolute' : 'fixed'
          } inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto`}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#090e1f] border border-white/15 p-4 sm:p-5 shadow-2xl space-y-3.5 my-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cast className="w-5 h-5 text-blue-400" />
                <h3 className="font-display text-base font-bold text-white">
                  Transmitir para TV & Google Cast
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCastStatusMsg(null);
                  setActivePopover('none');
                }}
                aria-label="Fechar espelhar na TV"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Google Cast Direct Action */}
            {isCastConnected ? (
              <div className="p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Transmitindo via Google Cast</p>
                    <p className="text-[11px] text-blue-300 truncate">{castDeviceName || 'Dispositivo Google Cast'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStopGoogleCast}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-xs font-semibold text-red-300 cursor-pointer shrink-0 transition-colors"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePromptGoogleCastDirect}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/40 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 cursor-pointer transition-all transform active:scale-[0.99]"
              >
                <Cast className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-blue-200" />
                <span>Google Cast · Reprodução Direta na TV</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

              <button
                type="button"
                onClick={handlePromptAirPlay}
                className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Tv className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                Apple AirPlay
              </button>

              <button
                type="button"
                onClick={handleDownloadM3u}
                className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                TV Smarters / IPTV (.M3U)
              </button>

              <button
                type="button"
                onClick={handleCopyDirectStreamUrl}
                className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                {directCopied ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                )}
                {directCopied ? 'URL Direta Copiada!' : 'Copiar URL Direta (IPTV)'}
              </button>

              {androidIntentUrl && (
                <a
                  href={androidIntentUrl}
                  className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                  Abrir no Android (VLC / MX)
                </a>
              )}

              {vlcStreamUrl && (
                <a
                  href={vlcStreamUrl}
                  className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                  Abrir no VLC Player
                </a>
              )}
            </div>

            {castStatusMsg && (
              <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/25 rounded-xl px-3 py-2">
                {castStatusMsg}
              </p>
            )}

            <div className="rounded-xl bg-black/40 border border-white/10 p-3 flex flex-col sm:flex-row items-center gap-3.5">
              {castQrDataUrl && (
                <img
                  src={castQrDataUrl}
                  alt="QR Code para abrir na Smart TV"
                  className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0"
                />
              )}
              <div className="space-y-1.5 min-w-0 text-center sm:text-left flex-1">
                <p className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                  Mesma Rede Wi-Fi · Smart TV & TV Smarters
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Conecte sua Smart TV ou celular no mesmo Wi-Fi, aponte a câmera para o QR Code ou abra o endereço abaixo no navegador da TV.
                </p>
                {networkInfo?.preferredLanOrigin ? (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[11px] font-mono-tabular text-sky-300">
                      {effectiveCastOrigin}
                    </span>
                    {hasLocalhostOrigin && (
                      <button
                        type="button"
                        onClick={() => setUseLanOrigin((v) => !v)}
                        className="text-[11px] font-semibold text-slate-300 hover:text-white underline cursor-pointer"
                      >
                        {useLanOrigin ? 'Usar URL atual' : 'Usar IP do Wi-Fi'}
                      </button>
                    )}
                  </div>
                ) : hasLocalhostOrigin ? (
                  <p className="text-[11px] text-amber-200/90">
                    Para espelhar em outro aparelho no Wi-Fi, acesse pelo IP local do servidor (ex: http://192.168.x.x:3000).
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyCastLink}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {linkCopied ? 'Link Copiado!' : 'Copiar Link da TV (Wi-Fi)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
