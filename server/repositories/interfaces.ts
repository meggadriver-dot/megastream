import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SITE_CONFIG } from '../../shared/siteConfigUtils.ts';
import { DEFAULT_SYSTEM_SETTINGS } from '../../shared/systemSettingsUtils.ts';
import type {
  CustomMediaItem,
  FavoriteItem,
  HistoryItem,
  LiveChannel,
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerAspectMode,
  PlayerSourceMode,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  SiteConfig,
  StoredStreamProfile,
  SubscriptionRecord,
  SystemLogEntry,
  SystemSettings,
  UserProfile,
  WatchaFlixLang,
  WatermarkPosition,
  WatermarkSize,
} from '../../shared/types.ts';

export interface StoredPlayerSettings {
  sourceMode?: PlayerSourceMode;
  defaultDomain: MegaEmbedDomain;
  fallbackDomain?: MegaEmbedDomain;
  autoFallback?: boolean;
  defaultPlayer: MegaEmbedPlayer;
  defaultColorHex: string;
  myembedBaseUrl?: string;
  antiAdSandbox?: boolean;
  preferImdbForMovies?: boolean;
  watchaflixBaseUrl?: string;
  watchaflixLang?: WatchaFlixLang;
  customEmbedMovieTemplate?: string;
  customEmbedTvTemplate?: string;
  embedTimeoutSeconds?: number;
  defaultAspectMode?: PlayerAspectMode;
  autoEnableSubtitles?: boolean;
  defaultSubtitleSize?: PlayerSubtitleSize;
  defaultSubtitleColor?: PlayerSubtitleColor;
  defaultSubtitleBg?: PlayerSubtitleBg;
  allowTvCast?: boolean;
  allowPipMode?: boolean;
  allowTheaterMode?: boolean;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkLogoUrl?: string;
  watermarkPosition?: WatermarkPosition;
  watermarkOpacity?: number;
  watermarkSize?: WatermarkSize;
  autoNextEpisode?: boolean;
  autoNextCountdownSeconds?: number;
  updatedAt?: string;
}

export interface StoredAdminSecrets {
  tmdbAccessToken?: string;
  geminiApiKey?: string;
  updatedAt?: string;
}

export interface IRepositoryStore {
  getUsers(): UserProfile[];
  getUser(uid: string): UserProfile | null;
  upsertUser(user: UserProfile): UserProfile;
  getProfiles(userId: string): StoredStreamProfile[];
  upsertProfile(profile: StoredStreamProfile): StoredStreamProfile;
  deleteProfile(userId: string, profileId: string): boolean;
  getFavorites(userId: string): FavoriteItem[];
  addFavorite(item: FavoriteItem): FavoriteItem;
  removeFavorite(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean;
  getHistory(userId: string): HistoryItem[];
  upsertHistory(item: HistoryItem): HistoryItem;
  removeHistory(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean;
  getChannels(): LiveChannel[];
  upsertChannel(channel: LiveChannel): LiveChannel;
  deleteChannel(id: string): boolean;
  getSubscription(userId: string): SubscriptionRecord | null;
  upsertSubscription(sub: SubscriptionRecord): SubscriptionRecord;
  getAllSubscriptions(): SubscriptionRecord[];
  getSiteConfig(): SiteConfig;
  saveSiteConfig(config: SiteConfig): SiteConfig;
  getPlayerSettings(): StoredPlayerSettings | null;
  savePlayerSettings(settings: StoredPlayerSettings): StoredPlayerSettings;
  getSystemSettings(): SystemSettings;
  saveSystemSettings(settings: SystemSettings): SystemSettings;
  getAdminSecrets(): StoredAdminSecrets;
  saveAdminSecrets(secrets: StoredAdminSecrets): StoredAdminSecrets;
  getCustomCatalog(): CustomMediaItem[];
  upsertCustomMedia(item: CustomMediaItem): CustomMediaItem;
  deleteCustomMedia(id: string): boolean;
  addLog(entry: Omit<SystemLogEntry, 'id' | 'timestamp'>): SystemLogEntry;
  getLogs(limit?: number): SystemLogEntry[];
  getTotalPlaybacks(): number;
  incrementPlaybackCounter(): void;
  getLastSyncAt(): string | null;
  setLastSyncAt(iso: string): void;
}

interface PersistedState {
  users: Record<string, UserProfile>;
  profiles: Record<string, StoredStreamProfile[]>;
  favorites: Record<string, FavoriteItem[]>;
  history: Record<string, HistoryItem[]>;
  channels: Record<string, LiveChannel>;
  subscriptions: Record<string, SubscriptionRecord>;
  siteConfig?: SiteConfig;
  playerSettings?: StoredPlayerSettings;
  systemSettings?: SystemSettings;
  adminSecrets?: StoredAdminSecrets;
  customCatalog?: Record<string, CustomMediaItem>;
  logs: SystemLogEntry[];
  totalPlaybacks: number;
  lastSyncAt: string | null;
}

const DATA_FILE = process.env.VERCEL
  ? '/tmp/.megastream-store.json'
  : path.resolve(process.cwd(), '.megastream-store.json');

class JsonRepositoryStore implements IRepositoryStore {
  private state: PersistedState;

  constructor() {
    this.state = this.load();
  }

  private load(): PersistedState {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw) as PersistedState;
      }
    } catch {
      // Fallback to fresh store
    }
    return {
      users: {},
      profiles: {},
      favorites: {},
      history: {},
      channels: {},
      subscriptions: {},
      siteConfig: { ...DEFAULT_SITE_CONFIG },
      systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
      adminSecrets: {},
      customCatalog: {},
      logs: [
        {
          id: 'boot-1',
          level: 'info',
          service: 'System',
          message: 'MegaStream API inicializada com arquitetura modular pronta para Firestore e PostgreSQL.',
          timestamp: new Date().toISOString(),
        },
      ],
      totalPlaybacks: 0,
      lastSyncAt: null,
    };
  }

  private save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // Non-fatal in read-only environments
    }
  }

  getUsers(): UserProfile[] {
    return Object.values(this.state.users);
  }

  getUser(uid: string): UserProfile | null {
    return this.state.users[uid] ?? null;
  }

  upsertUser(user: UserProfile): UserProfile {
    this.state.users[user.uid] = user;
    this.save();
    return user;
  }

  getProfiles(userId: string): StoredStreamProfile[] {
    return (this.state.profiles ?? {})[userId] ?? [];
  }

  upsertProfile(profile: StoredStreamProfile): StoredStreamProfile {
    if (!this.state.profiles) this.state.profiles = {};
    const list = this.state.profiles[profile.userId] ?? [];
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = profile;
      this.state.profiles[profile.userId] = next;
    } else {
      this.state.profiles[profile.userId] = [...list, profile];
    }
    this.save();
    return profile;
  }

  deleteProfile(userId: string, profileId: string): boolean {
    if (!this.state.profiles) return false;
    const list = this.state.profiles[userId] ?? [];
    const next = list.filter((p) => p.id !== profileId);
    const removed = next.length !== list.length;
    this.state.profiles[userId] = next;
    this.save();
    return removed;
  }

  getFavorites(userId: string): FavoriteItem[] {
    return this.state.favorites[userId] ?? [];
  }

  addFavorite(item: FavoriteItem): FavoriteItem {
    const list = this.state.favorites[item.userId] ?? [];
    const filtered = list.filter(
      (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
    );
    this.state.favorites[item.userId] = [item, ...filtered];
    this.save();
    return item;
  }

  removeFavorite(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean {
    const list = this.state.favorites[userId] ?? [];
    const next = list.filter((f) => !(f.tmdbId === tmdbId && f.mediaType === mediaType));
    const removed = next.length !== list.length;
    this.state.favorites[userId] = next;
    this.save();
    return removed;
  }

  getHistory(userId: string): HistoryItem[] {
    return this.state.history[userId] ?? [];
  }

  upsertHistory(item: HistoryItem): HistoryItem {
    const list = this.state.history[item.userId] ?? [];
    const filtered = list.filter(
      (h) => !(h.tmdbId === item.tmdbId && h.mediaType === item.mediaType)
    );
    this.state.history[item.userId] = [item, ...filtered].slice(0, 100);
    this.save();
    return item;
  }

  removeHistory(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean {
    const list = this.state.history[userId] ?? [];
    const next = list.filter((h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType));
    const removed = next.length !== list.length;
    this.state.history[userId] = next;
    this.save();
    return removed;
  }

  getChannels(): LiveChannel[] {
    return Object.values(this.state.channels).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  upsertChannel(channel: LiveChannel): LiveChannel {
    this.state.channels[channel.id] = channel;
    this.save();
    return channel;
  }

  deleteChannel(id: string): boolean {
    if (!this.state.channels[id]) return false;
    delete this.state.channels[id];
    this.save();
    return true;
  }

  getSubscription(userId: string): SubscriptionRecord | null {
    return this.state.subscriptions[userId] ?? null;
  }

  upsertSubscription(sub: SubscriptionRecord): SubscriptionRecord {
    this.state.subscriptions[sub.userId] = sub;
    this.save();
    return sub;
  }

  getAllSubscriptions(): SubscriptionRecord[] {
    return Object.values(this.state.subscriptions);
  }

  getSiteConfig(): SiteConfig {
    return this.state.siteConfig ?? { ...DEFAULT_SITE_CONFIG };
  }

  saveSiteConfig(config: SiteConfig): SiteConfig {
    this.state.siteConfig = config;
    this.save();
    return config;
  }

  getPlayerSettings(): StoredPlayerSettings | null {
    return this.state.playerSettings ?? null;
  }

  savePlayerSettings(settings: StoredPlayerSettings): StoredPlayerSettings {
    this.state.playerSettings = settings;
    this.save();
    return settings;
  }

  getSystemSettings(): SystemSettings {
    return this.state.systemSettings ?? { ...DEFAULT_SYSTEM_SETTINGS };
  }

  saveSystemSettings(settings: SystemSettings): SystemSettings {
    this.state.systemSettings = settings;
    this.save();
    return settings;
  }

  getAdminSecrets(): StoredAdminSecrets {
    return this.state.adminSecrets ?? {};
  }

  saveAdminSecrets(secrets: StoredAdminSecrets): StoredAdminSecrets {
    this.state.adminSecrets = secrets;
    this.save();
    return secrets;
  }

  getCustomCatalog(): CustomMediaItem[] {
    return Object.values(this.state.customCatalog ?? {}).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  upsertCustomMedia(item: CustomMediaItem): CustomMediaItem {
    if (!this.state.customCatalog) this.state.customCatalog = {};
    this.state.customCatalog[item.id] = item;
    this.save();
    return item;
  }

  deleteCustomMedia(id: string): boolean {
    if (!this.state.customCatalog?.[id]) return false;
    delete this.state.customCatalog[id];
    this.save();
    return true;
  }

  addLog(entry: Omit<SystemLogEntry, 'id' | 'timestamp'>): SystemLogEntry {
    const log: SystemLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.state.logs = [log, ...this.state.logs].slice(0, 250);
    this.save();
    return log;
  }

  getLogs(limit = 100): SystemLogEntry[] {
    return this.state.logs.slice(0, limit);
  }

  getTotalPlaybacks(): number {
    return this.state.totalPlaybacks;
  }

  incrementPlaybackCounter(): void {
    this.state.totalPlaybacks += 1;
    this.save();
  }

  getLastSyncAt(): string | null {
    return this.state.lastSyncAt;
  }

  setLastSyncAt(iso: string): void {
    this.state.lastSyncAt = iso;
    this.save();
  }
}

export const repositoryStore: IRepositoryStore = new JsonRepositoryStore();
