import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  FileText,
  Film,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sliders,
  Trash2,
  Tv,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  AdminDashboardStats,
  ChannelCategory,
  IntegrationStatus,
  LiveChannel,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerConfig,
  SystemLogEntry,
  UserProfile,
} from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'catalog'
  | 'channels'
  | 'players'
  | 'logs'
  | 'integrations';

export function AdminPage() {
  const { firebaseUser, profile, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Channel form
  const [chName, setChName] = useState('');
  const [chCategory, setChCategory] = useState<ChannelCategory>('Notícias');
  const [chUrl, setChUrl] = useState('');
  const [chDesc, setChDesc] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const [dash, userRes, chanRes, pCfg, logRes] = await Promise.all([
        apiRequest<{ stats: AdminDashboardStats; integrations: IntegrationStatus }>(
          '/api/admin/dashboard'
        ),
        apiRequest<{ items: UserProfile[] }>('/api/admin/users'),
        apiRequest<{ items: LiveChannel[] }>('/api/admin/channels'),
        apiRequest<PlayerConfig>('/api/player/config'),
        apiRequest<{ items: SystemLogEntry[] }>('/api/admin/logs'),
      ]);
      setStats(dash.stats);
      setIntegrations(dash.integrations);
      setUsers(userRes.items);
      setChannels(chanRes.items);
      setPlayerConfig(pCfg);
      setLogs(logRes.items);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Acesso restrito a administradores autenticados.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      void loadAdminData();
    } else {
      setLoading(false);
      // Still fetch public integration status for visibility
      apiRequest<IntegrationStatus>('/api/integrations/status')
        .then(setIntegrations)
        .catch(() => {});
    }
  }, [firebaseUser, loadAdminData]);

  const handleToggleBlock = async (u: UserProfile) => {
    const updated = await apiRequest<UserProfile>(`/api/admin/users/${u.uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked: !u.blocked }),
    });
    setUsers((prev) => prev.map((x) => (x.uid === updated.uid ? updated : x)));
    setActionMsg(`Conta de ${updated.email} ${updated.blocked ? 'bloqueada' : 'desbloqueada'}.`);
  };

  const handleRoleChange = async (u: UserProfile, role: 'user' | 'admin') => {
    const updated = await apiRequest<UserProfile>(`/api/admin/users/${u.uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((x) => (x.uid === updated.uid ? updated : x)));
    setActionMsg(`Permissão de ${updated.email} alterada para ${role}.`);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    try {
      const created = await apiRequest<LiveChannel>('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: chName,
          category: chCategory,
          streamUrl: chUrl,
          description: chDesc,
          active: true,
        }),
      });
      setChannels((prev) => [created, ...prev]);
      setChName('');
      setChUrl('');
      setChDesc('');
      setActionMsg(`Canal autorizado "${created.name}" cadastrado.`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Erro ao cadastrar canal.');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    await apiRequest(`/api/admin/channels/${id}`, { method: 'DELETE' });
    setChannels((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSyncCatalog = async () => {
    const res = await apiRequest<{ count: number; syncedAt: string; source: string }>(
      '/api/admin/catalog/sync',
      { method: 'POST' }
    );
    setActionMsg(`Catálogo sincronizado: ${res.count} títulos (${res.source}).`);
    await loadAdminData();
  };

  const handleClearCache = async () => {
    const res = await apiRequest<{ cleared: number }>('/api/admin/cache/clear', {
      method: 'POST',
    });
    setActionMsg(`Cache limpo: ${res.cleared} entradas removidas.`);
    await loadAdminData();
  };

  const handleSavePlayerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerConfig) return;
    const updated = await apiRequest<PlayerConfig>('/api/admin/player-config', {
      method: 'PUT',
      body: JSON.stringify(playerConfig),
    });
    setPlayerConfig(updated);
    setActionMsg('Configuração global do player MegaEmbed atualizada.');
  };

  // Unauthenticated or Unauthorized Backend Gate
  if (!firebaseUser || authError) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="ms-glass rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl mx-auto bg-sky-500/15 flex items-center justify-center text-sky-400">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">
            Painel Administrativo MegaStream
          </h1>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            {authError ||
              'Área restrita validada no servidor. Entre com uma conta administradora autorizada para gerenciar usuários, catálogo, canais e configurações.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!firebaseUser ? (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                Entrar com Google (Admin)
              </button>
            ) : (
              <Link
                to="/"
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                Voltar ao Início
              </Link>
            )}
          </div>
        </div>

        {integrations && (
          <div className="ms-glass rounded-3xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-white">
              Resumo Público de Integrações
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-black/30 flex justify-between">
                <span className="text-slate-400">TMDB API (TMDB_ACCESS_TOKEN)</span>
                <span className={integrations.tmdbConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                  {integrations.tmdbConfigured ? 'Conectado ao vivo' : 'Modo Demonstração'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 flex justify-between">
                <span className="text-slate-400">Gemini IA (Servidor)</span>
                <span className={integrations.geminiConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                  {integrations.geminiConfigured ? 'Configurado' : 'Pendente'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 flex justify-between">
                <span className="text-slate-400">Firebase Auth & Firestore</span>
                <span className="text-emerald-300">Provisionado</span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 flex justify-between">
                <span className="text-slate-400">MegaEmbed Player API</span>
                <span className="text-emerald-300">Configurável</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading || !stats) {
    return <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />;
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'catalog', label: 'Catálogo TMDB', icon: Film },
    { id: 'channels', label: 'Canais', icon: Tv },
    { id: 'players', label: 'Players', icon: Play },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'integrations', label: 'Integrações', icon: Layers },
  ];

  const maxUsage = Math.max(1, ...stats.usageSeries.map((d) => d.playbacks + d.searches));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300">
            <ShieldCheck className="w-4 h-4" />
            Administração ({profile?.email})
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
            Painel Administrativo
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void loadAdminData()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl ms-glass text-xs sm:text-sm font-medium text-white hover:bg-white/10 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar dados
        </button>
      </div>

      {actionMsg && (
        <div role="status" className="ms-glass rounded-xl px-4 py-2.5 text-xs sm:text-sm text-emerald-300">
          {actionMsg}
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                active ? 'text-white ms-glow' : 'ms-glass text-slate-300 hover:text-white'
              }`}
              style={active ? { backgroundColor: 'var(--ms-accent)' } : undefined}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="ms-glass rounded-2xl p-5">
              <p className="text-xs text-slate-400">Total de Usuários</p>
              <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                {stats.totalUsers}
              </p>
              <p className="text-xs text-sky-300 mt-1 font-mono-tabular">
                {stats.activeUsers} ativos
              </p>
            </div>
            <div className="ms-glass rounded-2xl p-5">
              <p className="text-xs text-slate-400">Catálogo Sincronizado</p>
              <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                {stats.catalogMovies + stats.catalogSeries}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono-tabular">
                {stats.catalogMovies} filmes · {stats.catalogSeries} séries
              </p>
            </div>
            <div className="ms-glass rounded-2xl p-5">
              <p className="text-xs text-slate-400">Reproduções Registradas</p>
              <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                {stats.totalPlaybacks}
              </p>
              <p className="text-xs text-slate-400 mt-1">Player MegaEmbed</p>
            </div>
            <div className="ms-glass rounded-2xl p-5">
              <p className="text-xs text-slate-400">Canais & Assinaturas</p>
              <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                {stats.channelsCount} / {stats.activeSubscriptions}
              </p>
              <p className="text-xs text-slate-400 mt-1">Canais / Assinaturas ativas</p>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="ms-glass rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">
              Visualizações e Buscas (Últimos 7 dias)
            </h2>
            <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
              {stats.usageSeries.map((day) => {
                const total = day.playbacks + day.searches;
                const heightPct = Math.max(12, Math.round((total / maxUsage) * 100));
                return (
                  <div key={day.label} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[11px] text-slate-400 font-mono-tabular">{total}</span>
                    <div
                      className="w-full max-w-[44px] rounded-t-xl transition-all"
                      style={{
                        height: `${heightPct}%`,
                        background:
                          'linear-gradient(180deg, var(--ms-accent-bright) 0%, var(--ms-accent) 100%)',
                      }}
                    />
                    <span className="text-xs text-slate-300">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: USERS */}
      {activeTab === 'users' && (
        <div className="ms-glass rounded-3xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-400" style={{ borderColor: 'var(--ms-border)' }}>
                <th className="p-4">Nome</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Permissão</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--ms-border)' }}>
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-white/5">
                  <td className="p-4 font-semibold text-white">{u.name}</td>
                  <td className="p-4 text-slate-300">{u.email}</td>
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        void handleRoleChange(u, e.target.value as 'user' | 'admin')
                      }
                      aria-label={`Permissão de ${u.email}`}
                      className="px-2.5 py-1 rounded-lg bg-black/40 border text-xs text-white"
                      style={{ borderColor: 'var(--ms-border)' }}
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="p-4 text-xs uppercase text-sky-300">{u.plan}</td>
                  <td className="p-4 text-xs">
                    {u.blocked ? (
                      <span className="text-red-300">Bloqueado</span>
                    ) : (
                      <span className="text-emerald-300">Ativo</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleToggleBlock(u)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
                    >
                      {u.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: CATALOG SYNC */}
      {activeTab === 'catalog' && (
        <div className="ms-glass rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-sky-400" />
                Importação Automática TMDB
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Última sincronização:{' '}
                {integrations?.lastSyncAt
                  ? new Date(integrations.lastSyncAt).toLocaleString('pt-BR')
                  : 'Automática ao iniciar'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleClearCache()}
                className="px-4 py-2.5 rounded-xl ms-glass text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                Limpar Cache ({integrations?.cacheEntries ?? 0})
              </button>
              <button
                type="button"
                onClick={() => void handleSyncCatalog()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                Sincronizar Filmes e Séries
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Todos os registros utilizam o <code className="text-sky-300">tmdbId</code> como chave única sem duplicação e sem apagar favoritos ou histórico dos usuários.
          </p>
        </div>
      )}

      {/* TAB: CHANNELS */}
      {activeTab === 'channels' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateChannel}
            className="lg:col-span-5 ms-glass rounded-3xl p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-white">
              Cadastrar Canal Autorizado
            </h2>
            <div>
              <label htmlFor="ch-name" className="block text-xs text-slate-300 mb-1">
                Nome da Emissora / Canal
              </label>
              <input
                id="ch-name"
                type="text"
                value={chName}
                onChange={(e) => setChName(e.target.value)}
                required
                placeholder="Ex: Canal Cultura Oficial"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>
            <div>
              <label htmlFor="ch-cat" className="block text-xs text-slate-300 mb-1">
                Categoria
              </label>
              <select
                id="ch-cat"
                value={chCategory}
                onChange={(e) => setChCategory(e.target.value as ChannelCategory)}
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <option value="Notícias">Notícias</option>
                <option value="Esportes">Esportes</option>
                <option value="Entretenimento">Entretenimento</option>
                <option value="Filmes">Filmes</option>
                <option value="Variedades">Variedades</option>
                <option value="Infantil">Infantil</option>
              </select>
            </div>
            <div>
              <label htmlFor="ch-url" className="block text-xs text-slate-300 mb-1">
                URL de Transmissão Autorizada (https://)
              </label>
              <input
                id="ch-url"
                type="url"
                value={chUrl}
                onChange={(e) => setChUrl(e.target.value)}
                required
                placeholder="https://..."
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>
            <div>
              <label htmlFor="ch-desc" className="block text-xs text-slate-300 mb-1">
                Descrição
              </label>
              <input
                id="ch-desc"
                type="text"
                value={chDesc}
                onChange={(e) => setChDesc(e.target.value)}
                placeholder="Programação ao vivo autorizada"
                className="w-full h-10 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              Salvar Canal Autorizado
            </button>
          </form>

          <div className="lg:col-span-7 ms-glass rounded-3xl p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-white">
              Canais Cadastrados ({channels.length})
            </h2>
            {channels.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum canal cadastrado ainda.</p>
            ) : (
              <div className="space-y-2.5">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-2xl bg-black/30 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{ch.name}</p>
                      <p className="text-xs text-sky-300">{ch.category}</p>
                      <p className="text-[11px] text-slate-400 truncate">{ch.streamUrl}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteChannel(ch.id)}
                      aria-label={`Remover canal ${ch.name}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PLAYERS */}
      {activeTab === 'players' && playerConfig && (
        <form onSubmit={handleSavePlayerConfig} className="ms-glass rounded-3xl p-6 space-y-5 max-w-2xl">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            Configuração Global do Player MegaEmbed
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="adm-domain" className="block text-xs text-slate-300 mb-1">
                Domínio Padrão
              </label>
              <select
                id="adm-domain"
                value={playerConfig.defaultDomain}
                onChange={(e) =>
                  setPlayerConfig({
                    ...playerConfig,
                    defaultDomain: e.target.value as MegaEmbedDomain,
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
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
                Player Padrão
              </label>
              <select
                id="adm-player"
                value={playerConfig.defaultPlayer}
                onChange={(e) =>
                  setPlayerConfig({
                    ...playerConfig,
                    defaultPlayer: e.target.value as MegaEmbedPlayer,
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                {playerConfig.availablePlayers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-color" className="block text-xs text-slate-300 mb-1">
                Cor Hex (#color:)
              </label>
              <input
                id="adm-color"
                type="text"
                value={playerConfig.defaultColorHex}
                onChange={(e) =>
                  setPlayerConfig({ ...playerConfig, defaultColorHex: e.target.value })
                }
                className="w-full h-10 px-3 rounded-xl bg-black/40 border text-sm text-white font-mono-tabular"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Salvar Configuração do Player
          </button>
        </form>
      )}

      {/* TAB: LOGS */}
      {activeTab === 'logs' && (
        <div className="ms-glass rounded-3xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-white">Logs do Sistema</h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto font-mono-tabular text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-black/35 flex flex-wrap gap-3 items-baseline">
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
            ))}
          </div>
        </div>
      )}

      {/* TAB: INTEGRATIONS */}
      {activeTab === 'integrations' && integrations && (
        <div className="ms-glass rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            Status das Integrações e Segurança
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-4 rounded-2xl bg-black/30 space-y-1">
              <p className="font-semibold text-white">TMDB API v3 (TMDB_ACCESS_TOKEN)</p>
              <p className={integrations.tmdbConfigured ? 'text-emerald-300 text-xs' : 'text-amber-300 text-xs'}>
                {integrations.tmdbConfigured
                  ? 'Configurado nos Secrets do servidor e ativo.'
                  : 'Pendente nos Secrets do servidor (Modo Demonstração ativo).'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/30 space-y-1">
              <p className="font-semibold text-white">Gemini AI SDK (GEMINI_API_KEY)</p>
              <p className={integrations.geminiConfigured ? 'text-emerald-300 text-xs' : 'text-amber-300 text-xs'}>
                {integrations.geminiConfigured
                  ? 'Ativo exclusivamente no servidor.'
                  : 'Pendente nos Secrets do ambiente.'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/30 space-y-1">
              <p className="font-semibold text-white">MegaEmbed Player API</p>
              <p className="text-emerald-300 text-xs">
                Configurável (mgeb.lat / mgeb.space · vidstack, megaplay, megatube, clappr).
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/30 space-y-1">
              <p className="font-semibold text-white">Firebase & Arquitetura PostgreSQL</p>
              <p className="text-emerald-300 text-xs">
                Firestore e Auth provisionados; esquema SQL pronto para migração.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
