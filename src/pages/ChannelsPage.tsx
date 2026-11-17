import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Play, Radio, ShieldAlert, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { detectStreamKind } from '../../shared/playerUrl';
import { toIsoTimestamp } from '../../shared/siteConfigUtils';
import type { ChannelCategory, LiveChannel } from '../../shared/types';
import { WatchaPlayer } from '../components/player/WatchaPlayer';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { db } from '../lib/firebase';
import { apiRequest } from '../services/apiClient';

const CATEGORIES: Array<'Todos' | ChannelCategory> = [
  'Todos',
  'Notícias',
  'Esportes',
  'Entretenimento',
  'Filmes',
  'Variedades',
  'Infantil',
];

export function ChannelsPage() {
  const { profile } = useAuth();
  const { siteConfig, playerBranding } = useSiteConfig();
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | ChannelCategory>('Todos');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [channelStreamError, setChannelStreamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q =
      selectedCategory === 'Todos'
        ? ''
        : `?category=${encodeURIComponent(selectedCategory)}`;

    Promise.allSettled([
      apiRequest<{ items: LiveChannel[] }>(`/api/channels${q}`),
      getDocs(query(collection(db, 'channels'), where('active', '==', true))),
    ])
      .then(([apiRes, fsRes]) => {
        if (cancelled) return;
        const map = new Map<string, LiveChannel>();

        if (apiRes.status === 'fulfilled') {
          for (const ch of apiRes.value.items) {
            map.set(ch.id, ch);
          }
        }
        if (fsRes.status === 'fulfilled') {
          for (const docSnap of fsRes.value.docs) {
            const data = docSnap.data();
            const ch: LiveChannel = {
              id: String(data.id || docSnap.id),
              name: String(data.name || ''),
              category: data.category as ChannelCategory,
              streamUrl: String(data.streamUrl || ''),
              logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
              description: typeof data.description === 'string' ? data.description : undefined,
              active: data.active !== false,
              createdAt: toIsoTimestamp(data.createdAt, new Date().toISOString()),
            };
            if (ch.name && ch.streamUrl) {
              map.set(ch.id, ch);
            }
          }
        }

        const merged = Array.from(map.values()).filter(
          (ch) => ch.active && (selectedCategory === 'Todos' || ch.category === selectedCategory)
        );
        setChannels(merged);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Live TV Header Banner */}
      <section
        className="relative rounded-3xl overflow-hidden min-h-[200px] sm:min-h-[240px] flex items-end border"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <img
          src="/src/assets/images/live_tv_broadcast_backdrop_1794602724810.jpg"
          alt="Canais ao Vivo MegaStream"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050814] via-[#050814]/80 to-transparent" />
        <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300">
            <Radio className="w-4 h-4" aria-hidden="true" />
            Transmissões Autorizadas
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
            Canais ao Vivo
          </h1>
          <p className="text-sm text-slate-300">
            Área dedicada a emissoras e transmissões oficiais cadastradas pela administração da plataforma.
          </p>
        </div>
      </section>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1" role="group" aria-label="Categorias de canais">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                isActive ? 'text-white ms-glow' : 'ms-glass text-slate-300 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: 'var(--ms-accent)' } : undefined}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Active Authorized Channel Player */}
      {activeChannel && (() => {
        const channelKind = detectStreamKind(activeChannel.streamUrl);
        const channelAccent = `#${playerBranding.colorHex || siteConfig.accentColorHex || '00a8ff'}`;
        return (
          <section className="ms-glass rounded-3xl overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--ms-border)' }}>
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  {activeChannel.name}
                </h2>
                <p className="text-xs text-slate-400">{activeChannel.category}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveChannel(null);
                  setChannelStreamError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
              >
                Fechar player
              </button>
            </div>
            <div className="aspect-video w-full bg-black relative">
              {channelStreamError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#050814]">
                  <p className="text-sm font-semibold text-white">{channelStreamError}</p>
                  <button
                    type="button"
                    onClick={() => setChannelStreamError(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: channelAccent }}
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : channelKind === 'hls' || channelKind === 'video' ? (
                <WatchaPlayer
                  key={activeChannel.id + ':' + activeChannel.streamUrl}
                  streamUrl={activeChannel.streamUrl}
                  streamKind={channelKind}
                  title={activeChannel.name}
                  subtitleMeta={activeChannel.category}
                  posterUrl={activeChannel.logoUrl}
                  accentColor={channelAccent}
                  preferredLang={playerBranding.preferredLang}
                  defaultAspectMode={playerBranding.defaultAspectMode}
                  allowTvCast={playerBranding.allowTvCast}
                  allowPipMode={playerBranding.allowPipMode}
                  allowTheaterMode={false}
                  onStreamError={(msg) => setChannelStreamError(msg)}
                />
              ) : (
                <iframe
                  src={activeChannel.streamUrl}
                  title={activeChannel.name}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </section>
        );
      })()}

      {/* Channel List / Authorized Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="ms-glass rounded-3xl p-8 sm:p-10 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-sky-400 mx-auto" aria-hidden="true" />
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="font-display text-lg font-bold text-white">
              Nenhum canal autorizado cadastrado nesta categoria
            </h2>
            <p className="text-sm text-slate-400">
              Por conformidade e direitos de transmissão, exibimos apenas emissoras e transmissões oficiais cadastradas pela equipe da plataforma.
            </p>
          </div>
          {profile?.role === 'admin' && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              Cadastrar Canal no Painel Admin
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <article
              key={ch.id}
              className="ms-glass rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-sky-400/50 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {ch.logoUrl ? (
                  <img
                    src={ch.logoUrl}
                    alt={ch.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-contain bg-black/40 p-1 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-sky-400 shrink-0">
                    <Tv className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-white truncate">
                    {ch.name}
                  </h3>
                  <p className="text-xs text-sky-300">{ch.category}</p>
                  {ch.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{ch.description}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setChannelStreamError(null);
                  setActiveChannel(ch);
                }}
                aria-label={`Assistir ${ch.name}`}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Assistir
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
