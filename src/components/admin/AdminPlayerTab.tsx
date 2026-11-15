import React from 'react';
import { Activity, AlertTriangle, Check, Globe, Sliders, Sparkles } from 'lucide-react';
import {
  DEFAULT_WATCHAFLIX_BASE_URL,
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildWatchaFlixEmbedUrl,
  normalizeWatchaFlixBaseUrl,
} from '../../../shared/playerUrl';
import type {
  DiagnosticResult,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerConfig,
  PlayerSourceMode,
  WatchaFlixLang,
} from '../../../shared/types';

interface AdminPlayerTabProps {
  playerConfig: PlayerConfig;
  onChange: (next: PlayerConfig) => void;
  saving: boolean;
  testingPlayer: boolean;
  playerDiagnostic: DiagnosticResult | null;
  onSave: (e: React.FormEvent) => void;
  onTestPlayer: () => void;
}

export function AdminPlayerTab({
  playerConfig,
  onChange,
  saving,
  testingPlayer,
  playerDiagnostic,
  onSave,
  onTestPlayer,
}: AdminPlayerTabProps) {
  const moviePreview =
    playerConfig.sourceMode === 'watchaflix'
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
    playerConfig.sourceMode === 'watchaflix'
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

  const applyWatchaFlixPresetToTemplates = () => {
    const base = normalizeWatchaFlixBaseUrl(playerConfig.watchaflixBaseUrl);
    const lang = playerConfig.watchaflixLang || 'pt';
    onChange({
      ...playerConfig,
      customEmbedMovieTemplate: `${base}/embed/movie/{tmdbId}?color={color}&lang=${lang}`,
      customEmbedTvTemplate: `${base}/embed/tv/{tmdbId}/{season}/{episode}?color={color}&lang=${lang}`,
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-6 max-w-4xl">
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Configuração Interna de Players, Fontes e Embed
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Estas definições operam apenas no servidor e nunca são exibidas na tela pública do usuário.
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

        {/* Source Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              {
                id: 'megaembed',
                title: 'MegaEmbed Oficial',
                desc: 'Domínios mgeb.lat / mgeb.space com seleção automática de player.',
              },
              {
                id: 'watchaflix',
                title: 'WatchaFlix API',
                desc: 'Player público por ID TMDB (api.watcha.one), sem key ou token, áudio PT/EN e legendas.',
              },
              {
                id: 'custom_template',
                title: 'Template Customizado',
                desc: 'URLs próprias com {tmdbId}, {season}, {episode}, {player} e {color}.',
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
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{mode.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{mode.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

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
                  O portal <span className="font-mono-tabular text-sky-300">watchaflixapi.watcha.one</span> é a página de documentação; o servidor real de embed da WatchaFlix é{' '}
                  <span className="font-mono-tabular text-emerald-300">https://api.watcha.one</span>. Ao salvar, qualquer URL do portal é convertida automaticamente.
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
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
                    Aviso: watchaflixapi.watcha.one é o site de documentação — será convertido automaticamente para https://api.watcha.one.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="adm-watchaflix-lang" className="block text-xs text-slate-300 mb-1">
                  Idioma Padrão do Player (lang)
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
                  <option value="pt">Português (pt)</option>
                  <option value="en">Inglês (en)</option>
                </select>
              </div>
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

        {/* Shared Accent Color, Timeout & MegaEmbed AutoFallback */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label htmlFor="adm-color" className="block text-xs text-slate-300 mb-1">
              Cor de Destaque do Player (#color)
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                aria-label="Cor do player"
                value={`#${(playerConfig.defaultColorHex || '00a8ff').replace('#', '').slice(0, 6)}`}
                onChange={(e) =>
                  onChange({ ...playerConfig, defaultColorHex: e.target.value.replace('#', '') })
                }
                className="h-10 w-12 rounded-xl bg-transparent border border-white/10 cursor-pointer"
              />
              <input
                id="adm-color"
                type="text"
                maxLength={6}
                value={playerConfig.defaultColorHex}
                onChange={(e) =>
                  onChange({ ...playerConfig, defaultColorHex: e.target.value.replace('#', '') })
                }
                className="flex-1 h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adm-timeout" className="block text-xs text-slate-300 mb-1">
              Timeout de Carregamento (seg)
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

          <label className="rounded-xl bg-black/30 border border-white/10 p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-white">Fallback Automático</p>
              <p className="text-[11px] text-slate-400">
                Alterna o domínio caso falhe.
              </p>
            </div>
            <input
              type="checkbox"
              checked={playerConfig.autoFallback}
              onChange={(e) => onChange({ ...playerConfig, autoFallback: e.target.checked })}
              className="w-4 h-4 accent-sky-500 shrink-0"
            />
          </label>
        </div>

        {/* Custom Embed Templates */}
        {playerConfig.sourceMode === 'custom_template' && (
          <div className="pt-3 border-t border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-300">
                Variáveis aceitas: <span className="font-mono-tabular text-sky-300">{'{tmdbId}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{tmdb_id}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{season}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{episode}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{player}'}</span>,{' '}
                <span className="font-mono-tabular text-sky-300">{'{color}'}</span>
              </p>
              <button
                type="button"
                onClick={applyWatchaFlixPresetToTemplates}
                className="h-8 px-3 rounded-lg bg-sky-500/15 border border-sky-400/30 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Preencher Preset WatchaFlix
              </button>
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
                placeholder="https://api.watcha.one/embed/movie/{tmdbId}?color={color}&lang=pt"
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
                placeholder="https://api.watcha.one/embed/tv/{tmdbId}/{season}/{episode}?color={color}&lang=pt"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>
        )}

        {/* Admin-only resolved preview */}
        <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-white">Prévia de URL resolvida (visível apenas no Admin):</p>
          <p className="font-mono-tabular text-sky-300 break-all">Filmes: {moviePreview}</p>
          <p className="font-mono-tabular text-sky-300 break-all">Séries: {tvPreview}</p>
        </div>

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
            {saving ? 'Salvando...' : 'Salvar Configuração de Players'}
          </button>
        </div>
      </section>
    </form>
  );
}
