import { sanitizePlainText } from '../../shared/catalogUtils.ts';
import { normalizeTmdbId } from '../../shared/playerUrl.ts';
import type { FavoriteItem, MediaType } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

class FavoritesServiceImpl {
  list(userId: string, mediaType?: 'all' | MediaType): FavoriteItem[] {
    const items = repositoryStore.getFavorites(userId);
    if (!mediaType || mediaType === 'all') return items;
    return items.filter((item) => item.mediaType === mediaType);
  }

  add(
    userId: string,
    payload: {
      tmdbId: number;
      mediaType: MediaType;
      title: string;
      posterPath?: string | null;
      voteAverage?: number;
      releaseYear?: string;
    }
  ): FavoriteItem {
    const validId = normalizeTmdbId(payload.tmdbId);
    if (!validId) {
      throw new Error('ID TMDB inválido para favoritar.');
    }
    const item: FavoriteItem = {
      id: `${payload.mediaType}_${validId}`,
      userId,
      tmdbId: validId,
      mediaType: payload.mediaType === 'tv' ? 'tv' : 'movie',
      title: sanitizePlainText(payload.title || 'Sem título', 200),
      posterPath: payload.posterPath ?? null,
      voteAverage: Number(payload.voteAverage ?? 0),
      releaseYear: sanitizePlainText(payload.releaseYear ?? '', 10),
      createdAt: new Date().toISOString(),
    };
    return repositoryStore.addFavorite(item);
  }

  remove(userId: string, tmdbId: number, mediaType: MediaType): boolean {
    return repositoryStore.removeFavorite(userId, tmdbId, mediaType);
  }
}

export const FavoritesService = new FavoritesServiceImpl();
