import React from 'react';
import {
  Bookmark,
  ChevronRight,
  Crown,
  History,
  LogIn,
  LogOut,
  PlayCircle,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProfilePage() {
  const { firebaseUser, profile, activeProfile, openProfileGate, favorites, history, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="ms-glass rounded-3xl p-8 text-center space-y-5">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            <User className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-extrabold text-white">
              Área do Usuário MegaStream
            </h1>
            <p className="text-sm text-slate-300">
              Entre com sua conta para sincronizar seus perfis, Minha Lista, Histórico de Reprodução, Planos e Configurações na nuvem.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ms-glow"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              <LogIn className="w-4 h-4" />
              Entrar na Conta
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ms-glass hover:bg-white/10"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const planNames: Record<string, string> = {
    free: 'Plano Gratuito',
    monthly: 'Plano Mensal',
    quarterly: 'Plano Trimestral',
    annual: 'Plano Anual Premium',
  };

  const links = [
    {
      to: '/plans',
      label: 'Minha Conta e Assinatura',
      sub: planNames[profile?.plan ?? 'free'],
      icon: Crown,
    },
    {
      to: '/favorites',
      label: 'Minha Lista',
      sub: `${favorites.length} títulos salvos`,
      icon: Bookmark,
    },
    {
      to: '/history',
      label: 'Histórico e Continuar Assistindo',
      sub: `${history.length} reproduções recentes`,
      icon: History,
    },
    {
      to: '/settings',
      label: 'Configurações e Temas',
      sub: 'Aparência, idioma, qualidade e segurança',
      icon: Settings,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="ms-glass rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
        {firebaseUser.photoURL ? (
          <img
            src={firebaseUser.photoURL}
            alt={profile?.name || 'Avatar'}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover border-2 border-sky-400/60"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            {(profile?.name || firebaseUser.email || 'M')[0].toUpperCase()}
          </div>
        )}

        <div className="flex-1 text-center sm:text-left space-y-1">
          <h1 className="font-display text-2xl font-extrabold text-white">
            {profile?.name || firebaseUser.displayName || 'Usuário MegaStream'}
          </h1>
          <p className="text-sm text-slate-400">{firebaseUser.email}</p>
          <p className="text-xs font-semibold text-sky-300 pt-1">
            {planNames[profile?.plan ?? 'free']}
            {activeProfile ? ` · Perfil ativo: ${activeProfile.name}` : ''}
            {profile?.role === 'admin' ? ' · Administrador' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={openProfileGate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm font-semibold text-white hover:bg-white/15 cursor-pointer"
          >
            <Users className="w-4 h-4 text-sky-300" />
            Trocar Perfil
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-sm font-semibold text-red-200 hover:bg-red-500/25 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </section>

      <div className="ms-glass rounded-3xl divide-y" style={{ borderColor: 'var(--ms-border)' }}>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition-colors first:rounded-t-3xl last:rounded-b-3xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-sky-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </Link>
          );
        })}

        {profile?.role === 'admin' && (
          <Link
            to="/admin"
            className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition-colors rounded-b-3xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Painel Administrativo</p>
                <p className="text-xs text-slate-400">Usuários, catálogo, canais, logs e integrações</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </Link>
        )}
      </div>

      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Continuar Assistindo</h2>
            <Link to="/history" className="text-xs text-sky-400 hover:underline">
              Ver histórico completo
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.slice(0, 4).map((h) => (
              <Link
                key={h.id}
                to={`/watch/${h.mediaType}/${h.tmdbId}${
                  h.seasonNumber ? `?season=${h.seasonNumber}&episode=${h.episodeNumber || 1}` : ''
                }`}
                className="ms-glass rounded-2xl p-3.5 flex items-center gap-3 hover:border-sky-400/50 transition-colors"
              >
                <PlayCircle className="w-9 h-9 text-sky-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{h.title}</p>
                  <p className="text-xs text-slate-400 font-mono-tabular">
                    Progresso: {Math.round(h.progressPercent)}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
