import { deduplicateMediaByTmdbId } from '../../shared/catalogUtils.ts';
import { customMediaToMediaItem, mergeCustomCatalogIntoList } from '../../shared/siteConfigUtils.ts';
import type { GenreItem, MediaItem } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { SiteConfigService } from './SiteConfigService.ts';
import { TMDBService } from './TMDBService.ts';

class CatalogServiceImpl {
  private syncedCatalog: MediaItem[] = [];
  private syncedGenres: { movie: GenreItem[]; tv: GenreItem[] } = { movie: [], tv: [] };

  async syncCatalog(): Promise<{ count: number; syncedAt: string; source: 'tmdb' | 'demo' }> {
    const pages = TMDBService.isConfigured() ? [1, 2, 3] : [1];

    const [
      popularMoviesPages,
      topMoviesPages,
      nowPlayingPages,
      upcomingPages,
      popularSeriesPages,
      topSeriesPages,
      onAirSeriesPages,
      trendingPages,
      movieGenres,
      tvGenres,
    ] = await Promise.all([
      Promise.all(pages.map((p) => TMDBService.getMovieList('popular', p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList('top_rated', p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList('now_playing', p))),
      Promise.all(pages.map((p) => TMDBService.getMovieList('upcoming', p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList('popular', p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList('top_rated', p))),
      Promise.all(pages.map((p) => TMDBService.getSeriesList('on_the_air', p))),
      Promise.all(pages.map((p) => TMDBService.getTrending(p))),
      TMDBService.getGenres('movie'),
      TMDBService.getGenres('tv'),
    ]);

    const combined = deduplicateMediaByTmdbId([
      ...trendingPages.flatMap((r) => r.items),
      ...popularMoviesPages.flatMap((r) => r.items),
      ...topMoviesPages.flatMap((r) => r.items),
      ...nowPlayingPages.flatMap((r) => r.items),
      ...upcomingPages.flatMap((r) => r.items),
      ...popularSeriesPages.flatMap((r) => r.items),
      ...topSeriesPages.flatMap((r) => r.items),
      ...onAirSeriesPages.flatMap((r) => r.items),
    ]);

    const source = popularMoviesPages[0]?.source ?? 'demo';
    this.syncedCatalog = combined;
    this.syncedGenres = { movie: movieGenres, tv: tvGenres };

    CacheService.clear('catalog:');

    const syncedAt = new Date().toISOString();
    repositoryStore.setLastSyncAt(syncedAt);
    repositoryStore.addLog({
      level: 'info',
      service: 'CatalogService',
      message: `Sincronização automática concluída: ${combined.length} títulos únicos (${source}).`,
    });

    return {
      count: combined.length,
      syncedAt,
      source,
    };
  }

  async getSyncedCatalog(): Promise<MediaItem[]> {
    if (this.syncedCatalog.length === 0) {
      await this.syncCatalog();
    }
    return this.syncedCatalog;
  }

  async getHomeSections() {
    await SiteConfigService.ensureHydrated();
    const cached = CacheService.get<Record<string, unknown>>('catalog:home');
    if (cached) return cached;

    const [
      trending,
      popularMovies,
      nowPlayingMovies,
      topRatedMovies,
      upcomingMovies,
      popularSeries,
      topRatedSeries,
      onAirSeries,
      movieGenres,
      tvGenres,
    ] = await Promise.all([
      TMDBService.getTrending(1),
      TMDBService.getMovieList('popular', 1),
      TMDBService.getMovieList('now_playing', 1),
      TMDBService.getMovieList('top_rated', 1),
      TMDBService.getMovieList('upcoming', 1),
      TMDBService.getSeriesList('popular', 1),
      TMDBService.getSeriesList('top_rated', 1),
      TMDBService.getSeriesList('on_the_air', 1),
      TMDBService.getGenres('movie'),
      TMDBService.getGenres('tv'),
    ]);

    const customItems = repositoryStore.getCustomCatalog().filter((c) => c.active);
    const featuredCustoms = customItems.filter((c) => c.featured).map(customMediaToMediaItem);

    const mergedTrending = deduplicateMediaByTmdbId([
      ...featuredCustoms,
      ...mergeCustomCatalogIntoList(trending.items, customItems),
    ]);
    const mergedPopularMovies = mergeCustomCatalogIntoList(popularMovies.items, customItems, 'movie');
    const mergedPopularSeries = mergeCustomCatalogIntoList(popularSeries.items, customItems, 'tv');

    const combined = deduplicateMediaByTmdbId([
      ...mergedTrending,
      ...mergedPopularMovies,
      ...mergedPopularSeries,
      ...nowPlayingMovies.items,
      ...topRatedMovies.items,
      ...upcomingMovies.items,
      ...topRatedSeries.items,
      ...onAirSeries.items,
    ]);
    this.syncedCatalog = deduplicateMediaByTmdbId([...this.syncedCatalog, ...combined]);
    this.syncedGenres = { movie: movieGenres, tv: tvGenres };

    const payload = {
      featured: featuredCustoms[0] ?? mergedTrending[0] ?? mergedPopularMovies[0] ?? null,
      trending: mergedTrending,
      popularMovies: mergedPopularMovies,
      nowPlayingMovies: nowPlayingMovies.items,
      topRatedMovies: topRatedMovies.items,
      upcomingMovies: upcomingMovies.items,
      popularSeries: mergedPopularSeries,
      topRatedSeries: topRatedSeries.items,
      onAirSeries: onAirSeries.items,
      genres: {
        movie: movieGenres,
        tv: tvGenres,
      },
      source: popularMovies.source,
      demoMode: popularMovies.demoMode,
    };

    CacheService.set('catalog:home', payload, 5 * 60 * 1000);
    return payload;
  }

  getCachedGenreCount() {
    return this.syncedGenres.movie.length + this.syncedGenres.tv.length;
  }
}

export const CatalogService = new CatalogServiceImpl();
