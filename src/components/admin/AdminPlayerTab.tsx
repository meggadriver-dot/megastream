import React from 'react';
import { Activity, AlertTriangle, Check, Sliders } from 'lucide-react';
import { buildCustomEmbedUrl, buildMegaEmbedUrl } from '../../../shared/playerUrl';
import type {
  DiagnosticResult,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerConfig,
  PlayerSourceMode,
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
    playerConfig.sourceMode === 'custom_template' && playerConfig.customEmbedMovieTemplate
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
    playerConfig.sourceMode === 'custom_template' && playerConfig.customEmbedTvTemplate
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              {
                id: 'megaembed',
                title: 'MegaEmbed Oficial',
                desc: 'Usa domínios dedicados mgeb.lat / mgeb.space com seleção automática de player.',
              },
              {
                id: 'custom_template',
                title: 'Template de Embed Customizado',
                desc: 'Usa suas próprias URLs com variáveis {tmdbId}, {season}, {episode}, {player} e {color}.',
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
                <div>
                  <p className="text-sm font-bold text-white">{mode.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mode.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Domains, Engine, Color & Timeout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label htmlFor="adm-color" className="block text-xs text-slate-300 mb-1">
              Cor de Destaque do Player (#color:)
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

          <label className="rounded-xl bg-black/30 border border-white/10 p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-white">Fallback Automático de Domínio</p>
              <p className="text-[11px] text-slate-400">
                Alterna automaticamente caso o domínio principal esteja indisponível.
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
          <div className="pt-2 border-t border-white/10 space-y-4">
            <div>
              <label htmlFor="adm-tpl-movie" className="block text-xs text-slate-300 mb-1">
                Template URL para Filmes (variáveis: {'{tmdbId}'}, {'{player}'}, {'{color}'})
              </label>
              <input
                id="adm-tpl-movie"
                type="url"
                value={playerConfig.customEmbedMovieTemplate}
                onChange={(e) =>
                  onChange({ ...playerConfig, customEmbedMovieTemplate: e.target.value })
                }
                placeholder="https://seu-embed.exemplo/movie/{tmdbId}?player={player}#color:{color}"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>

            <div>
              <label htmlFor="adm-tpl-tv" className="block text-xs text-slate-300 mb-1">
                Template URL para Séries (variáveis: {'{tmdbId}'}, {'{season}'}, {'{episode}'}, {'{player}'}, {'{color}'})
              </label>
              <input
                id="adm-tpl-tv"
                type="url"
                value={playerConfig.customEmbedTvTemplate}
                onChange={(e) =>
                  onChange({ ...playerConfig, customEmbedTvTemplate: e.target.value })
                }
                placeholder="https://seu-embed.exemplo/tv/{tmdbId}/{season}/{episode}?player={player}#color:{color}"
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
