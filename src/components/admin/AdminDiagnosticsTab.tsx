import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Database,
  Download,
  Layers,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { DiagnosticResult, IntegrationStatus, SystemLogEntry } from '../../../shared/types';

interface AdminDiagnosticsTabProps {
  integrations: IntegrationStatus | null;
  logs: SystemLogEntry[];
  diagnostics: Partial<Record<'tmdb' | 'player' | 'firestore', DiagnosticResult>>;
  testingTarget: 'tmdb' | 'player' | 'firestore' | null;
  onRunDiagnostic: (target: 'tmdb' | 'player' | 'firestore') => void;
  onRunAllDiagnostics: () => void;
  onExportBackup: () => void;
  onClearCache: () => void;
  onSyncCatalog: () => void;
}

export function AdminDiagnosticsTab({
  integrations,
  logs,
  diagnostics,
  testingTarget,
  onRunDiagnostic,
  onRunAllDiagnostics,
  onExportBackup,
  onClearCache,
  onSyncCatalog,
}: AdminDiagnosticsTabProps) {
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filteredLogs = logs.filter((log) =>
    logFilter === 'all' ? true : log.level === logFilter
  );

  const diagnosticCards: Array<{
    target: 'tmdb' | 'player' | 'firestore';
    title: string;
    subtitle: string;
  }> = [
    {
      target: 'tmdb',
      title: 'TMDB API & Catálogo',
      subtitle: 'Valida token, URL base e resposta real do catálogo.',
    },
    {
      target: 'player',
      title: 'Resolução de Player',
      subtitle: 'Testa construção de URLs para filmes e episódios.',
    },
    {
      target: 'firestore',
      title: 'Cloud Firestore REST',
      subtitle: 'Verifica comunicação com a base de dados na nuvem.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Integrations Overview */}
      {integrations && (
        <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Status das Integrações do Servidor
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSyncCatalog}
                className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                Sincronizar Catálogo
              </button>
              <button
                type="button"
                onClick={onClearCache}
                className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                Limpar Cache ({integrations.cacheEntries})
              </button>
              <button
                type="button"
                onClick={onExportBackup}
                className="h-9 px-3.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Backup JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1">
              <p className="font-semibold text-white">Catálogo TMDB</p>
              <p
                className={
                  integrations.tmdbConfigured ? 'text-emerald-300 text-xs' : 'text-amber-300 text-xs'
                }
              >
                {integrations.tmdbConfigured
                  ? `Ativo (${integrations.tmdbActiveTokenSource})`
                  : `Modo ${integrations.tmdbRuntimeSource}`}
              </p>
              <p className="text-[11px] text-slate-400 font-mono-tabular">
                {integrations.catalogSyncedCount} títulos em memória
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1">
              <p className="font-semibold text-white">Gemini IA</p>
              <p
                className={
                  integrations.geminiConfigured
                    ? 'text-emerald-300 text-xs'
                    : 'text-amber-300 text-xs'
                }
              >
                {integrations.geminiConfigured
                  ? `Ativa (${integrations.geminiActiveKeySource})`
                  : 'Modo Curadoria Local'}
              </p>
              <p className="text-[11px] text-slate-400">Recomendações inteligentes</p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1">
              <p className="font-semibold text-white">Motor de Player</p>
              <p className="text-emerald-300 text-xs">
                {integrations.playerSourceMode === 'custom_template'
                  ? 'Template Customizado Ativo'
                  : 'MegaEmbed Ativo'}
              </p>
              <p className="text-[11px] text-slate-400">Resolução oculta para usuários</p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1">
              <p className="font-semibold text-white">Firebase & Cloud</p>
              <p className="text-emerald-300 text-xs">Firestore & Auth conectados</p>
              <p className="text-[11px] text-slate-400 font-mono-tabular">
                Cache: {integrations.cacheEntries} entradas
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Live Server Diagnostics */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Diagnósticos em Tempo Real
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Execute testes ao vivo no servidor para validar conectividade e latência.
            </p>
          </div>
          <button
            type="button"
            onClick={onRunAllDiagnostics}
            disabled={testingTarget !== null}
            className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {testingTarget ? 'Testando...' : 'Executar Todos os Testes'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {diagnosticCards.map((card) => {
            const res = diagnostics[card.target];
            const isRunning = testingTarget === card.target;
            return (
              <div
                key={card.target}
                className="rounded-xl bg-black/30 border border-white/10 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white">{card.title}</p>
                    {res && (
                      <span
                        className={`text-[11px] font-mono-tabular ${
                          res.ok ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {res.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{card.subtitle}</p>
                  {res && (
                    <p
                      className={`text-xs pt-1 flex items-start gap-1.5 ${
                        res.ok ? 'text-emerald-200' : 'text-amber-200'
                      }`}
                    >
                      {res.ok ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <span>{res.message}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRunDiagnostic(card.target)}
                  disabled={isRunning}
                  className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {isRunning ? 'Testando...' : 'Testar Agora'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Logs */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            Registros Recentes do Sistema ({filteredLogs.length})
          </h2>
          <div className="flex items-center gap-1.5">
            {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLogFilter(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer uppercase ${
                  logFilter === lvl
                    ? 'text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
                style={logFilter === lvl ? { backgroundColor: 'var(--ms-accent)' } : undefined}
              >
                {lvl === 'all' ? 'Todos' : lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto font-mono-tabular text-xs">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-400 py-6 text-center">Nenhum registro neste filtro.</p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-black/35 border border-white/5 flex flex-wrap gap-3 items-baseline"
              >
                <span className="text-slate-500">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </span>
                <span
                  className={
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warn'
                        ? 'text-amber-300'
                        : 'text-sky-300'
                  }
                >
                  [{log.service}]
                </span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
