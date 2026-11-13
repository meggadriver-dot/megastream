import { buildTmdbImageUrl } from '../../shared/playerUrl';
import { deduplicateMediaByTmdbId, filterAndSortMedia } from '../../shared/catalogUtils';
import type {
  CastMember,
  GenreItem,
  MediaDetail,
  MediaItem,
  MediaType,
  PaginatedCatalogResponse,
  SeasonDetail,
  VideoItem,
} from '../../shared/types';
import {
  DEMO_MEDIA_CATALOG,
  DEMO_MOVIE_GENRES,
  DEMO_TV_GENRES,
  getDemoMediaDetail,
  getDemoSeasonDetail,
} from '../data/demoCatalog';
import { repositoryStore } from '../repositories/interfaces';
import { CacheService } from './CacheService';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TmdbRawMedia {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: GenreItem[];
  original_language?: string;
  origin_country?: string[];
  adult?: boolean;
}

class TMDBServiceImpl {
  private imageBaseUrl = 'https://image.tmdb.org/t/p/';

  isConfigured(): boolean {
    const token = process.env.TMDB_ACCESS_TOKEN?.trim();
    return Boolean(token && token !== 'MY_TMDB_ACCESS_TOKEN');
  }

  private getToken(): string | null {
    const token = process.env.TMDB_ACCESS_TOKEN?.trim();
    if (!token || token === 'MY_TMDB_ACCESS_TOKEN') return null;
    return token;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('TMDB_ACCESS_TOKEN não configurado');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    if (!params.language) {
      url.searchParams.set('language', 'pt-BR');
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    const cacheKey = `tmdb:${url.toString()}`;
    const cached = CacheService.get<T>(cacheKey);
    if (cached) return cached;

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      repositoryStore.addLog({
        level: 'error',
        service: 'TMDBService',
        message: `Erro TMDB ${response.status} em ${endpoint}: ${body.slice(0, 160)}`,
      });
      throw new Error(`TMDB API retornou status ${response.status}`);
    }

    const data = (await response.json()) as T;
    CacheService.set(cacheKey, data, 10 * 60 * 1000);
    return data;
  }

  async ensureImageConfig(): Promise<string> {
    if (!this.isConfigured()) return this.imageBaseUrl;
    const cached = CacheService.get<string>('tmdb:image_base_url');
    if (cached) return cached;
    try {
      const cfg = await this.request<{ images?: { secure_base_url?: string } }>('/configuration', {});
      if (cfg.images?.secure_base_url) {
        this.imageBaseUrl = cfg.images.secure_base_url;
        CacheService.set('tmdb:image_base_url', this.imageBaseUrl, 60 * 60 * 1000);
      }
    } catch {
      // Retain official default
    }
    return this.imageBaseUrl;
  }

  private mapMedia(raw: TmdbRawMedia, forcedType?: MediaType): MediaItem {
    const mediaType: MediaType =
      forcedType ?? (raw.media_type === 'tv' ? 'tv' : 'movie');
    const releaseDate = raw.release_date ?? raw.first_air_date ?? '';
    return {
      id: raw.id,
      tmdbId: raw.id,
      mediaType,
      title: raw.title ?? raw.name ?? 'Sem título',
      originalTitle: raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? '',
      overview: raw.overview || 'Sinopse indisponível no momento.',
      posterPath: buildTmdbImageUrl(raw.poster_path, 'w500', this.imageBaseUrl),
      backdropPath: buildTmdbImageUrl(raw.backdrop_path, 'w1280', this.imageBaseUrl),
      releaseDate,
      releaseYear: releaseDate ? releaseDate.slice(0, 4) : '',
      voteAverage: Number((raw.vote_average ?? 0).toFixed(1)),
      voteCount: raw.vote_count ?? 0,
      popularity: raw.popularity ?? 0,
      genreIds: raw.genre_ids ?? (raw.genres ? raw.genres.map((g) => g.id) : []),
      genres: raw.genres,
      originalLanguage: raw.original_language ?? 'en',
      originCountry: raw.origin_country ?? [],
      adult: raw.adult ?? false,
      source: 'tmdb',
    };
  }

  async getGenres(mediaType: MediaType): Promise<GenreItem[]> {
    if (!this.isConfigured()) {
      return mediaType === 'movie' ? DEMO_MOVIE_GENRES : DEMO_TV_GENRES;
    }
    const res = await this.request<{ genres: GenreItem[] }>(`/genre/${mediaType}/list`);
    return res.genres ?? [];
  }

  async getMovieList(
    category: 'popular' | 'now_playing' | 'top_rated' | 'upcoming',
    page = 1
  ): Promise<PaginatedCatalogResponse> {
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
        mediaType: 'movie',
        sortBy: category === 'top_rated' ? 'rating' : category === 'upcoming' ? 'release_date' : 'popularity',
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(`/movie/${category}`, { page });

    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, 'movie'))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async getSeriesList(
    category: 'popular' | 'top_rated' | 'on_the_air' | 'airing_today',
    page = 1
  ): Promise<PaginatedCatalogResponse> {
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
        mediaType: 'tv',
        sortBy: category === 'top_rated' ? 'rating' : category === 'airing_today' ? 'release_date' : 'popularity',
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(`/tv/${category}`, { page });

    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, 'tv'))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async getTrending(page = 1): Promise<PaginatedCatalogResponse> {
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, { sortBy: 'popularity', page, pageSize: 20 });
      return { ...subset, source: 'demo', demoMode: true };
    }
    await this.ensureImageConfig();
    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>('/trending/all/week', { page });

    const valid = (res.results ?? []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
    return {
      items: deduplicateMediaByTmdbId(valid.map((r) => this.mapMedia(r))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async discover(params: {
    mediaType: 'all' | 'movie' | 'tv';
    genreId?: number | null;
    year?: number | null;
    minRating?: number | null;
    language?: string | null;
    country?: string | null;
    sortBy?: 'popularity' | 'rating' | 'release_date';
    query?: string;
    page?: number;
  }): Promise<PaginatedCatalogResponse> {
    const page = Math.max(1, params.page ?? 1);

    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
        ...params,
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    if (params.query && params.query.trim().length > 0) {
      return this.search(params.query.trim(), params.mediaType, page);
    }

    const buildDiscoverQuery = (targetType: MediaType): Record<string, string | number | undefined> => {
      const sortMap: Record<string, string> = {
        popularity: 'popularity.desc',
        rating: 'vote_average.desc',
        release_date: targetType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
      };
      const q: Record<string, string | number | undefined> = {
        page,
        sort_by: sortMap[params.sortBy ?? 'popularity'] ?? 'popularity.desc',
        with_genres: params.genreId ?? undefined,
        'vote_average.gte': params.minRating ?? undefined,
        'vote_count.gte': params.sortBy === 'rating' ? 100 : undefined,
        with_original_language: params.language && params.language !== 'all' ? params.language : undefined,
        with_origin_country: params.country && params.country !== 'all' ? params.country : undefined,
      };
      if (params.year) {
        if (targetType === 'movie') q.primary_release_year = params.year;
        else q.first_air_date_year = params.year;
      }
      return q;
    };

    if (params.mediaType === 'all') {
      const [movieRes, tvRes] = await Promise.all([
        this.request<{
          results: TmdbRawMedia[];
          page: number;
          total_pages: number;
          total_results: number;
        }>('/discover/movie', buildDiscoverQuery('movie')),
        this.request<{
          results: TmdbRawMedia[];
          page: number;
          total_pages: number;
          total_results: number;
        }>('/discover/tv', buildDiscoverQuery('tv')),
      ]);

      const merged = deduplicateMediaByTmdbId([
        ...(movieRes.results ?? []).map((r) => this.mapMedia(r, 'movie')),
        ...(tvRes.results ?? []).map((r) => this.mapMedia(r, 'tv')),
      ]).sort((a, b) => {
        if (params.sortBy === 'rating') return b.voteAverage - a.voteAverage;
        if (params.sortBy === 'release_date') return (b.releaseDate || '').localeCompare(a.releaseDate || '');
        return b.popularity - a.popularity;
      });

      return {
        items: merged,
        page,
        totalPages: Math.min(Math.max(movieRes.total_pages ?? 1, tvRes.total_pages ?? 1), 500),
        totalResults: (movieRes.total_results ?? 0) + (tvRes.total_results ?? 0),
        source: 'tmdb',
        demoMode: false,
      };
    }

    const targetType: MediaType = params.mediaType === 'tv' ? 'tv' : 'movie';
    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(`/discover/${targetType}`, buildDiscoverQuery(targetType));

    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, targetType))),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async search(
    query: string,
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    page = 1
  ): Promise<PaginatedCatalogResponse> {
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(DEMO_MEDIA_CATALOG, {
        mediaType,
        query,
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    const endpoint =
      mediaType === 'movie'
        ? '/search/movie'
        : mediaType === 'tv'
          ? '/search/tv'
          : '/search/multi';

    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(endpoint, { query, page, include_adult: 'false' });

    const valid = (res.results ?? []).filter((r) =>
      mediaType === 'all' ? r.media_type === 'movie' || r.media_type === 'tv' : true
    );

    return {
      items: deduplicateMediaByTmdbId(
        valid.map((r) => this.mapMedia(r, mediaType === 'all' ? undefined : mediaType))
      ),
      page: res.page ?? page,
      totalPages: Math.min(res.total_pages ?? 1, 500),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async getDetail(tmdbId: number, mediaType: MediaType): Promise<MediaDetail | null> {
    if (!this.isConfigured()) {
      return getDemoMediaDetail(tmdbId, mediaType);
    }

    await this.ensureImageConfig();
    interface TmdbDetailPayload extends TmdbRawMedia {
      runtime?: number;
      episode_run_time?: number[];
      status?: string;
      tagline?: string;
      number_of_seasons?: number;
      number_of_episodes?: number;
      seasons?: Array<{
        id: number;
        season_number: number;
        name: string;
        overview: string;
        poster_path: string | null;
        episode_count: number;
        air_date: string;
      }>;
      credits?: {
        cast?: Array<{ id: number; name: string; character: string; profile_path: string | null }>;
        crew?: Array<{ job: string; name: string }>;
      };
      videos?: {
        results?: Array<{ id: string; key: string; name: string; site: string; type: string; official: boolean }>;
      };
      recommendations?: { results?: TmdbRawMedia[] };
      similar?: { results?: TmdbRawMedia[] };
    }

    const raw = await this.request<TmdbDetailPayload>(`/${mediaType}/${tmdbId}`, {
      append_to_response: 'credits,videos,recommendations,similar',
    });

    const base = this.mapMedia(raw, mediaType);
    const director =
      raw.credits?.crew?.find((c) => c.job === 'Director' || c.job === 'Creator')?.name ?? null;

    const cast: CastMember[] = (raw.credits?.cast ?? []).slice(0, 14).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: buildTmdbImageUrl(c.profile_path, 'w185', this.imageBaseUrl),
    }));

    const videos: VideoItem[] = (raw.videos?.results ?? []).filter((v) => v.site === 'YouTube');
    const recommendations = deduplicateMediaByTmdbId(
      (raw.recommendations?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );
    const similar = deduplicateMediaByTmdbId(
      (raw.similar?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );

    return {
      ...base,
      runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
      status: raw.status ?? '',
      tagline: raw.tagline ?? '',
      director,
      cast,
      videos,
      recommendations,
      similar,
      numberOfSeasons: raw.number_of_seasons,
      numberOfEpisodes: raw.number_of_episodes,
      seasons: (raw.seasons ?? []).map((s) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: buildTmdbImageUrl(s.poster_path, 'w342', this.imageBaseUrl),
        episodeCount: s.episode_count,
        airDate: s.air_date ?? '',
      })),
    };
  }

  async getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<SeasonDetail> {
    if (!this.isConfigured()) {
      return getDemoSeasonDetail(tmdbId, seasonNumber);
    }
    await this.ensureImageConfig();
    const raw = await this.request<{
      id: number;
      season_number: number;
      name: string;
      overview: string;
      poster_path: string | null;
      air_date: string;
      episodes?: Array<{
        id: number;
        episode_number: number;
        season_number: number;
        name: string;
        overview: string;
        still_path: string | null;
        runtime: number | null;
        air_date: string;
        vote_average: number;
      }>;
    }>(`/tv/${tmdbId}/season/${seasonNumber}`);

    const episodes = (raw.episodes ?? []).map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name,
      overview: ep.overview || 'Descrição do episódio indisponível.',
      stillPath: buildTmdbImageUrl(ep.still_path, 'w500', this.imageBaseUrl),
      runtime: ep.runtime,
      airDate: ep.air_date ?? '',
      voteAverage: Number((ep.vote_average ?? 0).toFixed(1)),
    }));

    return {
      id: raw.id,
      seasonNumber: raw.season_number,
      name: raw.name,
      overview: raw.overview,
      posterPath: buildTmdbImageUrl(raw.poster_path, 'w342', this.imageBaseUrl),
      episodeCount: episodes.length,
      airDate: raw.air_date ?? '',
      episodes,
    };
  }
}

export const TMDBService = new TMDBServiceImpl();
