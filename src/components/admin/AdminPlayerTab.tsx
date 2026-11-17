import React from 'react';
import {
  Activity,
  AlertTriangle,
  Captions,
  Cast,
  Check,
  Eye,
  FastForward,
  Globe,
  Languages,
  Maximize2,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tv,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_MYEMBED_BASE_URL,
  DEFAULT_WATCHAFLIX_BASE_URL,
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildMyEmbedUrl,
  buildWatchaFlixEmbedUrl,
  normalizeMyEmbedBaseUrl,
  normalizeWatchaFlixBaseUrl,
} from '../../../shared/playerUrl';
import type {
  DiagnosticResult,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerAspectMode,
  PlayerConfig,
  PlayerSourceMode,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  WatchaFlixLang,
  WatermarkPosition,
  WatermarkSize,
} from '../../../shared/types';
import { useSiteConfig } from '../../contexts/SiteConfigContext';

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
          <button
            type="button"
            onClick={onTestPlayer}
            disabled={testingPlayer}
            className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            {testingPlayer ? 'Testando...' : 'Testar Resolução'}
          </button>
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
                  Botão Espelhar na TV
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
