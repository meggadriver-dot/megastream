export type MediaType = 'movie' | 'tv';

export type ThemeId =
  | 'cinematografico'
  | 'neon-roxo'
  | 'minimalista'
  | 'gold-premium'
  | '3d-glass';

export type MegaEmbedDomain = 'mgeb.lat' | 'mgeb.space';

export type MegaEmbedPlayer = 'vidstack' | 'megaplay' | 'megatube' | 'clappr';

export type ChannelCategory =
  | 'Notícias'
  | 'Esportes'
  | 'Entretenimento'
  | 'Filmes'
  | 'Variedades'
  | 'Infantil';

export type PlanId = 'free' | 'monthly' | 'quarterly' | 'annual';

export interface GenreItem {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  releaseYear: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  genres?: GenreItem[];
  originalLanguage: string;
  originCountry?: string[];
  adult?: boolean;
  source: 'tmdb' | 'demo';
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface VideoItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface EpisodeItem {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtime: number | null;
  airDate: string;
  voteAverage: number;
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodeCount: number;
  airDate: string;
}

export interface SeasonDetail extends SeasonSummary {
  episodes: EpisodeItem[];
}

export interface MediaDetail extends MediaItem {
  runtime: number | null;
  status: string;
  tagline: string;
  director: string | null;
  cast: CastMember[];
  videos: VideoItem[];
  recommendations: MediaItem[];
  similar: MediaItem[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: SeasonSummary[];
}

export interface PaginatedCatalogResponse {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
  source: 'tmdb' | 'demo';
  demoMode: boolean;
}

export interface PlayerConfig {
  defaultDomain: MegaEmbedDomain;
  availableDomains: MegaEmbedDomain[];
  defaultPlayer: MegaEmbedPlayer;
  availablePlayers: MegaEmbedPlayer[];
  defaultColorHex: string;
  seriesSeasonEpisodeDocumented: boolean;
  seriesLimitationNote: string;
}

export interface EmbedPlayResponse {
  tmdbId: number;
  mediaType: MediaType;
  embedUrl: string;
  domain: MegaEmbedDomain;
  player: MegaEmbedPlayer;
  colorHex: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesSupportNote?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  plan: PlanId;
  role: 'user' | 'admin';
  blocked: boolean;
  preferredTheme: ThemeId;
  preferredLanguage: string;
  preferredQuality: string;
  parentalControl: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AvatarCategory = 'todos' | 'desenhos' | 'series' | 'filmes' | 'infantil';

export interface AvatarPresetMeta {
  id: string;
  label: string;
  category: Exclude<AvatarCategory, 'todos'>;
  fallbackPath: string;
}

export interface StreamProfile {
  id: string;
  userId: string;
  name: string;
  avatarId: string;
  avatarUrl: string;
  hasPin: boolean;
  isKids: boolean;
  preferredTheme: ThemeId;
  preferredLanguage: string;
  preferredQuality: string;
  autoplayNext: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredStreamProfile extends StreamProfile {
  pinHash?: string;
}

export interface FavoriteItem {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseYear: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  progressPercent: number;
  seasonNumber?: number;
  episodeNumber?: number;
  playerProvider?: MegaEmbedPlayer;
  watchedAt: string;
}

export interface LiveChannel {
  id: string;
  name: string;
  category: ChannelCategory;
  streamUrl: string;
  logoUrl?: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: Exclude<PlanId, 'free'>;
  name: string;
  subtitle: string;
  priceBrl: number;
  billingLabel: string;
  periodDays: number;
  popular?: boolean;
  benefits: string[];
}

export interface SubscriptionRecord {
  userId: string;
  planId: Exclude<PlanId, 'free'>;
  status: 'pending_gateway' | 'active' | 'canceled' | 'expired';
  amountBrl: number;
  expiresAt?: string;
  gatewayReady: boolean;
  gatewayNotice: string;
  updatedAt: string;
}

export interface SystemLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  message: string;
  timestamp: string;
}

export interface IntegrationStatus {
  tmdbConfigured: boolean;
  geminiConfigured: boolean;
  firebaseConfigured: boolean;
  megaEmbedConfigured: boolean;
  paymentGatewayConfigured: boolean;
  demoMode: boolean;
  cacheEntries: number;
  lastSyncAt: string | null;
  catalogSyncedCount: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  catalogMovies: number;
  catalogSeries: number;
  totalPlaybacks: number;
  activeSubscriptions: number;
  channelsCount: number;
  usageSeries: { label: string; playbacks: number; searches: number }[];
}

export interface AIRecommendationResponse {
  summary: string;
  strategyNote: string;
  suggestedQueries: string[];
  items: MediaItem[];
  source: 'gemini+tmdb' | 'gemini+demo' | 'fallback';
}
