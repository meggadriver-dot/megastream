import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Captions,
  Cast,
  Check,
  Edit3,
  Eye,
  FastForward,
  Globe,
  Languages,
  Maximize2,
  PictureInPicture2,
  Play,
  Plus,
  RectangleHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  CUSTOM_SOURCE_LANG_OPTIONS,
  DEFAULT_MYEMBED_BASE_URL,
  DEFAULT_WATCHAFLIX_BASE_URL,
  RECOMMENDED_CUSTOM_SOURCES,
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildMyEmbedUrl,
  buildWatchaFlixEmbedUrl,
  getCustomSourceLangMeta,
  hasUrlTemplatePlaceholder,
  mergeRecommendedCustomSources,
  normalizeMyEmbedBaseUrl,
  normalizeWatchaFlixBaseUrl,
  sanitizeCustomVideoSources,
} from '../../../shared/playerUrl';
import type {
  CustomSourceTestResult,
  CustomVideoSource,
  CustomVideoSourceKind,
  CustomVideoSourceLang,
  DiagnosticResult,
  DiscoveredM3uEntry,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerAspectMode,
  PlayerConfig,
  PlayerSourceMode,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  SourceDiscoveryResponse,
  WatchaFlixLang,
  WatermarkPosition,
  WatermarkSize,
} from '../../../shared/types';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { apiRequest } from '../../services/apiClient';

interface AdminPlayerTabProps {
  playerConfig: PlayerConfig;
  onChange: (next: PlayerConfig) => void;
  saving: boolean;
  testingPlayer: boolean;
  playerDiagnostic: DiagnosticResult | null;
  onSave: (e: React.FormEvent) => void;
  onTestPlayer: () => void;
}

const POSITION_CLASSES: Record<WatermarkPosition, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-10 left-3',
  'bottom-right': 'bottom-10 right-3',
};

const PREVIEW_SUB_SIZE_CLASS: Record<PlayerSubtitleSize, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

const PREVIEW_SUB_COLOR_CLASS: Record<PlayerSubtitleColor, string> = {
  white: 'text-white',
  yellow: 'text-amber-300',
  cyan: 'text-sky-300',
};

const PREVIEW_SUB_BG_CLASS: Record<PlayerSubtitleBg, string> = {
  box: 'bg-black/80 px-2.5 py-0.5 rounded-md',
  shadow: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]',
  none: '',
};

const ASPECT_LABELS: Record<PlayerAspectMode, string> = {
  contain: 'Padrão (16:9 Ajustar)',
  cover: 'Preencher (Zoom)',
  fill: 'Esticar Tela',
  cinema: 'Cinema 21:9',
};

export function AdminPlayerTab({
  playerConfig,
  onChange,
  saving,
  testingPlayer,
  playerDiagnostic,
  onSave,
  onTestPlayer,
}: AdminPlayerTabProps) {
  const { siteConfig } = useSiteConfig();

  const customSources = sanitizeCustomVideoSources(playerConfig.customSources);

  // CRUD state for Unlimited Custom Video Sources / Embeds / APIs
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [srcName, setSrcName] = useState('');
  const [srcKind, setSrcKind] = useState<CustomVideoSourceKind>('api');
  const [srcLang, setSrcLang] = useState<CustomVideoSourceLang>('auto');
  const [srcMovieTemplate, setSrcMovieTemplate] = useState('');
  const [srcTvTemplate, setSrcTvTemplate] = useState('');
  const [srcActive, setSrcActive] = useState(true);
  const [srcFormError, setSrcFormError] = useState<string | null>(null);
  const [focusedTemplateField, setFocusedTemplateField] = useState<'movie' | 'tv'>('movie');
  const [testingSources, setTestingSources] = useState(false);
  const [discoveringSources, setDiscoveringSources] = useState(false);
  const [discoveryM3uUrl, setDiscoveryM3uUrl] = useState('');
  const [discoveryExtraUrls, setDiscoveryExtraUrls] = useState('');
  const [discoverySummary, setDiscoverySummary] = useState<SourceDiscoveryResponse['summary'] | null>(null);
  const [discoveredM3uEntries, setDiscoveredM3uEntries] = useState<DiscoveredM3uEntry[]>([]);
  const [sourceTestResults, setSourceTestResults] = useState<Record<string, CustomSourceTestResult>>({});
  const [sourceTestError, setSourceTestError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const handleImportRecommendedSources = () => {
    const merged = mergeRecommendedCustomSources(customSources);
    onChange({
      ...playerConfig,
      customSources: merged.sources,
    });
    const parts: string[] = [];
    if (merged.addedCount > 0) {
      parts.push(`${merged.addedCount} fonte(s) PT-BR + Inglês adicionadas`);
    } else {
      parts.push('Todas as 8 fontes recomendadas PT-BR + Inglês já estão ativas na lista');
    }
    if (merged.pausedBrokenCount > 0) {
      parts.push(`${merged.pausedBrokenCount} fonte(s) bloqueadas/fixas pausadas automaticamente`);
    }
    setImportNotice(
      `${parts.join(' · ')}. Clique em "Aplicar Fontes no Site" abaixo para publicar.`
    );
  };

  const handleTestAllCustomSources = async () => {
    if (customSources.length === 0) return;
    setTestingSources(true);
    setSourceTestError(null);
    try {
      const res = await apiRequest<{ results: CustomSourceTestResult[] }>(
        '/api/admin/player-sources/test',
        {
          method: 'POST',
          body: JSON.stringify({ customSources }),
        }
      );
      const nextMap: Record<string, CustomSourceTestResult> = {};
      for (const item of res.results || []) {
        nextMap[item.id] = item;
      }
      setSourceTestResults(nextMap);
    } catch (err) {
      setSourceTestError(err instanceof Error ? err.message : 'Erro ao testar fontes.');
    } finally {
      setTestingSources(false);
    }
  };

  const handleDiscoverAndUpdateSources = async () => {
    setDiscoveringSources(true);
    setSourceTestError(null);
    setImportNotice(null);
    try {
      const extraUrls = discoveryExtraUrls
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^https?:\/\//i.test(line));
      const res = await apiRequest<SourceDiscoveryResponse>(
        '/api/admin/player-sources/discover',
        {
          method: 'POST',
          body: JSON.stringify({
            customSources,
            extraUrls,
            m3uUrl: discoveryM3uUrl.trim() || undefined,
          }),
        }
      );
      onChange({
        ...playerConfig,
        customSources: res.sources,
      });
      const nextMap: Record<string, CustomSourceTestResult> = {};
      for (const item of res.testResults || []) {
        nextMap[item.id] = item;
      }
      setSourceTestResults(nextMap);
      setDiscoverySummary(res.summary);
      setDiscoveredM3uEntries(res.discoveredM3uEntries || []);
      setImportNotice(
        `Busca concluída em ${(res.summary.elapsedMs / 1000).toFixed(1)}s: ${res.summary.activeCount} fonte(s) ativas e verificadas, ${res.summary.addedCount} adicionada(s), ${res.summary.pausedBrokenCount} bloqueadas/offline pausadas automaticamente. Clique em "Aplicar Fontes no Site" para publicar.`
      );
    } catch (err) {
      setSourceTestError(
        err instanceof Error ? err.message : 'Erro ao buscar e verificar novas fontes.'
      );
    } finally {
      setDiscoveringSources(false);
    }
  };

  const resetSourceForm = () => {
    setEditingSourceId(null);
    setSrcName('');
    setSrcKind('api');
    setSrcLang('auto');
    setSrcMovieTemplate('');
    setSrcTvTemplate('');
    setSrcActive(true);
    setSrcFormError(null);
  };

  const handleEditSource = (src: CustomVideoSource) => {
    setEditingSourceId(src.id);
    setSrcName(src.name);
    setSrcKind(src.kind);
    setSrcLang(src.lang);
    setSrcMovieTemplate(src.movieTemplate);
    setSrcTvTemplate(src.tvTemplate);
    setSrcActive(src.active);
    setSrcFormError(null);
  };

  const handleUpsertCustomSource = () => {
    const cleanName = srcName.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    const movieTpl = srcMovieTemplate.trim();
    const tvTpl = srcTvTemplate.trim();

    if (!cleanName) {
      setSrcFormError('Informe um nome para identificar esta fonte ou API.');
      return;
    }
    if (!movieTpl && !tvTpl) {
      setSrcFormError('Informe ao menos uma URL/template para Filmes ou Séries.');
      return;
    }
    if ((movieTpl && !/^https?:\/\//i.test(movieTpl)) || (tvTpl && !/^https?:\/\//i.test(tvTpl))) {
      setSrcFormError('As URLs das fontes devem começar com https:// ou http://.');
      return;
    }

    const nextId =
      editingSourceId ||
      `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const nextSource: CustomVideoSource = {
      id: nextId,
      name: cleanName.slice(0, 60),
      kind: srcKind,
      lang: srcLang,
      movieTemplate: movieTpl.slice(0, 500),
      tvTemplate: tvTpl.slice(0, 500),
      priority: editingSourceId
        ? customSources.find((s) => s.id === editingSourceId)?.priority ?? customSources.length + 1
        : customSources.length + 1,
      active: srcActive,
    };

    const nextRaw = editingSourceId
      ? customSources.map((s) => (s.id === editingSourceId ? nextSource : s))
      : [...customSources, nextSource];

    const reindexed = sanitizeCustomVideoSources(
      nextRaw.map((item, idx) => ({ ...item, priority: idx + 1 }))
    );

    onChange({
      ...playerConfig,
      customSources: reindexed,
    });
    resetSourceForm();
  };

  const handleToggleCustomSource = (id: string) => {
    const updated = customSources.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    onChange({
      ...playerConfig,
      customSources: sanitizeCustomVideoSources(updated),
    });
  };

  const handleUpdateCustomSourceLang = (id: string, lang: CustomVideoSourceLang) => {
    const updated = customSources.map((s) => (s.id === id ? { ...s, lang } : s));
    onChange({
      ...playerConfig,
      customSources: sanitizeCustomVideoSources(updated),
    });
  };

  const handleDeleteCustomSource = (id: string) => {
    const filtered = customSources
      .filter((s) => s.id !== id)
      .map((item, idx) => ({ ...item, priority: idx + 1 }));
    onChange({
      ...playerConfig,
      customSources: sanitizeCustomVideoSources(filtered),
    });
    if (editingSourceId === id) {
      resetSourceForm();
    }
  };

  const handleMoveCustomSource = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= customSources.length) return;
    const copy = [...customSources];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    const reindexed = copy.map((item, idx) => ({ ...item, priority: idx + 1 }));
    onChange({
      ...playerConfig,
      customSources: sanitizeCustomVideoSources(reindexed),
    });
  };

  const insertPlaceholderToken = (token: string) => {
    if (focusedTemplateField === 'tv') {
      setSrcTvTemplate((prev) => `${prev}${token}`);
    } else {
      setSrcMovieTemplate((prev) => `${prev}${token}`);
    }
  };

  const applyCustomSourcePreset = (
    preset:
      | 'vidlink'
      | 'cinejoy'
      | 'playerflix'
      | 'watchplay'
      | 'novelascdn'
      | 'fshd'
      | 'vidup'
      | 'freeapi_anime'
      | 'freeapi_movies'
      | 'streambetter'
  ) => {
    setSrcFormError(null);
    const idMap: Record<typeof preset, string> = {
      vidlink: 'rec_vidlink_en',
      cinejoy: 'rec_cinejoy_en',
      playerflix: 'rec_playerflix_pt',
      watchplay: 'rec_watchplay1_pt',
      novelascdn: 'rec_novelascdn_pt',
      fshd: 'rec_fshd_pt',
      vidup: 'rec_vidup_en',
      freeapi_anime: 'rec_freeapi_anime',
      freeapi_movies: 'rec_freeapi_movies',
      streambetter: 'rec_streambetter_json',
    };
    const found = RECOMMENDED_CUSTOM_SOURCES.find((item) => item.id === idMap[preset]);
    if (!found) return;
    setSrcName(found.name);
    setSrcKind(found.kind);
    setSrcLang(found.lang);
    setSrcMovieTemplate(found.movieTemplate);
    setSrcTvTemplate(found.tvTemplate);
  };

  const moviePreview =
    playerConfig.sourceMode === 'megastream_watcha'
      ? '/watch/movie/693134 -> HLS Proxy Nativo + Legendas + WatchaPlayer (fallback automático se necessário)'
      : playerConfig.sourceMode === 'myembed'
        ? buildMyEmbedUrl({
            tmdbId: 693134,
            imdbId: playerConfig.preferImdbForMovies ? 'tt15239678' : null,
            preferImdbForMovies: playerConfig.preferImdbForMovies,
            mediaType: 'movie',
            baseUrl: playerConfig.myembedBaseUrl,
          })
        : playerConfig.sourceMode === 'watchaflix'
          ? buildWatchaFlixEmbedUrl({
              tmdbId: 693134,
              mediaType: 'movie',
              baseUrl: playerConfig.watchaflixBaseUrl,
              colorHex: playerConfig.defaultColorHex,
              lang: playerConfig.watchaflixLang,
            })
          : playerConfig.sourceMode === 'custom_template' && playerConfig.customEmbedMovieTemplate
            ? buildCustomEmbedUrl({
                template: playerConfig.customEmbedMovieTemplate,
                tmdbId: 693134,
                imdbId: 'tt15239678',
                mediaType: 'movie',
                player: playerConfig.defaultPlayer,
                colorHex: playerConfig.defaultColorHex,
              }) || 'Template inválido (use https://...)'
            : buildMegaEmbedUrl({
                tmdbId: 693134,
                domain: playerConfig.defaultDomain,
                player: playerConfig.defaultPlayer,
                colorHex: playerConfig.defaultColorHex,
                mediaType: 'movie',
              });

  const tvPreview =
    playerConfig.sourceMode === 'megastream_watcha'
      ? '/watch/tv/1399?season=1&episode=2 -> HLS Proxy Nativo + Legendas + WatchaPlayer (fallback automático se necessário)'
      : playerConfig.sourceMode === 'myembed'
        ? buildMyEmbedUrl({
            tmdbId: 1399,
            mediaType: 'tv',
            seasonNumber: 1,
            episodeNumber: 2,
            baseUrl: playerConfig.myembedBaseUrl,
          })
        : playerConfig.sourceMode === 'watchaflix'
          ? buildWatchaFlixEmbedUrl({
              tmdbId: 1399,
              mediaType: 'tv',
              seasonNumber: 1,
              episodeNumber: 2,
              baseUrl: playerConfig.watchaflixBaseUrl,
              colorHex: playerConfig.defaultColorHex,
              lang: playerConfig.watchaflixLang,
            })
          : playerConfig.sourceMode === 'custom_template' && playerConfig.customEmbedTvTemplate
            ? buildCustomEmbedUrl({
                template: playerConfig.customEmbedTvTemplate,
                tmdbId: 1399,
                mediaType: 'tv',
                seasonNumber: 1,
                episodeNumber: 2,
                player: playerConfig.defaultPlayer,
                colorHex: playerConfig.defaultColorHex,
              }) || 'Template inválido (use https://...)'
            : buildMegaEmbedUrl({
                tmdbId: 1399,
                domain: playerConfig.defaultDomain,
                player: playerConfig.defaultPlayer,
                colorHex: playerConfig.defaultColorHex,
                mediaType: 'tv',
                seasonNumber: 1,
                episodeNumber: 2,
              });

  const isDocsDomainEntered = /watchaflixapi\.watcha\.one/i.test(
    playerConfig.watchaflixBaseUrl || ''
  );

  const isMyEmbedDocsEntered = /embedmovies\.org/i.test(playerConfig.myembedBaseUrl || '');

  const applyWatchaFlixPresetToTemplates = () => {
    const base = normalizeWatchaFlixBaseUrl(playerConfig.watchaflixBaseUrl);
    const lang = playerConfig.watchaflixLang || 'pt';
    onChange({
      ...playerConfig,
      customEmbedMovieTemplate: `${base}/embed/movie/{tmdbId}?color={color}&lang=${lang}`,
      customEmbedTvTemplate: `${base}/embed/tv/{tmdbId}/{season}/{episode}?color={color}&lang=${lang}`,
    });
  };

  const applyEmbedMoviesPresetToTemplates = () => {
    const base = normalizeMyEmbedBaseUrl(playerConfig.myembedBaseUrl);
    onChange({
      ...playerConfig,
      customEmbedMovieTemplate: `${base}/filme/${playerConfig.preferImdbForMovies ? '{imdbId}' : '{tmdbId}'}`,
      customEmbedTvTemplate: `${base}/serie/{tmdbId}/{season}/{episode}`,
    });
  };

  const previewAccent = `#${(playerConfig.defaultColorHex || '00a8ff').replace('#', '').slice(0, 6)}`;
  const previewWatermarkText =
    playerConfig.watermarkText.trim() || siteConfig.siteName || 'MegaStream';
  const previewWatermarkLogo = playerConfig.watermarkLogoUrl.trim() || siteConfig.logoUrl || '';
  const isWatchaPrincipal = playerConfig.sourceMode === 'megastream_watcha';

  return (
    <form onSubmit={onSave} className="space-y-6 max-w-5xl">
      {/* 1. Player Principal MegaStream & Fontes Secundárias */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Player Principal do MegaStream & Fontes de Vídeo
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Todas as fontes configuradas e novas URLs são reproduzidas diretamente no Player Principal MegaStream (sem anúncios e sem verificação Cloudflare), com troca automática para a próxima fonte disponível caso alguma falhe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onTestPlayer}
              disabled={testingPlayer}
              className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              {testingPlayer ? 'Testando...' : 'Testar Resolução'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
              style={{ backgroundColor: previewAccent }}
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Highlighted Principal Player Option */}
        <label
          className={`block rounded-2xl p-4 sm:p-5 border cursor-pointer transition-colors ${
            isWatchaPrincipal
              ? 'bg-sky-500/12 border-sky-400/60 shadow-lg'
              : 'bg-black/35 border-white/15 hover:border-white/30'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <input
              type="radio"
              name="playerSourceMode"
              value="megastream_watcha"
              checked={isWatchaPrincipal}
              onChange={() => onChange({ ...playerConfig, sourceMode: 'megastream_watcha' })}
              className="mt-1 accent-sky-400 shrink-0 w-4 h-4"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" style={{ color: previewAccent }} />
                  Player Principal MegaStream (Estilo Watcha Próprio)
                </p>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md text-white"
                  style={{ backgroundColor: previewAccent }}
                >
                  <Zap className="w-3 h-3" />
                  Principal Global
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ativa o player próprio estilo Watcha em todos os filmes e séries: zero anúncios, zero marca d'água ou logo de terceiros, seleção de idioma/áudio, legendas configuráveis, espelhar na TV (Chromecast, AirPlay e QR Code), velocidade, proporção e próximo episódio automático.
              </p>
            </div>
          </div>
        </label>

        {/* Secondary / Fallback Engines */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Fontes Alternativas ou Personalizadas
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              [
                {
                  id: 'myembed',
                  title: 'MyEmbed / EmbedMovies → WatchaPlayer',
                  desc: 'Prioriza sua base MyEmbed e extrai direto para o WatchaPlayer, com failover automático para as demais fontes limpas.',
                },
                {
                  id: 'watchaflix',
                  title: 'WatchaFlix API → WatchaPlayer',
                  desc: 'Prioriza o endpoint WatchaFlix configurado, extraindo direto para o WatchaPlayer com failover automático sem Cloudflare.',
                },
                {
                  id: 'megaembed',
                  title: 'MegaEmbed → WatchaPlayer',
                  desc: 'Prioriza domínios MegaEmbed configurados com extração direta e fallback automático no WatchaPlayer.',
                },
                {
                  id: 'custom_template',
                  title: 'Template Customizado / Nova API → WatchaPlayer',
                  desc: 'Qualquer nova API, embed ou stream direto (.m3u8/.mp4) com {tmdbId}, {imdbId}, {season}, {episode} tocado no WatchaPlayer com failover automático.',
                },
              ] as Array<{ id: PlayerSourceMode; title: string; desc: string }>
            ).map((mode) => {
              const selected = playerConfig.sourceMode === mode.id;
              return (
                <label
                  key={mode.id}
                  className={`rounded-xl p-4 border cursor-pointer transition-colors flex items-start gap-3 ${
                    selected
                      ? 'bg-sky-500/10 border-sky-400/50'
                      : 'bg-black/30 border-white/10 hover:border-white/25'
                  }`}
                >
                  <input
                    type="radio"
                    name="playerSourceMode"
                    value={mode.id}
                    checked={selected}
                    onChange={() => onChange({ ...playerConfig, sourceMode: mode.id })}
                    className="mt-1 accent-sky-400 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{mode.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{mode.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Anti-Ad & Anti-Popup Sandbox Shield */}
        <label className="rounded-xl bg-emerald-500/5 border border-emerald-400/25 p-4 flex items-center justify-between gap-4 cursor-pointer">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">
                Proteção Anti-Anúncios, Anti-Popups & Fallback Limpo
              </p>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                O player próprio já reproduz vídeo direto sem anúncios. Quando algum título raro precisar de iframe de reserva, esta blindagem bloqueia novas abas, pop-ups e redirecionamentos.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={playerConfig.antiAdSandbox}
            onChange={(e) => onChange({ ...playerConfig, antiAdSandbox: e.target.checked })}
            className="w-5 h-5 accent-emerald-400 shrink-0"
          />
        </label>

        {/* Sub-config for MyEmbed / Principal Fallback Base */}
        {(playerConfig.sourceMode === 'myembed' || playerConfig.sourceMode === 'megastream_watcha') && (
          <div className="rounded-xl bg-sky-500/5 border border-sky-400/20 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Configuração de Fallback Automático (Filmes e Séries)
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Caso um título específico ainda não tenha fluxo HLS direto, o servidor usa o endpoint reserva abaixo de forma transparente.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...playerConfig,
                    myembedBaseUrl: DEFAULT_MYEMBED_BASE_URL,
                  })
                }
                className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                Usar Padrão Oficial
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label htmlFor="adm-myembed-base" className="block text-xs text-slate-300 mb-1">
                  Endpoint Reserva
                </label>
                <input
                  id="adm-myembed-base"
                  type="url"
                  value={playerConfig.myembedBaseUrl}
                  onChange={(e) =>
                    onChange({ ...playerConfig, myembedBaseUrl: e.target.value })
                  }
                  onBlur={(e) =>
                    onChange({
                      ...playerConfig,
                      myembedBaseUrl: normalizeMyEmbedBaseUrl(e.target.value),
                    })
                  }
                  placeholder="https://myembed.biz"
                  className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                />
                {isMyEmbedDocsEntered && (
                  <p className="text-[11px] text-amber-300 mt-1">
                    Aviso: convertido automaticamente para o endpoint de embed direto ({DEFAULT_MYEMBED_BASE_URL}).
                  </p>
                )}
              </div>

              <label className="h-10 px-3.5 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-slate-200">
                  Priorizar IMDb em Filmes
                </span>
                <input
                  type="checkbox"
                  checked={playerConfig.preferImdbForMovies}
                  onChange={(e) =>
                    onChange({ ...playerConfig, preferImdbForMovies: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-400 shrink-0"
                />
              </label>
            </div>
          </div>
        )}

        {/* WatchaFlix Official Source Settings */}
        {playerConfig.sourceMode === 'watchaflix' && (
          <div className="rounded-xl bg-sky-500/5 border border-sky-400/25 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  Integração WatchaFlix (Sem Key / Token)
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Endpoint servidor oficial:{' '}
                  <span className="font-mono-tabular text-emerald-300">https://api.watcha.one</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...playerConfig,
                    watchaflixBaseUrl: DEFAULT_WATCHAFLIX_BASE_URL,
                  })
                }
                className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                Usar Padrão Oficial
              </button>
            </div>

            <div>
              <label htmlFor="adm-watchaflix-base" className="block text-xs text-slate-300 mb-1">
                Endpoint Base da API WatchaFlix
              </label>
              <input
                id="adm-watchaflix-base"
                type="url"
                value={playerConfig.watchaflixBaseUrl}
                onChange={(e) =>
                  onChange({ ...playerConfig, watchaflixBaseUrl: e.target.value })
                }
                onBlur={(e) =>
                  onChange({
                    ...playerConfig,
                    watchaflixBaseUrl: normalizeWatchaFlixBaseUrl(e.target.value),
                  })
                }
                placeholder="https://api.watcha.one"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
              {isDocsDomainEntered && (
                <p className="text-[11px] text-amber-300 mt-1">
                  Aviso: watchaflixapi.watcha.one é documentação — convertido automaticamente para https://api.watcha.one.
                </p>
              )}
            </div>
          </div>
        )}

        {/* MegaEmbed Specific Settings */}
        {playerConfig.sourceMode === 'megaembed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="adm-domain" className="block text-xs text-slate-300 mb-1">
                Domínio Primário
              </label>
              <select
                id="adm-domain"
                value={playerConfig.defaultDomain}
                onChange={(e) =>
                  onChange({ ...playerConfig, defaultDomain: e.target.value as MegaEmbedDomain })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              >
                {playerConfig.availableDomains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-fallback-domain" className="block text-xs text-slate-300 mb-1">
                Domínio Reserva (Fallback)
              </label>
              <select
                id="adm-fallback-domain"
                value={playerConfig.fallbackDomain}
                onChange={(e) =>
                  onChange({ ...playerConfig, fallbackDomain: e.target.value as MegaEmbedDomain })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              >
                {playerConfig.availableDomains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-player" className="block text-xs text-slate-300 mb-1">
                Motor do Player
              </label>
              <select
                id="adm-player"
                value={playerConfig.defaultPlayer}
                onChange={(e) =>
                  onChange({ ...playerConfig, defaultPlayer: e.target.value as MegaEmbedPlayer })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              >
                {playerConfig.availablePlayers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Custom Embed Templates */}
        {playerConfig.sourceMode === 'custom_template' && (
          <div className="pt-3 border-t border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-300">
                Aceita embeds HTML ou streams diretos (.m3u8 / .mp4). Variáveis:{' '}
                <span className="font-mono-tabular text-sky-300">{'{tmdbId}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{imdbId}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{season}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{episode}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{color}'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyEmbedMoviesPresetToTemplates}
                  className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Preset Direto
                </button>
                <button
                  type="button"
                  onClick={applyWatchaFlixPresetToTemplates}
                  className="h-8 px-3 rounded-lg bg-sky-500/15 border border-sky-400/30 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Preset WatchaFlix
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="adm-tpl-movie" className="block text-xs text-slate-300 mb-1">
                Template URL para Filmes
              </label>
              <input
                id="adm-tpl-movie"
                type="url"
                value={playerConfig.customEmbedMovieTemplate}
                onChange={(e) =>
                  onChange({ ...playerConfig, customEmbedMovieTemplate: e.target.value })
                }
                placeholder="https://cdn.exemplo.com/filmes/{tmdbId}.m3u8"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label htmlFor="adm-tpl-tv" className="block text-xs text-slate-300 mb-1">
                Template URL para Séries
              </label>
              <input
                id="adm-tpl-tv"
                type="url"
                value={playerConfig.customEmbedTvTemplate}
                onChange={(e) =>
                  onChange({ ...playerConfig, customEmbedTvTemplate: e.target.value })
                }
                placeholder="https://cdn.exemplo.com/series/{tmdbId}/{season}/{episode}.m3u8"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>
        )}

        {/* Admin-only resolved preview */}
        <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-white">Prévia de funcionamento (visível apenas no Admin):</p>
          <p className="font-mono-tabular text-sky-300 break-all">Filmes: {moviePreview}</p>
          <p className="font-mono-tabular text-sky-300 break-all">Séries: {tvPreview}</p>
        </div>
      </section>

      {/* 1B. Fontes, Embeds e APIs de Vídeo (Sem Limite) */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              Fontes, Embeds e APIs de Vídeo (Consumo Automático no Player)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Adicione quantas APIs JSON, embeds ou streams diretos quiser e selecione o idioma de cada fonte. Todas as fontes válidas são reproduzidas no player padrão do MegaStream sem anúncios, exibindo no player apenas os idiomas disponíveis. Fontes protegidas por Cloudflare (ex: HTTP 403 / Verificação humana) são ignoradas automaticamente para evitar bloqueios ou anúncios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleDiscoverAndUpdateSources()}
              disabled={discoveringSources || testingSources}
              className="h-8 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-semibold text-sky-100 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {discoveringSources ? (
                <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5 text-sky-300" />
              )}
              {discoveringSources ? 'Buscando Fontes...' : 'Buscar Novas Fontes'}
            </button>
            <button
              type="button"
              onClick={handleImportRecommendedSources}
              className="h-8 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-xs font-semibold text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              Importar Recomendadas
            </button>
            <button
              type="button"
              onClick={() => void handleTestAllCustomSources()}
              disabled={testingSources || discoveringSources || customSources.length === 0}
              className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              {testingSources ? 'Testando Fontes...' : 'Testar Fontes'}
            </button>
            <span className="text-xs font-mono-tabular text-slate-300 px-3 py-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
              {customSources.filter((s) => s.active).length} ativas / {customSources.length} cadastradas
            </span>
          </div>
        </div>

        {/* Automatic Source & M3U Discovery Panel */}
        <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-sky-400" />
                Descoberta Automática de APIs, Embeds & Listas .M3U
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Escaneia novas fontes limpas, importa playlists .M3U e pausa automaticamente provedores com Cloudflare ou offline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDiscoverAndUpdateSources()}
              disabled={discoveringSources || testingSources}
              className="h-8 px-3.5 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: previewAccent }}
            >
              {discoveringSources ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {discoveringSources ? 'Escaneando & Verificando...' : 'Buscar & Atualizar Tudo Agora'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="adm-discover-m3u" className="block text-[11px] text-slate-300 mb-1">
                URL de Lista .M3U / .M3U8 (opcional)
              </label>
              <input
                id="adm-discover-m3u"
                type="url"
                value={discoveryM3uUrl}
                onChange={(e) => setDiscoveryM3uUrl(e.target.value)}
                placeholder="https://exemplo.com/lista-vod.m3u"
                className="w-full h-9 px-3 rounded-lg bg-black/45 border border-white/10 text-xs text-white font-mono-tabular"
              />
            </div>

            <div>
              <label htmlFor="adm-discover-urls" className="block text-[11px] text-slate-300 mb-1">
                Novas URLs de APIs / Embeds (opcional, 1 por linha)
              </label>
              <textarea
                id="adm-discover-urls"
                rows={1}
                value={discoveryExtraUrls}
                onChange={(e) => setDiscoveryExtraUrls(e.target.value)}
                placeholder="https://api.exemplo.com/movie/{tmdbId}"
                className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-black/45 border border-white/10 text-xs text-white font-mono-tabular resize-y"
              />
            </div>
          </div>

          {discoverySummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Fontes Ativas</p>
                <p className="text-sm font-bold font-mono-tabular text-emerald-300">
                  {discoverySummary.activeCount} / {discoverySummary.totalScanned}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Adicionadas</p>
                <p className="text-sm font-bold font-mono-tabular text-sky-300">
                  +{discoverySummary.addedCount}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Pausadas (CF/Off)</p>
                <p className="text-sm font-bold font-mono-tabular text-amber-300">
                  {discoverySummary.pausedBrokenCount}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Entradas M3U</p>
                <p className="text-sm font-bold font-mono-tabular text-white">
                  {discoverySummary.m3uEntriesCount}
                </p>
              </div>
            </div>
          )}

          {discoveredM3uEntries.length > 0 && (
            <div className="rounded-lg bg-black/40 border border-white/10 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-200">
                Itens encontrados na lista .M3U ({discoveredM3uEntries.length}):
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {discoveredM3uEntries.slice(0, 15).map((entry) => {
                  const streamBadge = /\.(?:mp4|m4v|webm)(?:$|[?#])/i.test(entry.streamUrl)
                    ? 'MP4'
                    : 'M3U8';
                  return (
                    <div
                      key={entry.streamUrl}
                      className="flex items-center justify-between gap-2 text-[11px] bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1"
                    >
                      <span className="text-white truncate min-w-0">
                        {entry.name}
                        {entry.groupTitle ? ` · ${entry.groupTitle}` : ''}
                      </span>
                      <span
                        className={`font-mono-tabular shrink-0 ${
                          entry.verified === true
                            ? 'text-emerald-300'
                            : entry.verified === false
                              ? 'text-amber-300'
                              : 'text-slate-400'
                        }`}
                      >
                        {entry.verified === true
                          ? 'Online'
                          : entry.verified === false
                            ? 'Offline'
                            : streamBadge}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {importNotice && (
          <p className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-400/25 rounded-lg px-3 py-2">
            {importNotice}
          </p>
        )}
        {sourceTestError && (
          <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
            {sourceTestError}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Form Column */}
          <div className="lg:col-span-5 rounded-xl bg-black/30 border border-white/10 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-sky-400" />
                {editingSourceId ? 'Editar Fonte / API' : 'Adicionar Nova Fonte / API'}
              </h3>
              {editingSourceId && (
                <button
                  type="button"
                  onClick={resetSourceForm}
                  className="text-xs text-sky-400 hover:underline cursor-pointer"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('vidlink')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + VidLink HD (EN + Leg.)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('cinejoy')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + Cinejoy Full HD (EN)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('playerflix')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + PlayerFlix (PT-BR)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('watchplay')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + WatchPlay (PT-BR)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('novelascdn')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + NovelasCDN (PT-BR)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('fshd')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + FSHD (PT-BR)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('vidup')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + VidUp 4K (EN)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('freeapi_anime')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + FreeAPI Anime (HLS)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('freeapi_movies')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + FreeAPI Movies (/msearch)
              </button>
              <button
                type="button"
                onClick={() => applyCustomSourcePreset('streambetter')}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-slate-200 cursor-pointer"
              >
                + StreamBetter (API JSON)
              </button>
            </div>

            <div>
              <label htmlFor="csrc-name" className="block text-xs text-slate-300 mb-1">
                Nome da Fonte ou API
              </label>
              <input
                id="csrc-name"
                type="text"
                maxLength={60}
                value={srcName}
                onChange={(e) => setSrcName(e.target.value)}
                placeholder="Ex: Servidor VIP Brasil"
                className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="csrc-kind" className="block text-xs text-slate-300 mb-1">
                  Tipo de Origem
                </label>
                <select
                  id="csrc-kind"
                  value={srcKind}
                  onChange={(e) => setSrcKind(e.target.value as CustomVideoSourceKind)}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
                >
                  <option value="api">API JSON / Extrator</option>
                  <option value="embed">Embed HTML (Auto-Extração)</option>
                  <option value="direct">Stream Direto (.m3u8 / .mp4)</option>
                </select>
              </div>
              <div>
                <label htmlFor="csrc-lang" className="block text-xs text-slate-300 mb-1">
                  Idioma da Faixa
                </label>
                <select
                  id="csrc-lang"
                  value={srcLang}
                  onChange={(e) => setSrcLang(e.target.value as CustomVideoSourceLang)}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
                >
                  {CUSTOM_SOURCE_LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="csrc-movie" className="block text-xs text-slate-300 mb-1">
                URL / Template para Filmes
              </label>
              <input
                id="csrc-movie"
                type="text"
                maxLength={500}
                value={srcMovieTemplate}
                onFocus={() => setFocusedTemplateField('movie')}
                onChange={(e) => setSrcMovieTemplate(e.target.value)}
                placeholder="https://api.exemplo.com/movie/{tmdbId}"
                className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white font-mono-tabular"
              />
            </div>

            <div>
              <label htmlFor="csrc-tv" className="block text-xs text-slate-300 mb-1">
                URL / Template para Séries
              </label>
              <input
                id="csrc-tv"
                type="text"
                maxLength={500}
                value={srcTvTemplate}
                onFocus={() => setFocusedTemplateField('tv')}
                onChange={(e) => setSrcTvTemplate(e.target.value)}
                placeholder="https://api.exemplo.com/tv/{tmdbId}/{season}/{episode}"
                className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white font-mono-tabular"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400">
                Inserir variável no campo ({focusedTemplateField === 'tv' ? 'Séries' : 'Filmes'}):
              </p>
              <div className="flex flex-wrap gap-1">
                {['{tmdbId}', '{imdbId}', '{title}', '{year}', '{season}', '{episode}'].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertPlaceholderToken(token)}
                    className="px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/25 text-[11px] font-mono-tabular text-sky-200 cursor-pointer"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={srcActive}
                onChange={(e) => setSrcActive(e.target.checked)}
                className="w-4 h-4 accent-sky-400"
              />
              Fonte ativa no player
            </label>

            {srcFormError && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                {srcFormError}
              </p>
            )}

            <button
              type="button"
              onClick={handleUpsertCustomSource}
              className="w-full h-10 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: previewAccent }}
            >
              <Plus className="w-4 h-4" />
              {editingSourceId ? 'Atualizar Fonte na Lista' : 'Adicionar Fonte à Lista'}
            </button>
          </div>

          {/* Sources List Column */}
          <div className="lg:col-span-7 space-y-3">
            {customSources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-slate-400 space-y-2">
                <p className="font-semibold text-slate-200">
                  Nenhuma fonte adicional cadastrada ainda.
                </p>
                <p>
                  As fontes nativas do MegaStream (WatchPlay, VidSrc, EmbedPlayer, MyEmbed e WatchaFlix) já funcionam automaticamente. Use o formulário ao lado para adicionar novas APIs, embeds ou streams próprios.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {customSources.map((src, idx) => (
                  <div
                    key={src.id}
                    className={`rounded-xl p-3.5 border transition-colors ${
                      src.active
                        ? 'bg-black/35 border-white/12'
                        : 'bg-black/20 border-white/5 opacity-65'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono-tabular text-slate-400">
                            #{idx + 1}
                          </span>
                          <p className="text-sm font-bold text-white truncate">{src.name}</p>
                          <span className="text-[11px] text-sky-300 font-mono-tabular">
                            {src.kind === 'api'
                              ? 'API'
                              : src.kind === 'direct'
                                ? 'Direto'
                                : 'Embed'}
                            {' · '}
                            {getCustomSourceLangMeta(src.lang).shortTag}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              src.active ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {src.active ? 'Ativa' : 'Pausada'}
                          </span>
                        </div>

                        {src.movieTemplate && (
                          <p className="text-[11px] text-slate-400 font-mono-tabular truncate mt-1">
                            Filmes: {src.movieTemplate}
                          </p>
                        )}
                        {src.tvTemplate && (
                          <p className="text-[11px] text-slate-400 font-mono-tabular truncate">
                            Séries: {src.tvTemplate}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <select
                          aria-label={`Idioma da fonte ${src.name}`}
                          value={src.lang}
                          onChange={(e) =>
                            handleUpdateCustomSourceLang(
                              src.id,
                              e.target.value as CustomVideoSourceLang
                            )
                          }
                          className="h-8 px-2 rounded-lg bg-black/50 border border-white/10 text-[11px] text-slate-200 cursor-pointer"
                          title="Selecionar idioma exibido no player"
                        >
                          {CUSTOM_SOURCE_LANG_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleMoveCustomSource(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Subir prioridade de ${src.name}`}
                          title="Subir prioridade"
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-35 text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCustomSource(idx, 1)}
                          disabled={idx === customSources.length - 1}
                          aria-label={`Descer prioridade de ${src.name}`}
                          title="Descer prioridade"
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-35 text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCustomSource(src.id)}
                          aria-label={`${src.active ? 'Pausar' : 'Ativar'} ${src.name}`}
                          className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-semibold text-slate-200 cursor-pointer"
                        >
                          {src.active ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditSource(src)}
                          aria-label={`Editar ${src.name}`}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomSource(src.id)}
                          aria-label={`Remover ${src.name}`}
                          className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {src.kind !== 'direct' &&
                      ((src.movieTemplate && !hasUrlTemplatePlaceholder(src.movieTemplate)) ||
                        (src.tvTemplate && !hasUrlTemplatePlaceholder(src.tvTemplate))) && (
                        <p className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-lg px-2.5 py-1.5">
                          Aviso: URL sem variável {'{tmdbId}'} / {'{id}'}. Sem a variável, a fonte sempre aponta para o mesmo ID fixo.
                        </p>
                      )}

                    {sourceTestResults[src.id] && (
                      <div
                        className={`mt-2 text-[11px] rounded-lg px-2.5 py-1.5 border flex items-start justify-between gap-2 ${
                          sourceTestResults[src.id].status === 'ok_direct'
                            ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-200'
                            : sourceTestResults[src.id].status === 'blocked_cloudflare' ||
                                sourceTestResults[src.id].status === 'blocked_ads' ||
                                sourceTestResults[src.id].status === 'missing_placeholders'
                              ? 'bg-amber-500/10 border-amber-400/25 text-amber-200'
                              : 'bg-red-500/10 border-red-400/25 text-red-200'
                        }`}
                      >
                        <span>{sourceTestResults[src.id].message}</span>
                        <span className="font-mono-tabular shrink-0 opacity-80">
                          {sourceTestResults[src.id].latencyMs}ms
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-sky-500/8 border border-sky-400/20 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-300">
                Após adicionar, ordenar ou editar fontes na lista, salve para aplicar no site e na Vercel.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-3.5 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap disabled:opacity-60"
                style={{ backgroundColor: previewAccent }}
              >
                {saving ? 'Salvando...' : 'Aplicar Fontes no Site'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Personalização Completa do Player Principal MegaStream (Estilo Watcha) */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-6">
        <div>
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: previewAccent }} />
            Personalização do Player Principal MegaStream (Estilo Watcha)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure cor de destaque, idioma preferencial, proporção padrão, legendas automáticas, recursos da barra de controles e próximo episódio em todos os filmes e séries.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* Core Playback & Theme Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adm-color" className="block text-xs text-slate-300 mb-1">
                  Cor Principal do Player
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Cor principal do player"
                    value={previewAccent}
                    onChange={(e) =>
                      onChange({ ...playerConfig, defaultColorHex: e.target.value.replace('#', '') })
                    }
                    className="h-10 w-11 rounded-xl bg-transparent border border-white/10 cursor-pointer shrink-0"
                  />
                  <input
                    id="adm-color"
                    type="text"
                    maxLength={6}
                    value={playerConfig.defaultColorHex}
                    onChange={(e) =>
                      onChange({ ...playerConfig, defaultColorHex: e.target.value.replace('#', '') })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="adm-watchaflix-lang" className="block text-xs text-slate-300 mb-1">
                  Áudio & Idioma Preferencial
                </label>
                <select
                  id="adm-watchaflix-lang"
                  value={playerConfig.watchaflixLang}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      watchaflixLang: e.target.value as WatchaFlixLang,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                >
                  <option value="pt">Português (Dublado Prioritário)</option>
                  <option value="en">Inglês / Original Prioritário</option>
                </select>
              </div>

              <div>
                <label htmlFor="adm-aspect-mode" className="block text-xs text-slate-300 mb-1">
                  Proporção Inicial da Tela
                </label>
                <select
                  id="adm-aspect-mode"
                  value={playerConfig.defaultAspectMode}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      defaultAspectMode: e.target.value as PlayerAspectMode,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                >
                  {(Object.keys(ASPECT_LABELS) as PlayerAspectMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {ASPECT_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="adm-timeout" className="block text-xs text-slate-300 mb-1">
                  Timeout de Carga (seg)
                </label>
                <input
                  id="adm-timeout"
                  type="number"
                  min={5}
                  max={30}
                  value={playerConfig.embedTimeoutSeconds}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      embedTimeoutSeconds: Math.max(5, Math.min(30, Number(e.target.value) || 12)),
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                />
              </div>
            </div>

            {/* Subtitles Defaults Block */}
            <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Captions className="w-4 h-4" style={{ color: previewAccent }} />
                    Aparência & Ativação de Legendas
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Estilo padrão exibido no WatchaPlayer (espectadores também podem ajustar no player).
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-white cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={playerConfig.autoEnableSubtitles}
                    onChange={(e) =>
                      onChange({ ...playerConfig, autoEnableSubtitles: e.target.checked })
                    }
                    className="w-4 h-4 accent-sky-400"
                  />
                  Auto-ativar
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="adm-sub-size" className="block text-xs text-slate-300 mb-1">
                    Tamanho
                  </label>
                  <select
                    id="adm-sub-size"
                    value={playerConfig.defaultSubtitleSize}
                    onChange={(e) =>
                      onChange({
                        ...playerConfig,
                        defaultSubtitleSize: e.target.value as PlayerSubtitleSize,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
                  >
                    <option value="sm">Pequeno (P)</option>
                    <option value="md">Médio (M)</option>
                    <option value="lg">Grande (G)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="adm-sub-color" className="block text-xs text-slate-300 mb-1">
                    Cor da Fonte
                  </label>
                  <select
                    id="adm-sub-color"
                    value={playerConfig.defaultSubtitleColor}
                    onChange={(e) =>
                      onChange({
                        ...playerConfig,
                        defaultSubtitleColor: e.target.value as PlayerSubtitleColor,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
                  >
                    <option value="white">Branco</option>
                    <option value="yellow">Amarelo Cinema</option>
                    <option value="cyan">Azul Claro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="adm-sub-bg" className="block text-xs text-slate-300 mb-1">
                    Fundo da Legenda
                  </label>
                  <select
                    id="adm-sub-bg"
                    value={playerConfig.defaultSubtitleBg}
                    onChange={(e) =>
                      onChange({
                        ...playerConfig,
                        defaultSubtitleBg: e.target.value as PlayerSubtitleBg,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl bg-black/45 border border-white/10 text-xs text-white"
                  >
                    <option value="box">Caixa Escura</option>
                    <option value="shadow">Sombra Limpa</option>
                    <option value="none">Transparente</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Watcha Controls Visibility Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Cast className="w-4 h-4 text-sky-400 shrink-0" />
                  Reproduzir Diretamente na TV
                </span>
                <input
                  type="checkbox"
                  checked={playerConfig.allowTvCast}
                  onChange={(e) => onChange({ ...playerConfig, allowTvCast: e.target.checked })}
                  className="w-4 h-4 accent-sky-400 shrink-0"
                />
              </label>

              <label className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <PictureInPicture2 className="w-4 h-4 text-sky-400 shrink-0" />
                  Mini Player (PiP)
                </span>
                <input
                  type="checkbox"
                  checked={playerConfig.allowPipMode}
                  onChange={(e) => onChange({ ...playerConfig, allowPipMode: e.target.checked })}
                  className="w-4 h-4 accent-sky-400 shrink-0"
                />
              </label>

              <label className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <RectangleHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
                  Modo Teatro
                </span>
                <input
                  type="checkbox"
                  checked={playerConfig.allowTheaterMode}
                  onChange={(e) =>
                    onChange({ ...playerConfig, allowTheaterMode: e.target.checked })
                  }
                  className="w-4 h-4 accent-sky-400 shrink-0"
                />
              </label>

              <label className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-sky-400 shrink-0" />
                  Fallback Automático
                </span>
                <input
                  type="checkbox"
                  checked={playerConfig.autoFallback}
                  onChange={(e) => onChange({ ...playerConfig, autoFallback: e.target.checked })}
                  className="w-4 h-4 accent-sky-400 shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Right Live WatchaPlayer Visual Preview */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">
                Prévia ao Vivo do Player Principal:
              </p>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {playerConfig.defaultAspectMode === 'cinema' ? '21:9' : '16:9'} · #
                {playerConfig.defaultColorHex}
              </span>
            </div>

            <div
              data-testid="admin-watcha-preview"
              className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-[#0b1530] via-[#040712] to-[#0a1836] border border-white/15 shadow-2xl"
            >
              {/* Cinema letterbox bars when cinema aspect is selected */}
              {playerConfig.defaultAspectMode === 'cinema' && (
                <>
                  <div className="absolute inset-x-0 top-0 h-3 bg-black z-10" />
                  <div className="absolute inset-x-0 bottom-0 h-3 bg-black z-10" />
                </>
              )}

              {/* Mock Top Bar */}
              <div className="absolute inset-x-0 top-0 px-3 py-2.5 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent z-10">
                <div className="min-w-0">
                  <p className="text-[11px] font-display font-bold text-white truncate">
                    {siteConfig.siteName || 'MegaStream'} · Cinema HD
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {playerConfig.watchaflixLang === 'pt'
                      ? 'Dublado (PT-BR)'
                      : 'Legendado (Original)'}
                  </p>
                </div>
                {playerConfig.allowTvCast && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 border border-white/15 text-[9px] font-semibold text-white shrink-0">
                    <Cast className="w-2.5 h-2.5" style={{ color: previewAccent }} />
                    TV
                  </span>
                )}
              </div>

              {/* Center Play Ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center border border-white/25 bg-black/65 shadow-xl"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" style={{ color: previewAccent }} />
                </div>
              </div>

              {/* Optional Watermark Preview (only for iframe fallbacks when enabled) */}
              {playerConfig.watermarkEnabled && !isWatchaPrincipal && (
                <div
                  className={`absolute ${POSITION_CLASSES[playerConfig.watermarkPosition]} pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/60 border border-white/10 z-20`}
                  style={{ opacity: playerConfig.watermarkOpacity }}
                >
                  {previewWatermarkLogo ? (
                    <img
                      src={previewWatermarkLogo}
                      alt={previewWatermarkText}
                      className="w-3.5 h-3.5 rounded object-cover"
                    />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: previewAccent }}
                    />
                  )}
                  <span className="font-display font-bold text-[10px] text-white">
                    {previewWatermarkText}
                  </span>
                </div>
              )}

              {/* Live Subtitle Sample */}
              <div className="absolute inset-x-3 bottom-10 flex justify-center text-center pointer-events-none z-10">
                <span
                  className={`font-semibold transition-all ${PREVIEW_SUB_SIZE_CLASS[playerConfig.defaultSubtitleSize]} ${PREVIEW_SUB_COLOR_CLASS[playerConfig.defaultSubtitleColor]} ${PREVIEW_SUB_BG_CLASS[playerConfig.defaultSubtitleBg]} ${
                    playerConfig.autoEnableSubtitles ? 'opacity-100' : 'opacity-45'
                  }`}
                >
                  {playerConfig.autoEnableSubtitles
                    ? 'Exemplo de legenda automática'
                    : 'Legenda (ativável no ícone CC)'}
                </span>
              </div>

              {/* Mock Watcha Bottom Bar */}
              <div className="absolute inset-x-0 bottom-0 pt-2 pb-1.5 px-3 bg-gradient-to-t from-black/95 via-black/75 to-transparent space-y-1 z-10">
                <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full w-2/5" style={{ backgroundColor: previewAccent }} />
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <div className="flex items-center gap-2 text-[9px] font-mono-tabular">
                    <Play className="w-3 h-3 fill-current" />
                    <span>14:22 / 48:10</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Languages className="w-3 h-3" />
                    <Captions
                      className="w-3 h-3"
                      style={
                        playerConfig.autoEnableSubtitles ? { color: previewAccent } : undefined
                      }
                    />
                    <Settings className="w-3 h-3" />
                    {playerConfig.allowPipMode && <PictureInPicture2 className="w-3 h-3" />}
                    {playerConfig.allowTheaterMode && <RectangleHorizontal className="w-3 h-3" />}
                    <Maximize2 className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Sem anúncios, sem bloqueios Cloudflare e sem logos de terceiros. Aplicado em 100% dos filmes e séries.
            </p>
          </div>
        </div>

        {/* Auto-Next Episode Settings */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <label className="md:col-span-2 rounded-xl bg-black/30 border border-white/10 p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-3">
              <FastForward className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">
                  Pular para o Próximo Episódio Automaticamente
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Exibe contagem regressiva ao finalizar um episódio e avança automaticamente para o seguinte, inclusive entre temporadas.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={playerConfig.autoNextEpisode}
              onChange={(e) =>
                onChange({ ...playerConfig, autoNextEpisode: e.target.checked })
              }
              className="w-4 h-4 accent-sky-500 shrink-0"
            />
          </label>

          <div>
            <label htmlFor="adm-autonext-sec" className="block text-xs text-slate-300 mb-1">
              Contagem Regressiva (seg)
            </label>
            <input
              id="adm-autonext-sec"
              type="number"
              min={3}
              max={30}
              value={playerConfig.autoNextCountdownSeconds}
              onChange={(e) =>
                onChange({
                  ...playerConfig,
                  autoNextCountdownSeconds: Math.max(
                    3,
                    Math.min(30, Number(e.target.value) || 8)
                  ),
                })
              }
              className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
            />
          </div>
        </div>
      </section>

      {/* 3. Opções Avançadas (Marca d'Água em Iframes Fallback) */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-sky-400" />
            Marca d'Água Opcional (Apenas em Iframes Fallback)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            O WatchaPlayer Principal não exibe marca d'água sobre o vídeo para preservar uma experiência limpa de cinema. Estas opções se aplicam apenas caso algum título use player externo em iframe fallback.
          </p>
        </div>

        <label className="rounded-xl bg-black/30 border border-white/10 p-3.5 flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-white">Exibir Marca d'Água em Iframes Fallback</p>
            <p className="text-[11px] text-slate-400">
              Desativada por padrão ({siteConfig.siteName || 'MegaStream'}).
            </p>
          </div>
          <input
            type="checkbox"
            checked={playerConfig.watermarkEnabled}
            onChange={(e) =>
              onChange({ ...playerConfig, watermarkEnabled: e.target.checked })
            }
            className="w-4 h-4 accent-sky-500 shrink-0"
          />
        </label>

        {playerConfig.watermarkEnabled && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adm-wm-text" className="block text-xs text-slate-300 mb-1">
                  Texto da Marca d'Água (opcional)
                </label>
                <input
                  id="adm-wm-text"
                  type="text"
                  maxLength={40}
                  value={playerConfig.watermarkText}
                  onChange={(e) => onChange({ ...playerConfig, watermarkText: e.target.value })}
                  placeholder={siteConfig.siteName || 'MegaStream'}
                  className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="adm-wm-logo" className="block text-xs text-slate-300 mb-1">
                  URL da Logo no Player (opcional)
                </label>
                <input
                  id="adm-wm-logo"
                  type="url"
                  maxLength={500}
                  value={playerConfig.watermarkLogoUrl}
                  onChange={(e) =>
                    onChange({ ...playerConfig, watermarkLogoUrl: e.target.value })
                  }
                  placeholder={siteConfig.logoUrl || 'Usa a logo padrão do MegaStream'}
                  className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="adm-wm-pos" className="block text-xs text-slate-300 mb-1">
                  Posição
                </label>
                <select
                  id="adm-wm-pos"
                  value={playerConfig.watermarkPosition}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      watermarkPosition: e.target.value as WatermarkPosition,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                >
                  <option value="top-left">Superior Esquerda</option>
                  <option value="top-right">Superior Direita</option>
                  <option value="bottom-left">Inferior Esquerda</option>
                  <option value="bottom-right">Inferior Direita</option>
                </select>
              </div>

              <div>
                <label htmlFor="adm-wm-size" className="block text-xs text-slate-300 mb-1">
                  Tamanho
                </label>
                <select
                  id="adm-wm-size"
                  value={playerConfig.watermarkSize}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      watermarkSize: e.target.value as WatermarkSize,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                >
                  <option value="sm">Discreto (P)</option>
                  <option value="md">Padrão (M)</option>
                  <option value="lg">Destaque (G)</option>
                </select>
              </div>

              <div>
                <label htmlFor="adm-wm-opacity" className="block text-xs text-slate-300 mb-1">
                  Opacidade ({Math.round(playerConfig.watermarkOpacity * 100)}%)
                </label>
                <input
                  id="adm-wm-opacity"
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={playerConfig.watermarkOpacity}
                  onChange={(e) =>
                    onChange({
                      ...playerConfig,
                      watermarkOpacity: Number(e.target.value),
                    })
                  }
                  className="w-full h-10 accent-sky-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {playerDiagnostic && (
          <div
            className={`rounded-xl p-3.5 border text-xs flex flex-wrap items-center justify-between gap-2 ${
              playerDiagnostic.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/35 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {playerDiagnostic.ok ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-medium">{playerDiagnostic.message}</span>
            </div>
            <span className="font-mono-tabular text-[11px] opacity-80 shrink-0">
              {playerDiagnostic.latencyMs} ms
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            {saving ? 'Salvando...' : 'Salvar Configuração do Player Principal'}
          </button>
        </div>
      </section>
    </form>
  );
}
