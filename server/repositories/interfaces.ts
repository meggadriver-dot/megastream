import fs from 'node:fs';
import path from 'node:path';
import type {
  FavoriteItem,
  HistoryItem,
  LiveChannel,
  SubscriptionRecord,
  SystemLogEntry,
  UserProfile,
} from '../../shared/types';

export interface IRepositoryStore {
  getUsers(): UserProfile[];
  getUser(uid: string): UserProfile | null;
  upsertUser(user: UserProfile): UserProfile;
  getFavorites(userId: string): FavoriteItem[];
  addFavorite(item: FavoriteItem): FavoriteItem;
  removeFavorite(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean;
  getHistory(userId: string): HistoryItem[];
  upsertHistory(item: HistoryItem): HistoryItem;
  getChannels(): LiveChannel[];
  upsertChannel(channel: LiveChannel): LiveChannel;
  deleteChannel(id: string): boolean;
  getSubscription(userId: string): SubscriptionRecord | null;
  upsertSubscription(sub: SubscriptionRecord): SubscriptionRecord;
  getAllSubscriptions(): SubscriptionRecord[];
  addLog(entry: Omit<SystemLogEntry, 'id' | 'timestamp'>): SystemLogEntry;
  getLogs(limit?: number): SystemLogEntry[];
  getTotalPlaybacks(): number;
  incrementPlaybackCounter(): void;
  getLastSyncAt(): string | null;
  setLastSyncAt(iso: string): void;
}

interface PersistedState {
  users: Record<string, UserProfile>;
  favorites: Record<string, FavoriteItem[]>;
  history: Record<string, HistoryItem[]>;
  channels: Record<string, LiveChannel>;
  subscriptions: Record<string, SubscriptionRecord>;
  logs: SystemLogEntry[];
  totalPlaybacks: number;
  lastSyncAt: string | null;
}

const DATA_FILE = path.resolve(process.cwd(), '.megastream-store.json');

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
      favorites: {},
      history: {},
      channels: {},
      subscriptions: {},
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
