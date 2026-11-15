import React, { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  Check,
  Database,
  Edit3,
  ExternalLink,
  FileText,
  Film,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Palette,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_PLAYER_CONFIG } from '../../shared/playerUrl';
import {
  DEFAULT_SITE_CONFIG,
  sanitizeCustomMediaInput,
  sanitizeSiteConfig,
  toIsoTimestamp,
} from '../../shared/siteConfigUtils';
import {
  DEFAULT_SYSTEM_SETTINGS,
  extractPublicRuntimeSettings,
  sanitizeSystemSettings,
} from '../../shared/systemSettingsUtils';
import type {
  AdminDashboardStats,
  AdminSecretsStatus,
  AdminSystemSettingsResponse,
  AdminTab,
  ChannelCategory,
  CustomMediaItem,
  DiagnosticResult,
  IntegrationStatus,
  LiveChannel,
  MediaType,
  PlanId,
  PlayerConfig,
  SiteConfig,
  SystemLogEntry,
  SystemSettings,
  ThemeId,
  UserProfile,
} from '../../shared/types';
import { AdminApiSourcesTab } from '../components/admin/AdminApiSourcesTab';
import { AdminDiagnosticsTab } from '../components/admin/AdminDiagnosticsTab';
import { AdminPlayerTab } from '../components/admin/AdminPlayerTab';
import { AdminPoliciesPanel } from '../components/admin/AdminPoliciesPanel';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../lib/firebase';
import { apiRequest } from '../services/apiClient';

interface NavGroup {
  group: string;
  items: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    group: 'Visão Geral',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: Activity }],
  },
  {
    group: 'Site & Aparência',
    items: [{ id: 'site', label: 'Personalizar Site', icon: Palette }],
  },
  {
    group: 'APIs & Fontes',
    items: [
      { id: 'apis', label: 'Fontes de API', icon: KeyRound },
      { id: 'players', label: 'Players & Embed', icon: Play },
    ],
  },
  {
    group: 'Conteúdo',
    items: [
      { id: 'catalog', label: 'Catálogo & Mídias', icon: Film },
      { id: 'channels', label: 'Canais Ao Vivo', icon: Tv },
    ],
  },
  {
    group: 'Acesso & Sistema',
    items: [
      { id: 'users', label: 'Usuários & Políticas', icon: Users },
      { id: 'logs', label: 'Logs & Diagnósticos', icon: FileText },
    ],
  },
];

const TAB_TITLES: Record<AdminTab, string> = {
  dashboard: 'Dashboard Geral',
  site: 'Personalização do Site',
  apis: 'Fontes de API, Catálogo e IA',
  players: 'Players, Fontes e Embed',
  catalog: 'Catálogo & Mídias',
  channels: 'Canais Ao Vivo',
  users: 'Usuários, Planos & Políticas',
  logs: 'Logs, Integrações & Diagnósticos',
};

export function AdminPage() {
  const { firebaseUser, profile, signInWithGoogle, logout } = useAuth();
  const { siteConfig, applySiteConfig, applyRuntimeSettings } = useSiteConfig();
  const { themes } = useTheme();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [customCatalog, setCustomCatalog] = useState<CustomMediaItem[]>([]);
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [secretsStatus, setSecretsStatus] = useState<AdminSecretsStatus | null>(null);
  const [tmdbTokenInput, setTmdbTokenInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [siteDraft, setSiteDraft] = useState<SiteConfig>(siteConfig);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<
    Partial<Record<'tmdb' | 'player' | 'firestore', DiagnosticResult>>
  >({});
  const [testingTarget, setTestingTarget] = useState<'tmdb' | 'player' | 'firestore' | null>(null);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // User search
  const [userSearch, setUserSearch] = useState('');

  // Channel form (create or edit)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [chName, setChName] = useState('');
  const [chCategory, setChCategory] = useState<ChannelCategory>('Notícias');
  const [chUrl, setChUrl] = useState('');
  const [chLogo, setChLogo] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chActive, setChActive] = useState(true);

  // Custom Media form (create or edit)
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [mediaTmdbId, setMediaTmdbId] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaOriginalTitle, setMediaOriginalTitle] = useState('');
  const [mediaYear, setMediaYear] = useState(String(new Date().getFullYear()));
  const [mediaVote, setMediaVote] = useState('8.5');
  const [mediaPoster, setMediaPoster] = useState('');
  const [mediaBackdrop, setMediaBackdrop] = useState('');
  const [mediaOverview, setMediaOverview] = useState('');
  const [mediaStreamUrl, setMediaStreamUrl] = useState('');
  const [mediaFeatured, setMediaFeatured] = useState(false);
  const [mediaActive, setMediaActive] = useState(true);

  const showFeedback = (msg: string) => {
    setErrorMsg(null);
    setActionMsg(msg);
    setTimeout(() => {
      setActionMsg((curr) => (curr === msg ? null : curr));
    }, 5000);
  };

  const showError = (err: unknown, fallback: string) => {
    setActionMsg(null);
    let msg = err instanceof Error ? err.message : fallback;
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      msg = 'Permissão recusada no Firestore. Verifique se você está autenticado com a conta administradora verificada.';
    }
    setErrorMsg(msg);
  };

  const ensureVerifiedAdminSession = () => {
    if (!firebaseUser) {
      throw new Error('Sessão expirada. Entre novamente como administrador.');
    }
    if (!firebaseUser.emailVerified) {
      throw new Error('Seu e-mail precisa estar verificado para salvar alterações na nuvem.');
    }
  };

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const [
        dash,
        userRes,
        chanRes,
        pCfg,
        logRes,
        sCfg,
        customRes,
        sysRes,
        fsSiteSnap,
        fsPlayerSnap,
        fsSystemSnap,
        fsSecretsSnap,
        fsCustomSnap,
        fsChannelsSnap,
        fsUsersSnap,
      ] = await Promise.all([
        apiRequest<{ stats: AdminDashboardStats; integrations: IntegrationStatus }>(
          '/api/admin/dashboard'
        ),
        apiRequest<{ items: UserProfile[] }>('/api/admin/users'),
        apiRequest<{ items: LiveChannel[] }>('/api/admin/channels'),
        apiRequest<PlayerConfig>('/api/admin/player-config'),
        apiRequest<{ items: SystemLogEntry[] }>('/api/admin/logs'),
        apiRequest<SiteConfig>('/api/admin/site-config'),
        apiRequest<{ items: CustomMediaItem[] }>('/api/admin/catalog/custom'),
        apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings'),
        getDoc(doc(db, 'siteConfig', 'global')).catch(() => null),
        getDoc(doc(db, 'playerSettings', 'global')).catch(() => null),
        getDoc(doc(db, 'systemSettings', 'global')).catch(() => null),
        getDoc(doc(db, 'adminSecrets', 'apiKeys')).catch(() => null),
        getDocs(collection(db, 'customCatalog')).catch(() => null),
        getDocs(collection(db, 'channels')).catch(() => null),
        getDocs(collection(db, 'users')).catch(() => null),
      ]);

      // 1. Site Config (prefer newest between Firestore & API)
      let effectiveSite = sanitizeSiteConfig(sCfg, DEFAULT_SITE_CONFIG, true);
      if (fsSiteSnap?.exists()) {
        const fsSite = sanitizeSiteConfig(
          fsSiteSnap.data() as Partial<SiteConfig>,
          DEFAULT_SITE_CONFIG,
          true
        );
        const fsTs = Date.parse(fsSite.updatedAt) || 0;
        const apiTs = Date.parse(effectiveSite.updatedAt) || 0;
        if (effectiveSite.updatedAt === DEFAULT_SITE_CONFIG.updatedAt || fsTs >= apiTs) {
          effectiveSite = fsSite;
        }
      }
      setSiteDraft(effectiveSite);
      applySiteConfig(effectiveSite);

      // 2. Player Config (prefer newest between Firestore & API)
      let effectivePlayer: PlayerConfig = { ...DEFAULT_PLAYER_CONFIG, ...pCfg };
      if (fsPlayerSnap?.exists()) {
        const fsData = fsPlayerSnap.data() as Partial<PlayerConfig>;
        const fsTs = Date.parse(toIsoTimestamp(fsData.updatedAt, '')) || 0;
        const apiTs = Date.parse(effectivePlayer.updatedAt || '') || 0;
        if (!effectivePlayer.updatedAt || effectivePlayer.updatedAt === DEFAULT_PLAYER_CONFIG.updatedAt || fsTs >= apiTs) {
          effectivePlayer = {
            ...effectivePlayer,
            sourceMode: fsData.sourceMode === 'custom_template' ? 'custom_template' : effectivePlayer.sourceMode,
            defaultDomain: fsData.defaultDomain || effectivePlayer.defaultDomain,
            fallbackDomain: fsData.fallbackDomain || effectivePlayer.fallbackDomain,
            autoFallback: typeof fsData.autoFallback === 'boolean' ? fsData.autoFallback : effectivePlayer.autoFallback,
            defaultPlayer: fsData.defaultPlayer || effectivePlayer.defaultPlayer,
            defaultColorHex:
              typeof fsData.defaultColorHex === 'string' && fsData.defaultColorHex
                ? fsData.defaultColorHex
                : effectivePlayer.defaultColorHex,
            customEmbedMovieTemplate:
              typeof fsData.customEmbedMovieTemplate === 'string'
                ? fsData.customEmbedMovieTemplate
                : effectivePlayer.customEmbedMovieTemplate,
            customEmbedTvTemplate:
              typeof fsData.customEmbedTvTemplate === 'string'
                ? fsData.customEmbedTvTemplate
                : effectivePlayer.customEmbedTvTemplate,
            embedTimeoutSeconds:
              typeof fsData.embedTimeoutSeconds === 'number'
                ? fsData.embedTimeoutSeconds
                : effectivePlayer.embedTimeoutSeconds,
          };
        }
      }
      setPlayerConfig(effectivePlayer);

      // 2b. System Settings & Runtime Token Overrides (cold-start sync from Firestore if needed)
      let effectiveSystem = sanitizeSystemSettings(sysRes.settings, DEFAULT_SYSTEM_SETTINGS, true);
      let effectiveSecrets = sysRes.secretsStatus;
      if (fsSystemSnap?.exists()) {
        const fsSys = sanitizeSystemSettings(
          fsSystemSnap.data() as Partial<SystemSettings>,
          DEFAULT_SYSTEM_SETTINGS,
          true
        );
        const fsTs = Date.parse(fsSys.updatedAt) || 0;
        const apiTs = Date.parse(effectiveSystem.updatedAt) || 0;
        if (effectiveSystem.updatedAt === DEFAULT_SYSTEM_SETTINGS.updatedAt || fsTs >= apiTs) {
          effectiveSystem = fsSys;
        }
      }
      if (fsSecretsSnap?.exists()) {
        const secData = fsSecretsSnap.data() as {
          tmdbAccessToken?: string;
          geminiApiKey?: string;
        };
        const needsTmdbSync = Boolean(secData.tmdbAccessToken && !effectiveSecrets.hasCustomTmdbToken);
        const needsGeminiSync = Boolean(secData.geminiApiKey && !effectiveSecrets.hasCustomGeminiKey);
        if (needsTmdbSync || needsGeminiSync) {
          const synced = await apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings', {
            method: 'PUT',
            body: JSON.stringify({
              ...effectiveSystem,
              ...(needsTmdbSync ? { tmdbAccessToken: secData.tmdbAccessToken } : {}),
              ...(needsGeminiSync ? { geminiApiKey: secData.geminiApiKey } : {}),
            }),
          }).catch(() => null);
          if (synced) {
            effectiveSystem = synced.settings;
            effectiveSecrets = synced.secretsStatus;
          }
        }
      }
      setSystemSettings(effectiveSystem);
      setSecretsStatus(effectiveSecrets);
      applyRuntimeSettings(
        extractPublicRuntimeSettings(effectiveSystem, effectivePlayer.embedTimeoutSeconds)
      );

      // 3. Custom Catalog (merge API + Firestore by id)
      const customMap = new Map<string, CustomMediaItem>();
      for (const item of customRes.items) {
        customMap.set(item.id, item);
      }
      if (fsCustomSnap) {
        for (const d of fsCustomSnap.docs) {
          try {
            const raw = d.data() as Partial<CustomMediaItem> & { title?: string; mediaType?: string };
            if (!raw.title) continue;
            const normalized = sanitizeCustomMediaInput({ ...raw, id: d.id });
            const iso = toIsoTimestamp(raw.updatedAt, '');
            if (iso) normalized.updatedAt = iso;
            customMap.set(normalized.id, normalized);
          } catch {
            // Skip invalid doc
          }
        }
      }
      setCustomCatalog(Array.from(customMap.values()));

      // 4. Channels (merge API + Firestore by id)
      const channelMap = new Map<string, LiveChannel>();
      for (const ch of chanRes.items) {
        channelMap.set(ch.id, ch);
      }
      if (fsChannelsSnap) {
        for (const d of fsChannelsSnap.docs) {
          const data = d.data();
          const ch: LiveChannel = {
            id: String(data.id || d.id),
            name: String(data.name || ''),
            category: (data.category as ChannelCategory) || 'Notícias',
            streamUrl: String(data.streamUrl || ''),
            logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
            description: typeof data.description === 'string' ? data.description : undefined,
            active: data.active !== false,
            createdAt: toIsoTimestamp(data.createdAt, new Date().toISOString()),
          };
          if (ch.name && ch.streamUrl) {
            channelMap.set(ch.id, ch);
          }
        }
      }
      setChannels(Array.from(channelMap.values()));

      // 5. Users (merge API + Firestore by uid)
      const userMap = new Map<string, UserProfile>();
      for (const u of userRes.items) {
        userMap.set(u.uid, u);
      }
      if (fsUsersSnap) {
        for (const d of fsUsersSnap.docs) {
          const data = d.data();
          const uid = String(data.uid || d.id);
          const existing = userMap.get(uid);
          userMap.set(uid, {
            uid,
            name: String(data.name || existing?.name || 'Usuário'),
            email: String(data.email || existing?.email || ''),
            photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : existing?.photoUrl || '',
            plan: (data.plan as PlanId) || existing?.plan || 'free',
            role: data.role === 'admin' ? 'admin' : 'user',
            blocked: Boolean(data.blocked),
            preferredTheme: (data.preferredTheme as ThemeId) || existing?.preferredTheme || 'cinematografico',
            preferredLanguage: String(data.preferredLanguage || existing?.preferredLanguage || 'pt-BR'),
            preferredQuality: String(data.preferredQuality || existing?.preferredQuality || '1080p'),
            parentalControl: Boolean(data.parentalControl ?? existing?.parentalControl),
            notificationsEnabled: data.notificationsEnabled !== false,
            createdAt: toIsoTimestamp(data.createdAt, existing?.createdAt || new Date().toISOString()),
            updatedAt: toIsoTimestamp(data.updatedAt, existing?.updatedAt || new Date().toISOString()),
          });
        }
      }
      setUsers(Array.from(userMap.values()));

      setStats(dash.stats);
      setIntegrations(dash.integrations);
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
  }, [applyRuntimeSettings, applySiteConfig]);

  useEffect(() => {
    if (firebaseUser) {
      void loadAdminData();
    } else {
      setLoading(false);
    }
  }, [firebaseUser, loadAdminData]);

  // --- Site Customization Handlers ---
  const handleSaveSiteConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const saved = await apiRequest<SiteConfig>('/api/admin/site-config', {
        method: 'PUT',
        body: JSON.stringify(siteDraft),
      });

      await setDoc(doc(db, 'siteConfig', 'global'), {
        siteName: saved.siteName,
        siteSlogan: saved.siteSlogan,
        logoUrl: saved.logoUrl,
        defaultTheme: saved.defaultTheme,
        accentColorHex: saved.accentColorHex,
        announcementEnabled: saved.announcementEnabled,
        announcementText: saved.announcementText,
        enableChannels: saved.enableChannels,
        enableAiPage: saved.enableAiPage,
        enablePlansPage: saved.enablePlansPage,
        maintenanceMode: saved.maintenanceMode,
        footerText: saved.footerText,
        updatedAt: serverTimestamp(),
      });

      setSiteDraft(saved);
      applySiteConfig(saved, true);

      // Also persist maintenanceMessage in systemSettings if changed from Site tab
      const sysUpdated = await apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...systemSettings,
          maintenanceMessage: systemSettings.maintenanceMessage,
        }),
      });
      await persistSystemSettingsToFirestore(sysUpdated.settings);
      setSystemSettings(sysUpdated.settings);
      applyRuntimeSettings(
        extractPublicRuntimeSettings(
          sysUpdated.settings,
          playerConfig?.embedTimeoutSeconds ?? 12
        ),
        true
      );

      showFeedback('Personalização e configurações do site salvas na nuvem e aplicadas.');
    } catch (err) {
      showError(err, 'Erro ao salvar configurações do site.');
    } finally {
      setSaving(false);
    }
  };

  // --- Custom Catalog Handlers ---
  const resetMediaForm = () => {
    setEditingMediaId(null);
    setMediaType('movie');
    setMediaTmdbId('');
    setMediaTitle('');
    setMediaOriginalTitle('');
    setMediaYear(String(new Date().getFullYear()));
    setMediaVote('8.5');
    setMediaPoster('');
    setMediaBackdrop('');
    setMediaOverview('');
    setMediaStreamUrl('');
    setMediaFeatured(false);
    setMediaActive(true);
  };

  const handleEditCustomMedia = (item: CustomMediaItem) => {
    setEditingMediaId(item.id);
    setMediaType(item.mediaType);
    setMediaTmdbId(String(item.tmdbId));
    setMediaTitle(item.title);
    setMediaOriginalTitle(item.originalTitle);
    setMediaYear(item.releaseYear);
    setMediaVote(String(item.voteAverage));
    setMediaPoster(item.posterPath || '');
    setMediaBackdrop(item.backdropPath || '');
    setMediaOverview(item.overview);
    setMediaStreamUrl(item.customStreamUrl || '');
    setMediaFeatured(item.featured);
    setMediaActive(item.active);
  };

  const handleSaveCustomMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const saved = await apiRequest<CustomMediaItem>('/api/admin/catalog/custom', {
        method: 'POST',
        body: JSON.stringify({
          id: editingMediaId || undefined,
          mediaType,
          tmdbId: mediaTmdbId ? Number(mediaTmdbId) : undefined,
          title: mediaTitle,
          originalTitle: mediaOriginalTitle || mediaTitle,
          releaseYear: mediaYear,
          voteAverage: Number(mediaVote),
          posterPath: mediaPoster,
          backdropPath: mediaBackdrop,
          overview: mediaOverview,
          customStreamUrl: mediaStreamUrl,
          featured: mediaFeatured,
          active: mediaActive,
        }),
      });

      await setDoc(doc(db, 'customCatalog', saved.id), {
        id: saved.id,
        tmdbId: saved.tmdbId,
        mediaType: saved.mediaType,
        title: saved.title,
        originalTitle: saved.originalTitle,
        overview: saved.overview,
        posterPath: saved.posterPath,
        backdropPath: saved.backdropPath,
        releaseYear: saved.releaseYear,
        voteAverage: saved.voteAverage,
        ...(saved.customStreamUrl ? { customStreamUrl: saved.customStreamUrl } : {}),
        featured: saved.featured,
        active: saved.active,
        updatedAt: serverTimestamp(),
      });

      setCustomCatalog((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
      });
      resetMediaForm();
      showFeedback(`Título "${saved.title}" salvo no catálogo e na nuvem.`);
    } catch (err) {
      showError(err, 'Erro ao salvar mídia.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomMedia = async (id: string) => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      await apiRequest(`/api/admin/catalog/custom/${id}`, { method: 'DELETE' }).catch(() => null);
      await deleteDoc(doc(db, 'customCatalog', id));
      setCustomCatalog((prev) => prev.filter((m) => m.id !== id));
      if (editingMediaId === id) resetMediaForm();
      showFeedback('Mídia personalizada removida.');
    } catch (err) {
      showError(err, 'Erro ao remover mídia personalizada.');
    } finally {
      setSaving(false);
    }
  };

  // --- Channel Handlers ---
  const persistChannelToFirestore = async (channel: LiveChannel) => {
    const chRef = doc(db, 'channels', channel.id);
    const existingSnap = await getDoc(chRef);
    const payload: Record<string, unknown> = {
      id: channel.id,
      name: channel.name,
      category: channel.category,
      streamUrl: channel.streamUrl,
      active: channel.active,
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
    };
    if (channel.logoUrl) payload.logoUrl = channel.logoUrl;
    if (channel.description) payload.description = channel.description;
    await setDoc(chRef, payload);
  };

  const resetChannelForm = () => {
    setEditingChannelId(null);
    setChName('');
    setChCategory('Notícias');
    setChUrl('');
    setChLogo('');
    setChDesc('');
    setChActive(true);
  };

  const handleEditChannel = (ch: LiveChannel) => {
    setEditingChannelId(ch.id);
    setChName(ch.name);
    setChCategory(ch.category);
    setChUrl(ch.streamUrl);
    setChLogo(ch.logoUrl || '');
    setChDesc(ch.description || '');
    setChActive(ch.active);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const saved = await apiRequest<LiveChannel>('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: editingChannelId || undefined,
          name: chName,
          category: chCategory,
          streamUrl: chUrl,
          logoUrl: chLogo || undefined,
          description: chDesc,
          active: chActive,
        }),
      });
      await persistChannelToFirestore(saved);
      setChannels((prev) => {
        const exists = prev.some((c) => c.id === saved.id);
        return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
      });
      resetChannelForm();
      showFeedback(`Canal "${saved.name}" salvo na nuvem com sucesso.`);
    } catch (err) {
      showError(err, 'Erro ao salvar canal.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChannelActive = async (ch: LiveChannel) => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const updated = await apiRequest<LiveChannel>('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({ ...ch, active: !ch.active }),
      });
      await persistChannelToFirestore(updated);
      setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showFeedback(`Canal "${updated.name}" ${updated.active ? 'ativado' : 'desativado'}.`);
    } catch (err) {
      showError(err, 'Erro ao atualizar status do canal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      await apiRequest(`/api/admin/channels/${id}`, { method: 'DELETE' }).catch(() => null);
      await deleteDoc(doc(db, 'channels', id));
      setChannels((prev) => prev.filter((c) => c.id !== id));
      if (editingChannelId === id) resetChannelForm();
      showFeedback('Canal removido.');
    } catch (err) {
      showError(err, 'Erro ao remover canal.');
    } finally {
      setSaving(false);
    }
  };

  // --- User Handlers ---
  const handleUserUpdate = async (
    u: UserProfile,
    updates: Partial<Pick<UserProfile, 'blocked' | 'role' | 'plan'>>
  ) => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      let updated: UserProfile = { ...u, ...updates };
      try {
        updated = await apiRequest<UserProfile>(`/api/admin/users/${u.uid}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
      } catch {
        // User may exist only in Firestore after cold restart
      }

      const userRef = doc(db, 'users', u.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          role: updated.role,
          blocked: updated.blocked,
          plan: updated.plan,
          updatedAt: serverTimestamp(),
        });
      }

      if (updates.role) {
        const adminRef = doc(db, 'admins', u.uid);
        if (updates.role === 'admin') {
          await setDoc(adminRef, {
            uid: u.uid,
            email: updated.email,
            grantedAt: serverTimestamp(),
          });
        } else if (u.uid !== firebaseUser?.uid) {
          await deleteDoc(adminRef).catch(() => null);
        }
      }

      setUsers((prev) => prev.map((x) => (x.uid === updated.uid ? updated : x)));
      showFeedback(`Conta ${updated.email} atualizada na nuvem.`);
    } catch (err) {
      showError(err, 'Erro ao atualizar conta de usuário.');
    } finally {
      setSaving(false);
    }
  };

  // --- Catalog Sync & Cache ---
  const handleSyncCatalog = async () => {
    try {
      const res = await apiRequest<{ count: number; syncedAt: string; source: string }>(
        '/api/admin/catalog/sync',
        { method: 'POST' }
      );
      showFeedback(`Catálogo sincronizado: ${res.count} títulos atualizados.`);
      await loadAdminData();
    } catch (err) {
      showError(err, 'Erro ao sincronizar catálogo.');
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await apiRequest<{ cleared: number }>('/api/admin/cache/clear', {
        method: 'POST',
      });
      showFeedback(`Cache limpo: ${res.cleared} entradas removidas.`);
      await loadAdminData();
    } catch (err) {
      showError(err, 'Erro ao limpar cache.');
    }
  };

  // --- Player Config Handler (Admin Only) ---
  const handleSavePlayerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerConfig) return;
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const updated = await apiRequest<PlayerConfig>('/api/admin/player-config', {
        method: 'PUT',
        body: JSON.stringify(playerConfig),
      });

      await setDoc(doc(db, 'playerSettings', 'global'), {
        sourceMode: updated.sourceMode,
        defaultDomain: updated.defaultDomain,
        fallbackDomain: updated.fallbackDomain,
        autoFallback: updated.autoFallback,
        defaultPlayer: updated.defaultPlayer,
        defaultColorHex: updated.defaultColorHex,
        customEmbedMovieTemplate: updated.customEmbedMovieTemplate,
        customEmbedTvTemplate: updated.customEmbedTvTemplate,
        embedTimeoutSeconds: updated.embedTimeoutSeconds,
        updatedAt: serverTimestamp(),
      });

      setPlayerConfig(updated);
      applyRuntimeSettings(
        extractPublicRuntimeSettings(systemSettings, updated.embedTimeoutSeconds),
        true
      );
      showFeedback('Configuração global de players, templates e fallback salva na nuvem.');
    } catch (err) {
      showError(err, 'Erro ao salvar configuração de players.');
    } finally {
      setSaving(false);
    }
  };

  // --- System Settings & API Sources Helpers ---
  const persistSystemSettingsToFirestore = async (settings: SystemSettings) => {
    await setDoc(doc(db, 'systemSettings', 'global'), {
      catalogSource: settings.catalogSource,
      tmdbBaseUrl: settings.tmdbBaseUrl,
      tmdbImageBaseUrl: settings.tmdbImageBaseUrl,
      tmdbLanguage: settings.tmdbLanguage,
      tmdbImageQuality: settings.tmdbImageQuality,
      includeAdult: settings.includeAdult,
      cacheTtlMinutes: settings.cacheTtlMinutes,
      aiMode: settings.aiMode,
      aiMaxRecommendations: settings.aiMaxRecommendations,
      allowRegistration: settings.allowRegistration,
      requireAuthForPlayer: settings.requireAuthForPlayer,
      allowGuestFavorites: settings.allowGuestFavorites,
      maxProfilesPerAccount: settings.maxProfilesPerAccount,
      defaultUserPlan: settings.defaultUserPlan,
      maintenanceMessage: settings.maintenanceMessage,
      updatedAt: serverTimestamp(),
    });
  };

  const handleSaveSystemSettings = async (
    e: React.FormEvent,
    customFeedback = 'Fontes de API e configurações do sistema salvas e aplicadas.'
  ) => {
    e.preventDefault();
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const payload: Record<string, unknown> = { ...systemSettings };
      if (tmdbTokenInput.trim()) payload.tmdbAccessToken = tmdbTokenInput.trim();
      if (geminiKeyInput.trim()) payload.geminiApiKey = geminiKeyInput.trim();

      const res = await apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      await persistSystemSettingsToFirestore(res.settings);

      if (tmdbTokenInput.trim() || geminiKeyInput.trim()) {
        const secretsSnap = await getDoc(doc(db, 'adminSecrets', 'apiKeys')).catch(() => null);
        const existingSecrets = secretsSnap?.exists()
          ? (secretsSnap.data() as { tmdbAccessToken?: string; geminiApiKey?: string })
          : {};
        await setDoc(doc(db, 'adminSecrets', 'apiKeys'), {
          ...(tmdbTokenInput.trim()
            ? { tmdbAccessToken: tmdbTokenInput.trim() }
            : existingSecrets.tmdbAccessToken
              ? { tmdbAccessToken: existingSecrets.tmdbAccessToken }
              : {}),
          ...(geminiKeyInput.trim()
            ? { geminiApiKey: geminiKeyInput.trim() }
            : existingSecrets.geminiApiKey
              ? { geminiApiKey: existingSecrets.geminiApiKey }
              : {}),
          updatedAt: serverTimestamp(),
        });
      }

      setSystemSettings(res.settings);
      setSecretsStatus(res.secretsStatus);
      setTmdbTokenInput('');
      setGeminiKeyInput('');
      applyRuntimeSettings(
        extractPublicRuntimeSettings(res.settings, playerConfig?.embedTimeoutSeconds ?? 12),
        true
      );
      const dash = await apiRequest<{
        stats: AdminDashboardStats;
        integrations: IntegrationStatus;
      }>('/api/admin/dashboard').catch(() => null);
      if (dash) {
        setStats(dash.stats);
        setIntegrations(dash.integrations);
      }
      showFeedback(customFeedback);
    } catch (err) {
      showError(err, 'Erro ao salvar configurações do sistema.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSecret = async (target: 'tmdb' | 'gemini') => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const res = await apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings', {
        method: 'PUT',
        body: JSON.stringify(
          target === 'tmdb' ? { clearTmdbAccessToken: true } : { clearGeminiApiKey: true }
        ),
      });

      const secretsSnap = await getDoc(doc(db, 'adminSecrets', 'apiKeys')).catch(() => null);
      if (secretsSnap?.exists()) {
        const data = secretsSnap.data() as { tmdbAccessToken?: string; geminiApiKey?: string };
        const nextDoc: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (target !== 'tmdb' && data.tmdbAccessToken) {
          nextDoc.tmdbAccessToken = data.tmdbAccessToken;
        }
        if (target !== 'gemini' && data.geminiApiKey) {
          nextDoc.geminiApiKey = data.geminiApiKey;
        }
        await setDoc(doc(db, 'adminSecrets', 'apiKeys'), nextDoc);
      }

      setSecretsStatus(res.secretsStatus);
      showFeedback(
        target === 'tmdb'
          ? 'Token customizado do TMDB removido. Voltando para configuração padrão.'
          : 'Chave Gemini customizada removida. Voltando para configuração padrão.'
      );
    } catch (err) {
      showError(err, 'Erro ao limpar credencial.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSystemSettings = async () => {
    setSaving(true);
    try {
      ensureVerifiedAdminSession();
      const res = await apiRequest<AdminSystemSettingsResponse>('/api/admin/system-settings/reset', {
        method: 'POST',
      });
      await persistSystemSettingsToFirestore(res.settings);
      setSystemSettings(res.settings);
      setSecretsStatus(res.secretsStatus);
      applyRuntimeSettings(
        extractPublicRuntimeSettings(res.settings, playerConfig?.embedTimeoutSeconds ?? 12),
        true
      );
      showFeedback('Fontes de API e políticas restauradas ao padrão de fábrica.');
    } catch (err) {
      showError(err, 'Erro ao restaurar padrões.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunDiagnostic = async (target: 'tmdb' | 'player' | 'firestore') => {
    setTestingTarget(target);
    try {
      const result = await apiRequest<DiagnosticResult>('/api/admin/diagnostics/test', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      setDiagnostics((prev) => ({ ...prev, [target]: result }));
    } catch (err) {
      setDiagnostics((prev) => ({
        ...prev,
        [target]: {
          target,
          ok: false,
          latencyMs: 0,
          message: err instanceof Error ? err.message : 'Falha ao executar diagnóstico.',
          testedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setTestingTarget(null);
    }
  };

  const handleRunAllDiagnostics = async () => {
    for (const target of ['tmdb', 'player', 'firestore'] as const) {
      await handleRunDiagnostic(target);
    }
    showFeedback('Diagnósticos completos finalizados.');
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      siteConfig: siteDraft,
      systemSettings,
      playerConfig,
      channels,
      customCatalog,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `megastream-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Backup JSON exportado (sem credenciais ou chaves secretas).');
  };

  // RESTRICTED ADMIN GATE (Separate Standalone View — Never leaks server/source/domain details!)
  if (!firebaseUser || authError) {
    return (
      <div className="min-h-screen bg-[#040712] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#0a1022] border border-white/10 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto bg-sky-500/15 border border-sky-400/25 flex items-center justify-center text-sky-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-mono-tabular uppercase tracking-widest text-sky-400">
              Área Restrita
            </p>
            <h1 className="font-display text-2xl font-extrabold text-white">
              Console Administrativo
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {authError ||
                'Entre com uma conta administradora autorizada para gerenciar aparência do site, APIs, catálogo, players, canais e usuários.'}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {!firebaseUser ? (
              <>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--ms-accent)' }}
                >
                  Entrar com Google (Admin)
                </button>
                <Link
                  to="/login"
                  className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Entrar com E-mail e Senha
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white cursor-pointer"
              >
                Trocar de Conta
              </button>
            )}
            <Link
              to="/"
              className="w-full h-11 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium text-slate-300 flex items-center justify-center gap-2"
            >
              Voltar para {siteConfig.siteName}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const maxUsage = stats
    ? Math.max(1, ...stats.usageSeries.map((d) => d.playbacks + d.searches))
    : 1;

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const renderSidebarNav = () => (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-white truncate">
              {siteConfig.siteName}
            </p>
            <p className="text-[10px] font-mono-tabular uppercase tracking-wider text-sky-400">
              Admin Console
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
          aria-label="Fechar menu admin"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto" aria-label="Menu Administrativo">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.group} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.group}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  style={active ? { backgroundColor: 'var(--ms-accent)' } : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1.5">
        <Link
          to="/"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10"
        >
          <span>Abrir Site Público</span>
          <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-300 hover:bg-red-500/10 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Encerrar Sessão
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#040712] text-white flex">
      {/* Desktop Dedicated Admin Sidebar (256px) */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#070b18] border-r border-white/10 fixed inset-y-0 left-0 z-30">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#070b18] border-r border-white/10 z-10 h-full">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Main Standalone Admin Workspace */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-8 bg-[#070b18]/95 backdrop-blur border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegação administrativa"
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-mono-tabular text-slate-400">
                Administração / {TAB_TITLES[activeTab]}
              </p>
              <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadAdminData()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="max-w-[180px] truncate">{profile?.email || firebaseUser.email}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1380px] w-full mx-auto space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-xs sm:text-sm text-red-200 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                aria-label="Fechar alerta"
                className="text-red-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {actionMsg && (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm text-emerald-200 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionMsg}</span>
            </div>
          )}

          {loading || !stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-5">
                      <p className="text-xs text-slate-400">Total de Usuários</p>
                      <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                        {stats.totalUsers}
                      </p>
                      <p className="text-xs text-sky-400 mt-1 font-mono-tabular">
                        {stats.activeUsers} contas ativas
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-5">
                      <p className="text-xs text-slate-400">Catálogo Sincronizado</p>
                      <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                        {stats.catalogMovies + stats.catalogSeries}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 font-mono-tabular">
                        {stats.catalogMovies} filmes · {stats.catalogSeries} séries
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-5">
                      <p className="text-xs text-slate-400">Reproduções Totais</p>
                      <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                        {stats.totalPlaybacks}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 font-mono-tabular">
                        {customCatalog.length} títulos customizados
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-5">
                      <p className="text-xs text-slate-400">Canais & Assinaturas</p>
                      <p className="font-display text-2xl font-extrabold text-white mt-1 font-mono-tabular">
                        {stats.channelsCount} / {stats.activeSubscriptions}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Canais / Planos ativos</p>
                    </div>
                  </div>

                  {/* Quick Admin Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab('site')}
                      className="text-left rounded-2xl bg-[#0c1224] border border-white/10 p-5 hover:border-sky-400/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <Palette className="w-5 h-5 text-sky-400" />
                      <p className="text-sm font-bold text-white">Personalizar Site</p>
                      <p className="text-xs text-slate-400">
                        Alterar nome, logo, tema padrão, cor de destaque e módulos.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('apis')}
                      className="text-left rounded-2xl bg-[#0c1224] border border-white/10 p-5 hover:border-sky-400/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <KeyRound className="w-5 h-5 text-sky-400" />
                      <p className="text-sm font-bold text-white">Fontes de API</p>
                      <p className="text-xs text-slate-400">
                        Trocar origem do catálogo (TMDB/Demo/Custom), idioma e IA.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('players')}
                      className="text-left rounded-2xl bg-[#0c1224] border border-white/10 p-5 hover:border-sky-400/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <Play className="w-5 h-5 text-sky-400" />
                      <p className="text-sm font-bold text-white">Players & Embed</p>
                      <p className="text-xs text-slate-400">
                        Configurar domínios, fallback automático e templates customizados.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="text-left rounded-2xl bg-[#0c1224] border border-white/10 p-5 hover:border-sky-400/50 transition-colors cursor-pointer space-y-1.5"
                    >
                      <Film className="w-5 h-5 text-sky-400" />
                      <p className="text-sm font-bold text-white">Catálogo & Mídias</p>
                      <p className="text-xs text-slate-400">
                        Adicionar ou editar filmes, séries, capas e URLs personalizadas.
                      </p>
                    </button>
                  </div>

                  {/* Usage Chart */}
                  <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
                    <h2 className="font-display text-base font-bold text-white">
                      Visualizações e Buscas (Últimos 7 dias)
                    </h2>
                    <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
                      {stats.usageSeries.map((day) => {
                        const total = day.playbacks + day.searches;
                        const heightPct = Math.max(12, Math.round((total / maxUsage) * 100));
                        return (
                          <div
                            key={day.label}
                            className="flex flex-col items-center gap-2 h-full justify-end"
                          >
                            <span className="text-[11px] text-slate-400 font-mono-tabular">
                              {total}
                            </span>
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

              {/* TAB: SITE CUSTOMIZATION */}
              {activeTab === 'site' && (
                <form onSubmit={handleSaveSiteConfig} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Brand & Identity */}
                    <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Globe className="w-4 h-4 text-sky-400" />
                        Identidade & Textos do Site
                      </h2>

                      <div>
                        <label htmlFor="site-name" className="block text-xs text-slate-300 mb-1">
                          Nome da Plataforma
                        </label>
                        <input
                          id="site-name"
                          type="text"
                          value={siteDraft.siteName}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, siteName: e.target.value })
                          }
                          required
                          maxLength={40}
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="site-slogan" className="block text-xs text-slate-300 mb-1">
                          Slogan / Subtítulo
                        </label>
                        <input
                          id="site-slogan"
                          type="text"
                          value={siteDraft.siteSlogan}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, siteSlogan: e.target.value })
                          }
                          required
                          maxLength={100}
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="site-logo" className="block text-xs text-slate-300 mb-1">
                          URL de Logo Personalizada (deixe vazio para usar o ícone padrão)
                        </label>
                        <input
                          id="site-logo"
                          type="url"
                          value={siteDraft.logoUrl}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, logoUrl: e.target.value })
                          }
                          placeholder="https://..."
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="site-footer" className="block text-xs text-slate-300 mb-1">
                          Texto do Rodapé Lateral
                        </label>
                        <input
                          id="site-footer"
                          type="text"
                          value={siteDraft.footerText}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, footerText: e.target.value })
                          }
                          maxLength={120}
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>
                    </section>

                    {/* Theme & Accent Colors */}
                    <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Palette className="w-4 h-4 text-sky-400" />
                        Aparência Global & Cores
                      </h2>

                      <div>
                        <label htmlFor="site-theme" className="block text-xs text-slate-300 mb-1">
                          Tema Padrão para Visitantes
                        </label>
                        <select
                          id="site-theme"
                          value={siteDraft.defaultTheme}
                          onChange={(e) =>
                            setSiteDraft({
                              ...siteDraft,
                              defaultTheme: e.target.value as ThemeId,
                            })
                          }
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        >
                          {themes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {t.subtitle}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="site-accent" className="block text-xs text-slate-300 mb-1">
                          Cor Principal Personalizada (Hex, opcional)
                        </label>
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            aria-label="Seletor visual da cor principal"
                            value={
                              siteDraft.accentColorHex
                                ? `#${siteDraft.accentColorHex.replace('#', '')}`
                                : '#1d63ff'
                            }
                            onChange={(e) =>
                              setSiteDraft({
                                ...siteDraft,
                                accentColorHex: e.target.value.replace('#', ''),
                              })
                            }
                            className="h-10 w-12 rounded-xl bg-transparent border border-white/10 cursor-pointer"
                          />
                          <input
                            id="site-accent"
                            type="text"
                            value={siteDraft.accentColorHex}
                            onChange={(e) =>
                              setSiteDraft({
                                ...siteDraft,
                                accentColorHex: e.target.value.replace('#', ''),
                              })
                            }
                            placeholder="Padrão do tema (ex: 1d63ff)"
                            maxLength={6}
                            className="flex-1 h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                          />
                          <button
                            type="button"
                            onClick={() => setSiteDraft({ ...siteDraft, accentColorHex: '' })}
                            className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
                          >
                            Resetar cor
                          </button>
                        </div>
                      </div>

                      {/* Announcement Banner */}
                      <div className="pt-2 border-t border-white/10 space-y-3">
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                          <span className="text-xs font-semibold text-white">
                            Exibir Banner de Aviso no Topo do Site
                          </span>
                          <input
                            type="checkbox"
                            checked={siteDraft.announcementEnabled}
                            onChange={(e) =>
                              setSiteDraft({
                                ...siteDraft,
                                announcementEnabled: e.target.checked,
                              })
                            }
                            className="w-4 h-4 accent-sky-500"
                          />
                        </label>
                        <input
                          type="text"
                          value={siteDraft.announcementText}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, announcementText: e.target.value })
                          }
                          placeholder="Ex: Novos lançamentos adicionados hoje!"
                          maxLength={180}
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>
                    </section>
                  </div>

                  {/* Feature Toggles & Maintenance */}
                  <section className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
                    <h2 className="font-display text-base font-bold text-white">
                      Módulos Visíveis & Modo de Manutenção
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        {
                          key: 'enableChannels' as const,
                          title: 'Página de Canais Ao Vivo',
                          desc: 'Exibe a aba Canais no menu principal.',
                        },
                        {
                          key: 'enableAiPage' as const,
                          title: 'IA Inteligente',
                          desc: 'Exibe recomendações inteligentes no menu.',
                        },
                        {
                          key: 'enablePlansPage' as const,
                          title: 'Planos & Assinaturas',
                          desc: 'Exibe a seção de planos para usuários.',
                        },
                        {
                          key: 'maintenanceMode' as const,
                          title: 'Modo Manutenção',
                          desc: 'Exibe alerta de manutenção para visitantes.',
                        },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="rounded-xl bg-black/30 border border-white/10 p-4 flex items-start justify-between gap-3 cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{item.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={siteDraft[item.key]}
                            onChange={(e) =>
                              setSiteDraft({ ...siteDraft, [item.key]: e.target.checked })
                            }
                            className="w-4 h-4 mt-0.5 accent-sky-500 shrink-0"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <label htmlFor="site-maint-msg" className="block text-xs text-slate-300 mb-1">
                        Mensagem de Manutenção Programada
                      </label>
                      <input
                        id="site-maint-msg"
                        type="text"
                        maxLength={240}
                        value={systemSettings.maintenanceMessage}
                        onChange={(e) =>
                          setSystemSettings({
                            ...systemSettings,
                            maintenanceMessage: e.target.value,
                          })
                        }
                        placeholder="Mensagem exibida no banner quando o Modo Manutenção estiver ativo"
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: 'var(--ms-accent)' }}
                      >
                        {saving ? 'Salvando...' : 'Salvar Personalização do Site'}
                      </button>
                    </div>
                  </section>
                </form>
              )}

              {/* TAB: API SOURCES */}
              {activeTab === 'apis' && (
                <AdminApiSourcesTab
                  systemSettings={systemSettings}
                  onChange={setSystemSettings}
                  secretsStatus={secretsStatus}
                  tmdbTokenInput={tmdbTokenInput}
                  onTmdbTokenInputChange={setTmdbTokenInput}
                  geminiKeyInput={geminiKeyInput}
                  onGeminiKeyInputChange={setGeminiKeyInput}
                  saving={saving}
                  testingTarget={testingTarget}
                  tmdbDiagnostic={diagnostics.tmdb ?? null}
                  onSave={(e) =>
                    void handleSaveSystemSettings(
                      e,
                      'Fontes de API, endpoints e credenciais atualizados com sucesso.'
                    )
                  }
                  onClearSecret={(target) => void handleClearSecret(target)}
                  onTestTmdb={() => void handleRunDiagnostic('tmdb')}
                  onResetDefaults={() => void handleResetSystemSettings()}
                />
              )}

              {/* TAB: CATALOG & CUSTOM MEDIA */}
              {activeTab === 'catalog' && (
                <div className="space-y-6">
                  {/* Sync Bar */}
                  <div className="rounded-2xl bg-[#0c1224] border border-white/10 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-sky-400" />
                        Sincronização de Catálogo & Cache
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Última sincronização:{' '}
                        {integrations?.lastSyncAt
                          ? new Date(integrations.lastSyncAt).toLocaleString('pt-BR')
                          : 'Automática ao iniciar'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleClearCache()}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
                      >
                        Limpar Cache ({integrations?.cacheEntries ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSyncCatalog()}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--ms-accent)' }}
                      >
                        Sincronizar Catálogo Agora
                      </button>
                    </div>
                  </div>

                  {/* Add / Modify Movie or Series */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <form
                      onSubmit={handleSaveCustomMedia}
                      className="lg:col-span-5 rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                          <Plus className="w-4 h-4 text-sky-400" />
                          {editingMediaId ? 'Editar Título' : 'Adicionar / Personalizar Título'}
                        </h2>
                        {editingMediaId && (
                          <button
                            type="button"
                            onClick={resetMediaForm}
                            className="text-xs text-sky-400 hover:underline cursor-pointer"
                          >
                            Cancelar edição
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="cm-type" className="block text-xs text-slate-300 mb-1">
                            Tipo
                          </label>
                          <select
                            id="cm-type"
                            value={mediaType}
                            onChange={(e) => setMediaType(e.target.value as MediaType)}
                            className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                          >
                            <option value="movie">Filme</option>
                            <option value="tv">Série</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="cm-tmdbid" className="block text-xs text-slate-300 mb-1">
                            ID TMDB (opcional)
                          </label>
                          <input
                            id="cm-tmdbid"
                            type="number"
                            min={1}
                            value={mediaTmdbId}
                            onChange={(e) => setMediaTmdbId(e.target.value)}
                            placeholder="Automático"
                            className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cm-title" className="block text-xs text-slate-300 mb-1">
                          Título
                        </label>
                        <input
                          id="cm-title"
                          type="text"
                          value={mediaTitle}
                          onChange={(e) => setMediaTitle(e.target.value)}
                          required
                          placeholder="Ex: Duna: Edição Especial"
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="cm-year" className="block text-xs text-slate-300 mb-1">
                            Ano de Lançamento
                          </label>
                          <input
                            id="cm-year"
                            type="text"
                            value={mediaYear}
                            onChange={(e) => setMediaYear(e.target.value)}
                            maxLength={4}
                            className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label htmlFor="cm-vote" className="block text-xs text-slate-300 mb-1">
                            Nota (0–10)
                          </label>
                          <input
                            id="cm-vote"
                            type="number"
                            step="0.1"
                            min={0}
                            max={10}
                            value={mediaVote}
                            onChange={(e) => setMediaVote(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cm-poster" className="block text-xs text-slate-300 mb-1">
                          URL da Capa / Pôster
                        </label>
                        <input
                          id="cm-poster"
                          type="url"
                          value={mediaPoster}
                          onChange={(e) => setMediaPoster(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="cm-backdrop" className="block text-xs text-slate-300 mb-1">
                          URL do Banner / Backdrop
                        </label>
                        <input
                          id="cm-backdrop"
                          type="url"
                          value={mediaBackdrop}
                          onChange={(e) => setMediaBackdrop(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="cm-stream" className="block text-xs text-slate-300 mb-1">
                          URL de Vídeo Customizada (opcional)
                        </label>
                        <input
                          id="cm-stream"
                          type="url"
                          value={mediaStreamUrl}
                          onChange={(e) => setMediaStreamUrl(e.target.value)}
                          placeholder="Deixe vazio para usar provedor padrão"
                          className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor="cm-overview" className="block text-xs text-slate-300 mb-1">
                          Sinopse
                        </label>
                        <textarea
                          id="cm-overview"
                          rows={3}
                          value={mediaOverview}
                          onChange={(e) => setMediaOverview(e.target.value)}
                          placeholder="Descrição do filme ou série..."
                          className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                        />
                      </div>

                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mediaFeatured}
                            onChange={(e) => setMediaFeatured(e.target.checked)}
                            className="w-4 h-4 accent-sky-500"
                          />
                          Destacar na Home
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mediaActive}
                            onChange={(e) => setMediaActive(e.target.checked)}
                            className="w-4 h-4 accent-sky-500"
                          />
                          Título Ativo
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--ms-accent)' }}
                      >
                        {editingMediaId ? 'Atualizar Título' : 'Salvar no Catálogo'}
                      </button>
                    </form>

                    {/* Custom Catalog List */}
                    <div className="lg:col-span-7 rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4">
                      <h2 className="font-display text-base font-bold text-white">
                        Mídias Adicionadas ou Modificadas ({customCatalog.length})
                      </h2>
                      {customCatalog.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
                          Nenhum título customizado ainda. Use o formulário ao lado para adicionar um novo filme/série ou personalizar um título existente pelo ID TMDB.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {customCatalog.map((item) => (
                            <div
                              key={item.id}
                              className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {item.posterPath ? (
                                  <img
                                    src={item.posterPath}
                                    alt={item.title}
                                    referrerPolicy="no-referrer"
                                    className="w-11 h-16 rounded-lg object-cover shrink-0 bg-slate-900"
                                  />
                                ) : (
                                  <div className="w-11 h-16 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    <Film className="w-4 h-4 text-sky-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-slate-400 font-mono-tabular">
                                    {item.mediaType === 'tv' ? 'Série' : 'Filme'} · #{item.tmdbId} ·{' '}
                                    {item.releaseYear} · Nota {item.voteAverage.toFixed(1)}
                                  </p>
                                  <p className="text-[11px] text-sky-400 mt-0.5">
                                    {item.featured ? 'Destaque Home · ' : ''}
                                    {item.active ? 'Ativo' : 'Oculto'}
                                    {item.customStreamUrl ? ' · Fonte customizada' : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditCustomMedia(item)}
                                  aria-label={`Editar ${item.title}`}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCustomMedia(item.id)}
                                  aria-label={`Remover ${item.title}`}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/30 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CHANNELS */}
              {activeTab === 'channels' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handleSaveChannel}
                    className="lg:col-span-5 rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold text-white">
                        {editingChannelId ? 'Editar Canal' : 'Cadastrar Canal Autorizado'}
                      </h2>
                      {editingChannelId && (
                        <button
                          type="button"
                          onClick={resetChannelForm}
                          className="text-xs text-sky-400 hover:underline cursor-pointer"
                        >
                          Novo canal
                        </button>
                      )}
                    </div>

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
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
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
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
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
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="ch-logo" className="block text-xs text-slate-300 mb-1">
                        URL do Logotipo (opcional)
                      </label>
                      <input
                        id="ch-logo"
                        type="url"
                        value={chLogo}
                        onChange={(e) => setChLogo(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
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
                        className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chActive}
                        onChange={(e) => setChActive(e.target.checked)}
                        className="w-4 h-4 accent-sky-500"
                      />
                      Canal Ativo no Site
                    </label>
                    <button
                      type="submit"
                      className="w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer"
                      style={{ backgroundColor: 'var(--ms-accent)' }}
                    >
                      {editingChannelId ? 'Atualizar Canal' : 'Salvar Canal Autorizado'}
                    </button>
                  </form>

                  <div className="lg:col-span-7 rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-3">
                    <h2 className="font-display text-base font-bold text-white">
                      Canais Cadastrados ({channels.length})
                    </h2>
                    {channels.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum canal cadastrado ainda.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {channels.map((ch) => (
                          <div
                            key={ch.id}
                            className="p-3.5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">
                                {ch.name}{' '}
                                <span
                                  className={`text-[11px] font-normal ml-1 ${
                                    ch.active ? 'text-emerald-400' : 'text-amber-300'
                                  }`}
                                >
                                  ({ch.active ? 'Ativo' : 'Pausado'})
                                </span>
                              </p>
                              <p className="text-xs text-sky-300">{ch.category}</p>
                              <p className="text-[11px] text-slate-400 truncate">{ch.streamUrl}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleToggleChannelActive(ch)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-xs text-slate-200 cursor-pointer"
                              >
                                {ch.active ? 'Pausar' : 'Ativar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditChannel(ch)}
                                aria-label={`Editar canal ${ch.name}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteChannel(ch.id)}
                                aria-label={`Remover canal ${ch.name}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/30 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: PLAYERS & SOURCES (ADMIN ONLY) */}
              {activeTab === 'players' && playerConfig && (
                <AdminPlayerTab
                  playerConfig={playerConfig}
                  onChange={setPlayerConfig}
                  saving={saving}
                  testingPlayer={testingTarget === 'player'}
                  playerDiagnostic={diagnostics.player ?? null}
                  onSave={(e) => void handleSavePlayerConfig(e)}
                  onTestPlayer={() => void handleRunDiagnostic('player')}
                />
              )}

              {/* TAB: USERS, PLANS & POLICIES */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <AdminPoliciesPanel
                    systemSettings={systemSettings}
                    onChange={setSystemSettings}
                    saving={saving}
                    onSave={(e) =>
                      void handleSaveSystemSettings(
                        e,
                        'Políticas de acesso, cadastro e perfis atualizadas.'
                      )
                    }
                  />

                  <div className="rounded-2xl bg-[#0c1224] border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-base font-bold text-white">
                        Contas Cadastradas ({filteredUsers.length})
                      </h2>
                      <input
                        type="search"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Filtrar por nome ou e-mail..."
                        className="h-9 px-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white w-full sm:w-64"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-xs text-slate-400">
                            <th className="p-4">Nome</th>
                            <th className="p-4">E-mail</th>
                            <th className="p-4">Permissão</th>
                            <th className="p-4">Plano</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredUsers.map((u) => (
                            <tr key={u.uid} className="hover:bg-white/5">
                              <td className="p-4 font-semibold text-white">{u.name}</td>
                              <td className="p-4 text-slate-300">{u.email}</td>
                              <td className="p-4">
                                <select
                                  value={u.role}
                                  onChange={(e) =>
                                    void handleUserUpdate(u, {
                                      role: e.target.value as 'user' | 'admin',
                                    })
                                  }
                                  aria-label={`Permissão de ${u.email}`}
                                  className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                                >
                                  <option value="user">Usuário</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              </td>
                              <td className="p-4">
                                <select
                                  value={u.plan}
                                  onChange={(e) =>
                                    void handleUserUpdate(u, { plan: e.target.value as PlanId })
                                  }
                                  aria-label={`Plano de ${u.email}`}
                                  className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs text-sky-300 uppercase"
                                >
                                  <option value="free">Free</option>
                                  <option value="monthly">Mensal</option>
                                  <option value="quarterly">Trimestral</option>
                                  <option value="annual">Anual</option>
                                </select>
                              </td>
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
                                  onClick={() => void handleUserUpdate(u, { blocked: !u.blocked })}
                                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                                >
                                  {u.blocked ? 'Desbloquear' : 'Bloquear'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LOGS, INTEGRATIONS & DIAGNOSTICS */}
              {activeTab === 'logs' && (
                <AdminDiagnosticsTab
                  integrations={integrations}
                  logs={logs}
                  diagnostics={diagnostics}
                  testingTarget={testingTarget}
                  onRunDiagnostic={(target) => void handleRunDiagnostic(target)}
                  onRunAllDiagnostics={() => void handleRunAllDiagnostics()}
                  onExportBackup={handleExportBackup}
                  onClearCache={() => void handleClearCache()}
                  onSyncCatalog={() => void handleSyncCatalog()}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
