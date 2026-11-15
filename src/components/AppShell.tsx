import React, { useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Bot,
  Compass,
  Crown,
  History,
  Home,
  LogIn,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Tv,
  User,
  X,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { resolveProfileAvatarUrl } from '../data/avatarPresets';
import { Logo } from './Logo';

interface AppShellProps {
  children: React.ReactNode;
  hideChrome?: boolean;
}

export function AppShell({ children, hideChrome = false }: AppShellProps) {
  const { firebaseUser, profile, activeProfile, openProfileGate } = useAuth();
  const { siteConfig, runtimeSettings } = useSiteConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();

  if (hideChrome) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) {
      navigate('/explore');
      return;
    }
    setMobileSearchOpen(false);
    navigate(`/explore?q=${encodeURIComponent(q)}`);
  };

  const isAdmin =
    profile?.role === 'admin' ||
    firebaseUser?.email?.toLowerCase() === 'meggadriver@gmail.com';

  const desktopNavItems = [
    { to: '/', label: 'Início', icon: Home },
    { to: '/explore', label: 'Explorar', icon: Compass },
    { to: '/favorites', label: 'Minha Lista', icon: Bookmark },
    { to: '/history', label: 'Histórico', icon: History },
    ...(siteConfig.enableChannels ? [{ to: '/channels', label: 'Canais', icon: Tv }] : []),
    ...(siteConfig.enableAiPage ? [{ to: '/ai', label: 'IA Inteligente', icon: Bot }] : []),
    ...(siteConfig.enablePlansPage ? [{ to: '/plans', label: 'Planos', icon: Crown }] : []),
    { to: '/profile', label: 'Perfil', icon: User },
    { to: '/settings', label: 'Configurações', icon: Settings },
  ];

  const mobileBottomTabs = [
    { to: '/', label: 'Início', icon: Home },
    { to: '/explore', label: 'Explorar', icon: Compass },
    { to: '/favorites', label: 'Minha Lista', icon: Bookmark },
    ...(siteConfig.enableChannels
      ? [{ to: '/channels', label: 'Canais', icon: Tv }]
      : [{ to: '/history', label: 'Histórico', icon: History }]),
    { to: '/profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative" style={{ backgroundColor: 'var(--ms-bg)' }}>
      {/* Ambient Radial Lighting */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at 18% 8%, var(--ms-accent-glow) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(0, 212, 255, 0.12) 0%, transparent 40%)',
        }}
        aria-hidden="true"
      />

      {/* Desktop Left Glassmorphic Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-60 lg:w-64 md:fixed md:inset-y-0 md:left-0 z-30 ms-glass border-r"
        aria-label="Navegação principal"
      >
        <div className="h-16 px-5 flex items-center border-b" style={{ borderColor: 'var(--ms-border)' }}>
          <Link to="/" className="focus-visible:outline-2 focus-visible:outline-blue-400 rounded-lg">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-white ms-glow'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: 'var(--ms-accent)' } : undefined
                }
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {isAdmin && (
            <div className="pt-3 mt-3 border-t" style={{ borderColor: 'var(--ms-border)' }}>
              <NavLink
                to="/admin"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-sky-300 hover:text-white hover:bg-white/5"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Painel Admin</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="p-4 border-t text-xs text-slate-400" style={{ borderColor: 'var(--ms-border)' }}>
          <p className="font-semibold text-slate-200 truncate">{siteConfig.siteName}</p>
          <p className="mt-0.5 line-clamp-2">{siteConfig.footerText || siteConfig.siteSlogan}</p>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 w-full md:pl-60 lg:pl-64 flex flex-col min-h-screen relative z-10 pb-20 md:pb-0">
        {/* Top Bar */}
        <header
          className="sticky top-0 z-20 h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 ms-glass border-b"
          style={{ borderColor: 'var(--ms-border)' }}
        >
          <div className="flex items-center gap-3 md:hidden shrink-0">
            <Link to="/" aria-label="Ir para o início">
              <Logo />
            </Link>
          </div>

          {/* Search Input (Desktop & Tablet) */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden sm:flex items-center flex-1 max-w-md relative"
            role="search"
          >
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar filmes, séries..."
              aria-label="Buscar filmes e séries"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-black/35 border text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              style={{ borderColor: 'var(--ms-border)' }}
            />
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Abrir pesquisa"
              className="sm:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 cursor-pointer"
            >
              {mobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {siteConfig.enableAiPage && (
              <Link
                to="/ai"
                className="hidden lg:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-sky-200 hover:text-white border transition-colors whitespace-nowrap shrink-0"
                style={{ borderColor: 'var(--ms-border)', backgroundColor: 'rgba(29, 99, 255, 0.14)' }}
              >
                <Bot className="w-4 h-4 text-sky-400" aria-hidden="true" />
                IA Inteligente
              </Link>
            )}

            {firebaseUser && activeProfile && (
              <button
                type="button"
                onClick={openProfileGate}
                aria-label={`Trocar perfil ativo (${activeProfile.name})`}
                className="inline-flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl ms-glass hover:bg-white/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <img
                  src={resolveProfileAvatarUrl(activeProfile.avatarId, activeProfile.avatarUrl)}
                  alt={activeProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-cover border border-sky-400/60"
                />
                <span className="hidden sm:inline text-xs sm:text-sm font-medium text-white max-w-[110px] truncate">
                  {activeProfile.name}
                </span>
              </button>
            )}

            {firebaseUser ? (
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={profile?.name || 'Perfil'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-sky-400/50"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: 'var(--ms-accent)' }}
                  >
                    {(profile?.name || firebaseUser.email || 'M')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden lg:inline text-sm font-medium text-white max-w-[120px] truncate">
                  {profile?.name || firebaseUser.displayName || 'Minha Conta'}
                </span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-95"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                Entrar
              </Link>
            )}
          </div>
        </header>

        {/* Expandable Mobile Search Strip */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 py-2.5 ms-glass border-b" style={{ borderColor: 'var(--ms-border)' }}>
            <form onSubmit={handleSearchSubmit} className="flex gap-2" role="search">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar filmes ou séries..."
                aria-label="Pesquisar no catálogo"
                className="flex-1 h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-400"
                style={{ borderColor: 'var(--ms-border)' }}
                autoFocus
              />
              <button
                type="submit"
                className="px-4 h-11 rounded-xl text-sm font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                Buscar
              </button>
            </form>
          </div>
        )}

        {/* Admin Announcement or Maintenance Banner */}
        {siteConfig.maintenanceMode && !isAdmin && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4 max-w-[1440px] w-full mx-auto">
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{runtimeSettings.maintenanceMessage}</span>
            </div>
          </div>
        )}

        {siteConfig.announcementEnabled && siteConfig.announcementText && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4 max-w-[1440px] w-full mx-auto">
            <div
              className="rounded-xl border px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-sky-100"
              style={{
                borderColor: 'var(--ms-border)',
                backgroundColor: 'rgba(29, 99, 255, 0.14)',
              }}
            >
              <Megaphone className="w-4 h-4 shrink-0" style={{ color: 'var(--ms-accent-bright)' }} />
              <span>{siteConfig.announcementText}</span>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 ms-glass border-t grid grid-cols-5 items-center"
        style={{ borderColor: 'var(--ms-border)' }}
        aria-label="Menu inferior mobile"
      >
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                  isActive ? 'text-sky-300' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span className="truncate max-w-[68px]">{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
