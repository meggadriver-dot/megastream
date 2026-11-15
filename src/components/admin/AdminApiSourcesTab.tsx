import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  Database,
  Globe,
  KeyRound,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AdminSecretsStatus,
  AiMode,
  CatalogSourceMode,
  DiagnosticResult,
  SystemSettings,
  TmdbImageQuality,
  TmdbLanguage,
} from '../../../shared/types';

interface AdminApiSourcesTabProps {
  systemSettings: SystemSettings;
  onChange: (next: SystemSettings) => void;
  secretsStatus: AdminSecretsStatus | null;
  tmdbTokenInput: string;
  onTmdbTokenInputChange: (v: string) => void;
  geminiKeyInput: string;
  onGeminiKeyInputChange: (v: string) => void;
  saving: boolean;
  testingTarget: 'tmdb' | 'player' | 'firestore' | null;
  tmdbDiagnostic: DiagnosticResult | null;
  onSave: (e: React.FormEvent) => void;
  onClearSecret: (target: 'tmdb' | 'gemini') => void;
  onTestTmdb: () => void;
  onResetDefaults: () => void;
}

const CATALOG_SOURCE_OPTIONS: Array<{
  id: CatalogSourceMode;
  title: string;
  desc: string;
}> = [
  {
    id: 'auto',
    title: 'Automático (Recomendado)',
    desc: 'Usa TMDB Ao Vivo quando houver token ativo; caso contrário usa catálogo Demo + Mídias Customizadas.',
  },
  {
    id: 'tmdb',
    title: 'TMDB API Ao Vivo',
    desc: 'Prioriza dados oficiais em tempo real da API do TMDB (com fallback seguro se o servidor externo falhar).',
  },
  {
    id: 'demo',
    title: 'Catálogo Local + Custom',
    desc: 'Não faz requisições externas ao TMDB. Ideal para testes offline ou operação controlada.',
  },
  {
    id: 'custom_only',
    title: 'Somente Mídias do Admin',
    desc: 'Exibe exclusivamente os filmes e séries cadastrados manualmente na aba Catálogo & Mídias.',
  },
];

const AI_MODE_OPTIONS: Array<{ id: AiMode; label: string }> = [
  { id: 'auto', label: 'Automático (Gemini IA + Fallback Inteligente)' },
  { id: 'gemini', label: 'Priorizar Gemini API' },
  { id: 'catalog_smart', label: 'Curadoria Local por Relevância (Sem API externa)' },
  { id: 'disabled', label: 'Desativada na Plataforma' },
];

export function AdminApiSourcesTab({
  systemSettings,
  onChange,
  secretsStatus,
  tmdbTokenInput,
  onTmdbTokenInputChange,
  geminiKeyInput,
  onGeminiKeyInputChange,
  saving,
  testingTarget,
  tmdbDiagnostic,
  onSave,
  onClearSecret,
  onTestTmdb,
  onResetDefaults,
}: AdminApiSourcesTabProps) {
  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* Catalog Source Mode */}
      <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              Modo de Origem do Catálogo
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Troque em tempo real de onde a plataforma obtém filmes, séries, tendências e buscas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTestTmdb}
              disabled={testingTarget === 'tmdb'}
              className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              {testingTarget === 'tmdb' ? 'Testando TMDB...' : 'Testar Conexão TMDB'}
            </button>
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={saving}
              className="h-9 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Padrões
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CATALOG_SOURCE_OPTIONS.map((opt) => {
            const selected = systemSettings.catalogSource === opt.id;
            return (
              <label
                key={opt.id}
                className={`rounded-xl p-4 border cursor-pointer transition-colors flex items-start gap-3 ${
                  selected
                    ? 'bg-sky-500/10 border-sky-400/50'
                    : 'bg-black/30 border-white/10 hover:border-white/25'
                }`}
              >
                <input
                  type="radio"
                  name="catalogSource"
                  value={opt.id}
                  checked={selected}
                  onChange={() => onChange({ ...systemSettings, catalogSource: opt.id })}
                  className="mt-1 accent-sky-400 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{opt.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {tmdbDiagnostic && (
          <div
            className={`rounded-xl p-3.5 border text-xs flex flex-wrap items-center justify-between gap-2 ${
              tmdbDiagnostic.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/35 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {tmdbDiagnostic.ok ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-medium">{tmdbDiagnostic.message}</span>
            </div>
            <span className="font-mono-tabular text-[11px] opacity-80 shrink-0">
              {tmdbDiagnostic.latencyMs} ms
            </span>
          </div>
        )}
      </section>

      {/* TMDB Endpoints, Language, Cache & Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Endpoints & Parâmetros do TMDB
          </h2>

          <div>
            <label htmlFor="api-tmdb-base" className="block text-xs text-slate-300 mb-1">
              URL Base da API TMDB (ou Proxy/Mirror)
            </label>
            <input
              id="api-tmdb-base"
              type="url"
              value={systemSettings.tmdbBaseUrl}
              onChange={(e) => onChange({ ...systemSettings, tmdbBaseUrl: e.target.value })}
              placeholder="https://api.themoviedb.org/3"
              className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
            />
          </div>

          <div>
            <label htmlFor="api-tmdb-img" className="block text-xs text-slate-300 mb-1">
              URL Base da CDN de Imagens
            </label>
            <input
              id="api-tmdb-img"
              type="url"
              value={systemSettings.tmdbImageBaseUrl}
              onChange={(e) => onChange({ ...systemSettings, tmdbImageBaseUrl: e.target.value })}
              placeholder="https://image.tmdb.org/t/p/"
              className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="api-lang" className="block text-xs text-slate-300 mb-1">
                Idioma da API
              </label>
              <select
                id="api-lang"
                value={systemSettings.tmdbLanguage}
                onChange={(e) =>
                  onChange({ ...systemSettings, tmdbLanguage: e.target.value as TmdbLanguage })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              >
                <option value="pt-BR">Português (pt-BR)</option>
                <option value="en-US">Inglês (en-US)</option>
                <option value="es-ES">Espanhol (es-ES)</option>
              </select>
            </div>

            <div>
              <label htmlFor="api-quality" className="block text-xs text-slate-300 mb-1">
                Qualidade de Capa
              </label>
              <select
                id="api-quality"
                value={systemSettings.tmdbImageQuality}
                onChange={(e) =>
                  onChange({
                    ...systemSettings,
                    tmdbImageQuality: e.target.value as TmdbImageQuality,
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              >
                <option value="w342">w342 (Leve)</option>
                <option value="w500">w500 (Padrão)</option>
                <option value="w780">w780 (Alta Definição)</option>
              </select>
            </div>

            <div>
              <label htmlFor="api-ttl" className="block text-xs text-slate-300 mb-1">
                Cache (minutos)
              </label>
              <input
                id="api-ttl"
                type="number"
                min={1}
                max={1440}
                value={systemSettings.cacheTtlMinutes}
                onChange={(e) =>
                  onChange({
                    ...systemSettings,
                    cacheTtlMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 10)),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>

          <label className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-white">Incluir resultados adultos (+18)</p>
              <p className="text-[11px] text-slate-400">
                Quando desativado (recomendado), filtra conteúdo adulto nas buscas do TMDB.
              </p>
            </div>
            <input
              type="checkbox"
              checked={systemSettings.includeAdult}
              onChange={(e) => onChange({ ...systemSettings, includeAdult: e.target.checked })}
              className="w-4 h-4 accent-sky-500 shrink-0"
            />
          </label>
        </section>

        {/* Runtime API Credentials & Gemini AI Settings */}
        <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-400" />
            Credenciais em Runtime & IA Inteligente
          </h2>

          {/* TMDB Override Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="api-tmdb-token" className="text-xs text-slate-300">
                Token TMDB (v3 API Key ou v4 Bearer JWT)
              </label>
              <span className="text-[11px] font-mono-tabular text-sky-300">
                {secretsStatus?.hasCustomTmdbToken
                  ? `Custom (${secretsStatus.tmdbTokenMask})`
                  : secretsStatus?.hasEnvTmdbToken
                    ? 'Variável de Ambiente'
                    : 'Não configurado'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="api-tmdb-token"
                type="password"
                autoComplete="off"
                value={tmdbTokenInput}
                onChange={(e) => onTmdbTokenInputChange(e.target.value)}
                placeholder="Cole um novo token para substituir o atual..."
                className="flex-1 h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
              {secretsStatus?.hasCustomTmdbToken && (
                <button
                  type="button"
                  onClick={() => onClearSecret('tmdb')}
                  disabled={saving}
                  title="Remover token customizado"
                  className="h-10 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Gemini Key Override */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="api-gemini-key" className="text-xs text-slate-300">
                Chave Gemini API (Sobrescrita Segura)
              </label>
              <span className="text-[11px] font-mono-tabular text-sky-300">
                {secretsStatus?.hasCustomGeminiKey
                  ? `Custom (${secretsStatus.geminiKeyMask})`
                  : secretsStatus?.hasEnvGeminiKey
                    ? 'Variável de Ambiente'
                    : 'Não configurado'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="api-gemini-key"
                type="password"
                autoComplete="off"
                value={geminiKeyInput}
                onChange={(e) => onGeminiKeyInputChange(e.target.value)}
                placeholder="Cole uma nova Gemini API Key (opcional)..."
                className="flex-1 h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
              {secretsStatus?.hasCustomGeminiKey && (
                <button
                  type="button"
                  onClick={() => onClearSecret('gemini')}
                  disabled={saving}
                  title="Remover chave Gemini customizada"
                  className="h-10 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* AI Mode & Limit */}
          <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="api-ai-mode" className="flex items-center gap-1.5 text-xs text-slate-300 mb-1">
                <Bot className="w-3.5 h-3.5 text-sky-400" />
                Motor da IA Inteligente
              </label>
              <select
                id="api-ai-mode"
                value={systemSettings.aiMode}
                onChange={(e) => onChange({ ...systemSettings, aiMode: e.target.value as AiMode })}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              >
                {AI_MODE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="api-ai-limit" className="flex items-center gap-1.5 text-xs text-slate-300 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Máx. Recomendações
              </label>
              <input
                id="api-ai-limit"
                type="number"
                min={4}
                max={24}
                value={systemSettings.aiMaxRecommendations}
                onChange={(e) =>
                  onChange({
                    ...systemSettings,
                    aiMaxRecommendations: Math.max(
                      4,
                      Math.min(24, Number(e.target.value) || 12)
                    ),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="h-11 px-6 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--ms-accent)' }}
        >
          {saving ? 'Salvando Fontes de API...' : 'Salvar Fontes de API'}
        </button>
      </div>
    </form>
  );
}
