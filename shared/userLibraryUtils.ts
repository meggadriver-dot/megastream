import { sanitizePlainText } from './catalogUtils.ts';
import { normalizeTmdbId, validateMegaEmbedPlayer } from './playerUrl.ts';
import { toIsoTimestamp } from './siteConfigUtils.ts';
import type { FavoriteItem, HistoryItem, MediaType, MegaEmbedPlayer } from './types.ts';

export function buildFavoriteRecord(
  userId: string,
  item: {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string | null;
    voteAverage?: number;
    releaseYear?: string;
    createdAt?: unknown;
  }
): FavoriteItem {
  const validId = normalizeTmdbId(item.tmdbId) ?? Math.max(1, Math.floor(Number(item.tmdbId) || 1));
  const mediaType: MediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
  const cleanTitle = sanitizePlainText(item.title || 'Título', 200) || 'Título';
  const rawVote = Number(item.voteAverage ?? 0);
  const voteAverage = Number.isFinite(rawVote)
    ? Math.max(0, Math.min(10, Number(rawVote.toFixed(1))))
    : 0;

  return {
    id: `${mediaType}_${validId}`,
    userId,
    tmdbId: validId,
    mediaType,
    title: cleanTitle,
    posterPath: item.posterPath ? String(item.posterPath).slice(0, 400) : null,
    voteAverage,
    releaseYear: sanitizePlainText(item.releaseYear ?? '', 10),
    createdAt: toIsoTimestamp(item.createdAt, new Date().toISOString()),
  };
}

export function buildHistoryRecord(
  userId: string,
  payload: {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    progressPercent?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    playerProvider?: MegaEmbedPlayer;
    watchedAt?: unknown;
  }
): HistoryItem {
  const validId = normalizeTmdbId(payload.tmdbId) ?? Math.max(1, Math.floor(Number(payload.tmdbId) || 1));
  const mediaType: MediaType = payload.mediaType === 'tv' ? 'tv' : 'movie';
  const cleanTitle = sanitizePlainText(payload.title || 'Título', 200) || 'Título';
  const rawProgress = Number(payload.progressPercent ?? 15);
  const progressPercent = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : 15;

  const seasonNumber =
    mediaType === 'tv' && Number.isFinite(payload.seasonNumber)
      ? Math.max(0, Math.floor(Number(payload.seasonNumber)))
      : undefined;
  const episodeNumber =
    mediaType === 'tv' && Number.isFinite(payload.episodeNumber)
      ? Math.max(0, Math.floor(Number(payload.episodeNumber)))
      : undefined;

  return {
    id: `${mediaType}_${validId}`,
    userId,
    tmdbId: validId,
    mediaType,
    title: cleanTitle,
    posterPath: payload.posterPath ? String(payload.posterPath).slice(0, 400) : null,
    backdropPath: payload.backdropPath ? String(payload.backdropPath).slice(0, 400) : null,
    progressPercent,
    seasonNumber,
    episodeNumber,
    playerProvider: payload.playerProvider
      ? validateMegaEmbedPlayer(payload.playerProvider)
      : 'vidstack',
    watchedAt: toIsoTimestamp(payload.watchedAt, new Date().toISOString()),
  };
}

export function mergeFavoriteLists(
  primary: FavoriteItem[],
  secondary: FavoriteItem[] = []
): FavoriteItem[] {
  const map = new Map<string, FavoriteItem>();
  for (const item of [...secondary, ...primary]) {
    const key = `${item.mediaType}_${item.tmdbId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTs = Date.parse(existing.createdAt) || 0;
      const itemTs = Date.parse(item.createdAt) || 0;
      if (itemTs >= existingTs) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
}

export function mergeHistoryLists(
  primary: HistoryItem[],
  secondary: HistoryItem[] = [],
  limit = 50
): HistoryItem[] {
  const map = new Map<string, HistoryItem>();
  for (const item of [...secondary, ...primary]) {
    const key = `${item.mediaType}_${item.tmdbId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTs = Date.parse(existing.watchedAt) || 0;
      const itemTs = Date.parse(item.watchedAt) || 0;
      if (itemTs >= existingTs) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => (Date.parse(b.watchedAt) || 0) - (Date.parse(a.watchedAt) || 0))
    .slice(0, limit);
}
