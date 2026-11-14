import { sanitizePlainText } from '../../shared/catalogUtils.ts';
import { normalizeTmdbId, validateMegaEmbedPlayer } from '../../shared/playerUrl.ts';
import type { HistoryItem, MediaType, MegaEmbedPlayer } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

class HistoryServiceImpl {
  list(userId: string): HistoryItem[] {
    return repositoryStore.getHistory(userId);
  }

  record(
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
    }
  ): HistoryItem {
    const validId = normalizeTmdbId(payload.tmdbId);
    if (!validId) {
      throw new Error('ID TMDB inválido para histórico.');
    }

    const clampedProgress = Math.max(
      0,
      Math.min(100, Number.isFinite(payload.progressPercent) ? Number(payload.progressPercent) : 15)
    );

    const item: HistoryItem = {
      id: `${payload.mediaType}_${validId}`,
      userId,
      tmdbId: validId,
      mediaType: payload.mediaType === 'tv' ? 'tv' : 'movie',
      title: sanitizePlainText(payload.title || 'Sem título', 200),
      posterPath: payload.posterPath ?? null,
      backdropPath: payload.backdropPath ?? null,
      progressPercent: clampedProgress,
      seasonNumber: payload.seasonNumber,
      episodeNumber: payload.episodeNumber,
      playerProvider: payload.playerProvider
        ? validateMegaEmbedPlayer(payload.playerProvider)
        : undefined,
      watchedAt: new Date().toISOString(),
    };

    return repositoryStore.upsertHistory(item);
  }
}

export const HistoryService = new HistoryServiceImpl();
