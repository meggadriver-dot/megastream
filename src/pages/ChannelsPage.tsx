import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  Play,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Tv,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toIsoTimestamp } from '../../shared/siteConfigUtils';
import type {
  ChannelCategory,
  LiveEventCard,
  LiveGameCard,
  LiveHubChannel,
  LiveHubResponse,
  LivePlayResolution,
} from '../../shared/types';
import { WatchaPlayer } from '../components/player/WatchaPlayer';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { db } from '../lib/firebase';
import { apiRequest } from '../services/apiClient';

type LiveSectionTab = 'channels' | 'games' | 'events';

interface SelectedLiveItem {
  id: string;
  kind: 'channel' | 'game' | 'event';
  slug?: string;
  title: string;
  subtitleMeta: string;
  posterUrl?: string | null;
  playerUrls: string[];
  activePlayerIndex: number;
}

const DEFAULT_CATEGORIES: Array<'Todos' | ChannelCategory> = [
  'Todos',
  'Esportes',
  'Notícias',
  'Entretenimento',
  'Filmes',
  'Variedades',
  'Infantil',
];

function formatLiveTimeLabel(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ms = /^\d{10}$/.test(trimmed)
    ? Number(trimmed) * 1000
    : /^\d{13}$/.test(trimmed)
      ? Number(trimmed)
      : Date.parse(trimmed);
  if (Number.isFinite(ms)) {
    const dt = new Date(ms);
    const now = new Date();
    const sameDay =
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate();
    const timeStr = dt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (sameDay) return timeStr;
    const dateStr = dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${dateStr} · ${timeStr}`;
  }
  return trimmed;
}

function SafeLogoImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ChannelsPage() {
  const { profile } = useAuth();
  const { siteConfig, playerBranding } = useSiteConfig();

  const [activeTab, setActiveTab] = useState<LiveSectionTab>('channels');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedSport, setSelectedSport] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [channels, setChannels] = useState<LiveHubChannel[]>([]);
  const [games, setGames] = useState<LiveGameCard[]>([]);
  const [events, setEvents] = useState<LiveEventCard[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<SelectedLiveItem | null>(null);
  const [activeResolution, setActiveResolution] = useState<LivePlayResolution | null>(null);
  const [resolvingStream, setResolvingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let warmupTimer: number | null = null;

    const loadHub = async (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      try {
        const [hubRes, fsRes] = await Promise.allSettled([
          apiRequest<LiveHubResponse>('/api/live/hub'),
          getDocs(query(collection(db, 'channels'), where('active', '==', true))),
        ]);
        if (cancelled) return;

        const adminMap = new Map<string, LiveHubChannel>();
        if (fsRes.status === 'fulfilled') {
          for (const docSnap of fsRes.value.docs) {
            const data = docSnap.data();
            const rawStreamUrl = String(data.streamUrl || '').trim();
            const isDirect =
              /\.m3u8(?:$|\?)|\.(?:mp4|m4v|webm|mkv|ts)(?:$|\?)/i.test(rawStreamUrl) ||
              /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(rawStreamUrl);
            if (!isDirect) continue;

            const ch: LiveHubChannel = {
              id: String(data.id || docSnap.id),
              name: String(data.name || ''),
              category: (data.category as ChannelCategory) || 'Entretenimento',
              streamUrl: rawStreamUrl,
              logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
              description: typeof data.description === 'string' ? data.description : undefined,
              active: data.active !== false,
              createdAt: toIsoTimestamp(data.createdAt, new Date().toISOString()),
              source: 'admin',
              isDirectStream: true,
              directStreamUrl: rawStreamUrl,
            };
            if (ch.name && ch.streamUrl) {
              adminMap.set(ch.id, ch);
            }
          }
        }

        const mergedChannels: LiveHubChannel[] = [];
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();

        for (const ch of adminMap.values()) {
          seenIds.add(ch.id);
          seenNames.add(ch.name.trim().toLowerCase());
          mergedChannels.push(ch);
        }

        if (hubRes.status === 'fulfilled') {
          for (const ch of hubRes.value.channels) {
            if (ch.source === 'streambetter' || ch.isDirectStream === false) continue;
            const nameKey = ch.name.trim().toLowerCase();
            if (seenIds.has(ch.id) || seenNames.has(nameKey)) continue;
            seenIds.add(ch.id);
            seenNames.add(nameKey);
            mergedChannels.push(ch);
          }
          setGames(hubRes.value.games ?? []);
          setEvents(hubRes.value.events ?? []);
          setSports(hubRes.value.sports ?? []);
        }

        setChannels(mergedChannels.filter((c) => c.active !== false));

        if (isInitial) {
          warmupTimer = window.setTimeout(() => {
            if (!cancelled) void loadHub(false);
          }, 4500);
        }
      } finally {
        if (isInitial && !cancelled) setLoading(false);
      }
    };

    void loadHub(true);

    return () => {
      cancelled = true;
      if (warmupTimer !== null) window.clearTimeout(warmupTimer);
    };
  }, []);

  const resolveAndPlay = useCallback(async (item: SelectedLiveItem, playerIdx = 0) => {
    const targetUrl = item.playerUrls[playerIdx] || item.playerUrls[0] || '';
    const updatedItem: SelectedLiveItem = { ...item, activePlayerIndex: playerIdx };
    setSelectedItem(updatedItem);
    setResolvingStream(true);
    setStreamError(null);
    setActiveResolution(null);

    try {
      const qs = new URLSearchParams();
      qs.set('id', item.id);
      qs.set('kind', item.kind);
      qs.set('title', item.title);
      if (item.slug) qs.set('slug', item.slug);
      if (targetUrl) qs.set('url', targetUrl);

      const res = await apiRequest<LivePlayResolution>(`/api/live/resolve?${qs.toString()}`);
      setActiveResolution(res);
    } catch (err) {
      setStreamError(
        err instanceof Error ? err.message : 'Não foi possível carregar esta transmissão agora.'
      );
    } finally {
      setResolvingStream(false);
    }
  }, []);

  const categoryButtons = useMemo(() => {
    const dynamic = Array.from(new Set(channels.map((c) => c.category).filter(Boolean)));
    const ordered = DEFAULT_CATEGORIES.filter((c) => c === 'Todos' || dynamic.includes(c));
    for (const cat of dynamic) {
      if (!ordered.includes(cat)) ordered.push(cat);
    }
    return ordered.length > 1 ? ordered : DEFAULT_CATEGORIES;
  }, [channels]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (selectedCategory !== 'Todos' && ch.category !== selectedCategory) return false;
      if (!normalizedQuery) return true;
      return (
        ch.name.toLowerCase().includes(normalizedQuery) ||
        ch.category.toLowerCase().includes(normalizedQuery) ||
        (ch.nowPlaying?.title || '').toLowerCase().includes(normalizedQuery) ||
        (ch.description || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [channels, selectedCategory, normalizedQuery]);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedSport !== 'Todos' && g.sport !== selectedSport) return false;
      if (!normalizedQuery) return true;
      return (
        g.title.toLowerCase().includes(normalizedQuery) ||
        g.sport.toLowerCase().includes(normalizedQuery) ||
        (g.league || '').toLowerCase().includes(normalizedQuery) ||
        (g.homeTeam?.name || '').toLowerCase().includes(normalizedQuery) ||
        (g.awayTeam?.name || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [games, selectedSport, normalizedQuery]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!normalizedQuery) return true;
      return (
        ev.title.toLowerCase().includes(normalizedQuery) ||
        ev.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [events, normalizedQuery]);

  const playerAccent = `#${playerBranding.colorHex || siteConfig.accentColorHex || '00a8ff'}`;

  return (
    <div className="space-y-6">
      {/* Live TV Header Banner */}
      <section
        className="relative rounded-3xl overflow-hidden min-h-[200px] sm:min-h-[240px] flex items-end border"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <img
          src="/src/assets/images/live_tv_broadcast_backdrop_1794602724810.jpg"
          alt="Transmissões ao Vivo MegaStream"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050814] via-[#050814]/85 to-transparent" />
        <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300">
            <Radio className="w-4 h-4" aria-hidden="true" />
            Programação & Transmissões em Tempo Real
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
            TV ao Vivo, Jogos & Eventos
          </h1>
          <p className="text-sm text-slate-300">
            Todos os canais são reproduzidos diretamente no player, sem anúncios, com guia de programação atualizado e partidas ao vivo.
          </p>
        </div>
      </section>

      {/* Section Tabs + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1"
          role="tablist"
          aria-label="Seções de transmissão ao vivo"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'channels'}
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 transition-colors ${
              activeTab === 'channels'
                ? 'text-white ms-glow'
                : 'ms-glass text-slate-300 hover:text-white'
            }`}
            style={activeTab === 'channels' ? { backgroundColor: 'var(--ms-accent)' } : undefined}
          >
            <Tv className="w-4 h-4" aria-hidden="true" />
            Canais Ao Vivo ({channels.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'games'}
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 transition-colors ${
              activeTab === 'games'
                ? 'text-white ms-glow'
                : 'ms-glass text-slate-300 hover:text-white'
            }`}
            style={activeTab === 'games' ? { backgroundColor: 'var(--ms-accent)' } : undefined}
          >
            <Trophy className="w-4 h-4" aria-hidden="true" />
            Jogos Ao Vivo ({games.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'events'}
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 transition-colors ${
              activeTab === 'events'
                ? 'text-white ms-glow'
                : 'ms-glass text-slate-300 hover:text-white'
            }`}
            style={activeTab === 'events' ? { backgroundColor: 'var(--ms-accent)' } : undefined}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Eventos ({events.length})
          </button>
        </div>

        <div className="relative w-full lg:w-80">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar canais, jogos ou eventos"
            placeholder="Buscar canal, jogo ou evento..."
            className="w-full h-10 pl-10 pr-8 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      {activeTab === 'channels' && (
        <div
          className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1"
          role="group"
          aria-label="Categorias de canais"
        >
          {categoryButtons.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive ? 'text-white' : 'ms-glass text-slate-300 hover:text-white'
                }`}
                style={isActive ? { backgroundColor: 'var(--ms-accent)' } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'games' && sports.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto ms-scrollbar-hide pb-1"
          role="group"
          aria-label="Modalidades esportivas"
        >
          {['Todos', ...sports].map((sp) => {
            const isActive = selectedSport === sp;
            return (
              <button
                key={sp}
                type="button"
                onClick={() => setSelectedSport(sp)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive ? 'text-white' : 'ms-glass text-slate-300 hover:text-white'
                }`}
                style={isActive ? { backgroundColor: 'var(--ms-accent)' } : undefined}
              >
                {sp}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Live Player Panel */}
      {selectedItem && (
        <section className="ms-glass rounded-3xl overflow-hidden" aria-label="Player ao vivo ativo">
          <div
            className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <h2 className="font-display text-base font-bold text-white truncate">
                  {selectedItem.title}
                </h2>
                {activeResolution?.resolvedFromApi &&
                  (activeResolution.streamKind === 'hls' ||
                    activeResolution.streamKind === 'video') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      Direto · Sem anúncios
                    </span>
                  )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{selectedItem.subtitleMeta}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedItem.playerUrls.length > 1 && (
                <div className="flex items-center gap-1.5" role="group" aria-label="Sinais disponíveis">
                  {selectedItem.playerUrls.map((_u, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void resolveAndPlay(selectedItem, idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        selectedItem.activePlayerIndex === idx
                          ? 'text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                      style={
                        selectedItem.activePlayerIndex === idx
                          ? { backgroundColor: playerAccent }
                          : undefined
                      }
                    >
                      Sinal {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  setActiveResolution(null);
                  setStreamError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
              >
                Fechar player
              </button>
            </div>
          </div>

          <div className="aspect-video w-full bg-black relative">
            {resolvingStream ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050814]">
                <div className="w-10 h-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-xs sm:text-sm text-slate-300">
                  Preparando transmissão ao vivo...
                </p>
              </div>
            ) : streamError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#050814]">
                <p className="text-sm font-semibold text-white">{streamError}</p>
                <button
                  type="button"
                  onClick={() => void resolveAndPlay(selectedItem, selectedItem.activePlayerIndex)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: playerAccent }}
                >
                  Tentar Novamente
                </button>
              </div>
            ) : activeResolution ? (
              activeResolution.streamKind === 'hls' || activeResolution.streamKind === 'video' ? (
                <WatchaPlayer
                  key={`${activeResolution.id}:${activeResolution.streamUrl}`}
                  streamUrl={activeResolution.streamUrl}
                  streamKind={activeResolution.streamKind}
                  title={selectedItem.title}
                  subtitleMeta={selectedItem.subtitleMeta}
                  posterUrl={selectedItem.posterUrl}
                  accentColor={playerAccent}
                  audioOptions={activeResolution.audioOptions}
                  subtitles={activeResolution.subtitles}
                  preferredLang={playerBranding.preferredLang}
                  defaultAspectMode={playerBranding.defaultAspectMode}
                  allowTvCast={playerBranding.allowTvCast}
                  allowPipMode={playerBranding.allowPipMode}
                  allowTheaterMode={false}
                  onStreamError={(msg) => {
                    const nextIdx = selectedItem.activePlayerIndex + 1;
                    if (nextIdx < selectedItem.playerUrls.length) {
                      void resolveAndPlay(selectedItem, nextIdx);
                      return;
                    }
                    setStreamError(msg);
                  }}
                />
              ) : selectedItem.kind === 'channel' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#050814]">
                  <p className="text-sm font-semibold text-white">
                    Este canal não possui transmissão direta sem anúncios disponível no momento.
                  </p>
                </div>
              ) : (
                <iframe
                  key={`${activeResolution.id}:${activeResolution.streamUrl}`}
                  src={activeResolution.streamUrl}
                  title={selectedItem.title}
                  className="w-full h-full border-0"
                  sandbox={
                    activeResolution.sandboxPolicy === 'none'
                      ? undefined
                      : 'allow-scripts allow-same-origin allow-forms allow-presentation'
                  }
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy={activeResolution.referrerPolicy}
                />
              )
            ) : null}
          </div>
        </section>
      )}

      {/* Main Content Grids */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-36 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : activeTab === 'channels' ? (
        filteredChannels.length === 0 ? (
          <div className="ms-glass rounded-3xl p-8 sm:p-10 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-sky-400 mx-auto" aria-hidden="true" />
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h2 className="font-display text-lg font-bold text-white">
                Nenhum canal encontrado neste filtro
              </h2>
              <p className="text-sm text-slate-400">
                Tente selecionar outra categoria ou limpar o campo de busca para visualizar todos os canais disponíveis.
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
            {filteredChannels.map((ch) => (
              <article
                key={ch.id}
                className="ms-glass rounded-2xl p-4 flex flex-col justify-between gap-3.5 hover:border-sky-400/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <SafeLogoImage
                      src={ch.logoUrl}
                      alt={ch.name}
                      className="w-12 h-12 rounded-xl object-contain bg-white/5 border border-white/10 p-1.5 shrink-0"
                      fallback={
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                          <Tv className="w-6 h-6" />
                        </div>
                      }
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {ch.name}
                      </h3>
                      <p className="text-xs text-sky-300 truncate">
                        {ch.category}
                        {ch.isDirectStream && (
                          <span className="text-emerald-300 font-semibold"> · Direto HD</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const playerUrls = Array.from(
                        new Set(
                          [
                            ch.directStreamUrl || ch.streamUrl,
                            ...(ch.backupDirectUrls ?? []),
                            ch.streamUrl,
                          ].filter((u): u is string => Boolean(u && u.trim()))
                        )
                      );
                      void resolveAndPlay({
                        id: ch.id,
                        kind: 'channel',
                        slug: ch.slug,
                        title: ch.name,
                        subtitleMeta: ch.nowPlaying?.title
                          ? `${ch.category} · Agora: ${ch.nowPlaying.title}`
                          : ch.category,
                        posterUrl: ch.logoUrl,
                        playerUrls,
                        activePlayerIndex: 0,
                      });
                    }}
                    aria-label={`Assistir ${ch.name}`}
                    className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                    style={{ backgroundColor: 'var(--ms-accent)' }}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Assistir
                  </button>
                </div>

                {/* Live EPG Strip */}
                {(ch.nowPlaying || ch.nextProgram || ch.description) && (
                  <div className="pt-2.5 border-t border-white/10 space-y-1 text-xs">
                    {ch.nowPlaying ? (
                      <p className="text-slate-200 truncate flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] uppercase shrink-0">
                          Agora
                        </span>
                        <span className="truncate">{ch.nowPlaying.title}</span>
                      </p>
                    ) : ch.description ? (
                      <p className="text-slate-400 truncate">{ch.description}</p>
                    ) : null}

                    {ch.nextProgram && (
                      <p className="text-slate-400 truncate flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          A seguir: {ch.nextProgram.title}
                          {formatLiveTimeLabel(ch.nextProgram.startAt)
                            ? ` (${formatLiveTimeLabel(ch.nextProgram.startAt)})`
                            : ''}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      ) : activeTab === 'games' ? (
        filteredGames.length === 0 ? (
          <div className="ms-glass rounded-3xl p-8 sm:p-10 text-center space-y-2">
            <Trophy className="w-10 h-10 text-sky-400 mx-auto" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-white">
              Nenhum jogo disponível neste filtro
            </h2>
            <p className="text-sm text-slate-400">
              Novas partidas esportivas aparecem automaticamente conforme a agenda do dia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((game) => {
              const startLabel = formatLiveTimeLabel(game.startTime);
              return (
                <article
                  key={game.id}
                  className="ms-glass rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-sky-400/50 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-sky-300 truncate">
                        {game.sport}
                        {game.league ? ` · ${game.league}` : ''}
                      </span>
                      {startLabel && (
                        <span className="text-slate-400 font-mono-tabular shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {startLabel}
                        </span>
                      )}
                    </div>

                    {game.homeTeam && game.awayTeam ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <SafeLogoImage
                            src={game.homeTeam.image}
                            alt={game.homeTeam.name}
                            className="w-8 h-8 rounded-lg object-contain bg-white/5 border border-white/10 p-0.5 shrink-0"
                            fallback={
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                                <Trophy className="w-4 h-4" />
                              </div>
                            }
                          />
                          <span className="text-sm font-bold text-white truncate">
                            {game.homeTeam.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 px-1 shrink-0">vs</span>
                        <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                          <span className="text-sm font-bold text-white truncate">
                            {game.awayTeam.name}
                          </span>
                          <SafeLogoImage
                            src={game.awayTeam.image}
                            alt={game.awayTeam.name}
                            className="w-8 h-8 rounded-lg object-contain bg-white/5 border border-white/10 p-0.5 shrink-0"
                            fallback={
                              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                                <Trophy className="w-4 h-4" />
                              </div>
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <h3 className="font-display text-base font-bold text-white line-clamp-2">
                        {game.title}
                      </h3>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <span className="text-[11px] text-slate-400">
                      {game.players.length > 1
                        ? `${game.players.length} sinais disponíveis`
                        : 'Transmissão direta'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void resolveAndPlay({
                          id: game.id,
                          kind: 'game',
                          slug: game.slug,
                          title: game.title,
                          subtitleMeta: game.league
                            ? `${game.sport} · ${game.league}`
                            : game.sport,
                          posterUrl: game.homeTeam?.image || game.awayTeam?.image || null,
                          playerUrls: game.players.length > 0 ? game.players : [game.primaryUrl],
                          activePlayerIndex: 0,
                        })
                      }
                      aria-label={`Assistir ${game.title}`}
                      className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                      style={{ backgroundColor: 'var(--ms-accent)' }}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Assistir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : filteredEvents.length === 0 ? (
        <div className="ms-glass rounded-3xl p-8 sm:p-10 text-center space-y-2">
          <Calendar className="w-10 h-10 text-sky-400 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-white">
            Nenhum evento especial encontrado
          </h2>
          <p className="text-sm text-slate-400">
            Eventos ao vivo adicionais aparecem aqui assim que estiverem programados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const startLabel = formatLiveTimeLabel(ev.startTime);
            return (
              <article
                key={ev.id}
                className="ms-glass rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-sky-400/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <SafeLogoImage
                    src={ev.image}
                    alt={ev.title}
                    className="w-14 h-14 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0"
                    fallback={
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                        <Sparkles className="w-6 h-6" />
                      </div>
                    }
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-sm sm:text-base font-bold text-white truncate">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-sky-300 truncate">{ev.category}</p>
                    {startLabel && (
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {startLabel}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void resolveAndPlay({
                      id: ev.id,
                      kind: 'event',
                      slug: ev.slug,
                      title: ev.title,
                      subtitleMeta: ev.category,
                      posterUrl: ev.image,
                      playerUrls: ev.players.length > 0 ? ev.players : [ev.primaryUrl],
                      activePlayerIndex: 0,
                    })
                  }
                  aria-label={`Assistir ${ev.title}`}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                  style={{ backgroundColor: 'var(--ms-accent)' }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Assistir
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
