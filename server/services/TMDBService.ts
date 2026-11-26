import { buildTmdbImageUrl } from '../../shared/playerUrl.ts';
import {
  deduplicateMediaByTmdbId,
  filterAndSortMedia,
  mergeUnifiedTmdbGenres,
  parseCatalogSearchTarget,
  resolveTmdbGenreForMediaType,
} from '../../shared/catalogUtils.ts';
import { customMediaToMediaItem } from '../../shared/siteConfigUtils.ts';
import type {
  CastMember,
  CatalogSortBy,
  DiagnosticResult,
  GenreItem,
  MediaCollectionSummary,
  MediaDetail,
  MediaItem,
  MediaType,
  PaginatedCatalogResponse,
  SeasonDetail,
  VideoItem,
} from '../../shared/types.ts';
import {
  DEMO_MEDIA_CATALOG,
  DEMO_MOVIE_GENRES,
  DEMO_TV_GENRES,
  getDemoMediaDetail,
  getDemoSeasonDetail,
} from '../data/demoCatalog.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { FreeApiProService } from './FreeApiProService.ts';
import { SiteConfigService } from './SiteConfigService.ts';
import { StreamBetterService } from './StreamBetterService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';

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
  private detectedImageBaseUrl: string | null = null;

  private getToken(): string | null {
    return SystemSettingsService.getActiveTmdbToken().token;
  }

  isTokenAvailable(): boolean {
    return Boolean(this.getToken());
  }

  isConfigured(): boolean {
    const settings = SystemSettingsService.getSettings();
    if (settings.catalogSource === 'demo' || settings.catalogSource === 'custom_only') {
      return false;
    }
    return this.isTokenAvailable();
  }

  private isCustomOnly(): boolean {
    return SystemSettingsService.getSettings().catalogSource === 'custom_only';
  }

  private getActiveImageBaseUrl(): string {
    const configured = SystemSettingsService.getSettings().tmdbImageBaseUrl;
    if (configured && configured !== 'https://image.tmdb.org/t/p/') {
      return configured;
    }
    return this.detectedImageBaseUrl || configured || 'https://image.tmdb.org/t/p/';
  }

  private getDemoOrCustomBaseCatalog(): MediaItem[] {
    const customAsMedia = repositoryStore
      .getCustomCatalog()
      .filter((c) => c.active)
      .map(customMediaToMediaItem);
    if (this.isCustomOnly()) {
      return deduplicateMediaByTmdbId(customAsMedia);
    }
    return deduplicateMediaByTmdbId([...customAsMedia, ...DEMO_MEDIA_CATALOG]);
  }

  private async request<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('TMDB_ACCESS_TOKEN não configurado');
    }

    const settings = SystemSettingsService.getSettings();
    const baseUrl = (settings.tmdbBaseUrl || 'https://api.themoviedb.org/3').replace(/\/+$/, '');
    const url = new URL(`${baseUrl}${endpoint}`);
    if (!params.language) {
      url.searchParams.set('language', settings.tmdbLanguage || 'pt-BR');
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    const isBearerJwt = token.length > 40 || token.includes('.');
    if (!isBearerJwt) {
      url.searchParams.set('api_key', token);
    }

    const cacheKey = `tmdb:${settings.catalogSource}:${settings.tmdbLanguage}:${settings.tmdbImageQuality}:${settings.tmdbImageBaseUrl}:${url.toString()}`;
    const cached = CacheService.get<T>(cacheKey);
    if (cached) return cached;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (isBearerJwt) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(12_000),
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
    const ttlMs = Math.max(1, settings.cacheTtlMinutes || 10) * 60 * 1000;
    CacheService.set(cacheKey, data, ttlMs);
    return data;
  }

  async testConnection(): Promise<DiagnosticResult> {
    await SystemSettingsService.ensureHydrated();
    const started = Date.now();
    const settings = SystemSettingsService.getSettings();
    const tokenInfo = SystemSettingsService.getActiveTmdbToken();

    if (settings.catalogSource === 'demo' || settings.catalogSource === 'custom_only') {
      return {
        target: 'tmdb',
        ok: true,
        latencyMs: Date.now() - started,
        message: `Fonte ativa configurada como "${settings.catalogSource}". Chamadas externas TMDB estão desabilitadas por escolha do administrador.`,
        detail: `Base configurada: ${settings.tmdbBaseUrl}`,
        testedAt: new Date().toISOString(),
      };
    }

    if (!tokenInfo.token) {
      return {
        target: 'tmdb',
        ok: false,
        latencyMs: Date.now() - started,
        message: 'Nenhum token TMDB encontrado (nem em Secrets nem nas Configurações de API).',
        detail: 'Informe um TMDB Access Token (v4) ou API Key (v3) em Fontes de API ou use o modo Demonstração.',
        testedAt: new Date().toISOString(),
      };
    }

    try {
      const baseUrl = (settings.tmdbBaseUrl || 'https://api.themoviedb.org/3').replace(/\/+$/, '');
      const url = new URL(`${baseUrl}/configuration`);
      const isBearerJwt = tokenInfo.token.length > 40 || tokenInfo.token.includes('.');
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (isBearerJwt) {
        headers.Authorization = `Bearer ${tokenInfo.token}`;
      } else {
        url.searchParams.set('api_key', tokenInfo.token);
      }

      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(10_000) });
      const latencyMs = Date.now() - started;

      if (!res.ok) {
        return {
          target: 'tmdb',
          ok: false,
          latencyMs,
          statusCode: res.status,
          message: `Falha ao autenticar no TMDB (${res.status}). Verifique o token configurado (${tokenInfo.source}).`,
          detail: baseUrl,
          testedAt: new Date().toISOString(),
        };
      }

      return {
        target: 'tmdb',
        ok: true,
        latencyMs,
        statusCode: res.status,
        message: `Conexão TMDB validada com sucesso via ${tokenInfo.source === 'admin_override' ? 'Token do Painel Admin' : 'Secret do Servidor'}.`,
        detail: `${baseUrl} · idioma ${settings.tmdbLanguage}`,
        testedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        target: 'tmdb',
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro de rede ao conectar em ${settings.tmdbBaseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: new Date().toISOString(),
      };
    }
  }

  async ensureImageConfig(): Promise<string> {
    if (!this.isConfigured()) return this.getActiveImageBaseUrl();
    const settings = SystemSettingsService.getSettings();
    if (settings.tmdbImageBaseUrl && settings.tmdbImageBaseUrl !== 'https://image.tmdb.org/t/p/') {
      return settings.tmdbImageBaseUrl;
    }
    const cached = CacheService.get<string>('tmdb:image_base_url');
    if (cached) return cached;
    try {
      const cfg = await this.request<{ images?: { secure_base_url?: string } }>('/configuration', {});
      if (cfg.images?.secure_base_url) {
        this.detectedImageBaseUrl = cfg.images.secure_base_url;
        CacheService.set('tmdb:image_base_url', this.detectedImageBaseUrl, 60 * 60 * 1000);
      }
    } catch {
      // Retain official default
    }
    return this.getActiveImageBaseUrl();
  }

  private mapMedia(raw: TmdbRawMedia, forcedType?: MediaType): MediaItem {
    const mediaType: MediaType =
      forcedType ?? (raw.media_type === 'tv' ? 'tv' : 'movie');
    const releaseDate = raw.release_date ?? raw.first_air_date ?? '';
    const imageBase = this.getActiveImageBaseUrl();
    const posterQuality = SystemSettingsService.getSettings().tmdbImageQuality || 'w500';
    return {
      id: raw.id,
      tmdbId: raw.id,
      mediaType,
      title: raw.title ?? raw.name ?? 'Sem título',
      originalTitle: raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? '',
      overview: raw.overview || 'Sinopse indisponível no momento.',
      posterPath: buildTmdbImageUrl(raw.poster_path, posterQuality, imageBase),
      backdropPath: buildTmdbImageUrl(raw.backdrop_path, 'w1280', imageBase),
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
    await SystemSettingsService.ensureHydrated();
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
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
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
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
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
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        sortBy: 'popularity',
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

  async getAllGenres(): Promise<{ movie: GenreItem[]; tv: GenreItem[]; unified: GenreItem[] }> {
    const [movie, tv] = await Promise.all([this.getGenres('movie'), this.getGenres('tv')]);
    return {
      movie,
      tv,
      unified: mergeUnifiedTmdbGenres(movie, tv),
    };
  }

  async discover(params: {
    mediaType: 'all' | 'movie' | 'tv';
    genreId?: number | null;
    year?: number | null;
    yearFrom?: number | null;
    yearTo?: number | null;
    minRating?: number | null;
    language?: string | null;
    country?: string | null;
    watchProvider?: number | null;
    sortBy?: CatalogSortBy;
    query?: string;
    page?: number;
  }): Promise<PaginatedCatalogResponse> {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const page = Math.max(1, params.page ?? 1);

    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        ...params,
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    if (params.query && params.query.trim().length > 0) {
      return this.search(params.query.trim(), params.mediaType, page, params.year ?? null);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const includeAdult = SystemSettingsService.getSettings().includeAdult ? 'true' : 'false';

    const buildDiscoverQuery = (
      targetType: MediaType,
      mappedGenreId: number | undefined
    ): Record<string, string | number | undefined> => {
      const dateField = targetType === 'movie' ? 'primary_release_date' : 'first_air_date';
      const sortMap: Record<CatalogSortBy, string> = {
        popularity: 'popularity.desc',
        rating: 'vote_average.desc',
        votes: 'vote_count.desc',
        release_date: `${dateField}.desc`,
        release_date_asc: `${dateField}.asc`,
        title_asc: targetType === 'movie' ? 'original_title.asc' : 'original_name.asc',
      };
      const sortKey = params.sortBy ?? 'popularity';
      const q: Record<string, string | number | undefined> = {
        page,
        include_adult: includeAdult,
        sort_by: sortMap[sortKey] ?? 'popularity.desc',
        with_genres: mappedGenreId,
        'vote_average.gte': params.minRating ?? undefined,
        'vote_count.gte': sortKey === 'rating' ? 20 : undefined,
        with_original_language: params.language && params.language !== 'all' ? params.language : undefined,
        with_origin_country: params.country && params.country !== 'all' ? params.country : undefined,
      };
      if (params.watchProvider && Number.isFinite(params.watchProvider)) {
        q.with_watch_providers = params.watchProvider;
        q.watch_region = 'BR';
      }
      if (params.year) {
        if (targetType === 'movie') q.primary_release_year = params.year;
        else q.first_air_date_year = params.year;
      } else {
        if (params.yearFrom) {
          q[`${dateField}.gte`] = `${params.yearFrom}-01-01`;
        } else if (sortKey === 'release_date_asc') {
          q[`${dateField}.gte`] = '1900-01-01';
        }
        if (params.yearTo) {
          q[`${dateField}.lte`] = `${params.yearTo}-12-31`;
        } else if (sortKey === 'release_date') {
          q[`${dateField}.lte`] = todayIso;
        }
      }
      return q;
    };

    if (params.mediaType === 'all') {
      const movieGenre = resolveTmdbGenreForMediaType(params.genreId, 'movie');
      const tvGenre = resolveTmdbGenreForMediaType(params.genreId, 'tv');

      const emptyRes = { results: [] as TmdbRawMedia[], page, total_pages: 0, total_results: 0 };
      const [movieRes, tvRes] = await Promise.all([
        movieGenre.compatible
          ? this.request<{
              results: TmdbRawMedia[];
              page: number;
              total_pages: number;
              total_results: number;
            }>('/discover/movie', buildDiscoverQuery('movie', movieGenre.genreId))
          : Promise.resolve(emptyRes),
        tvGenre.compatible
          ? this.request<{
              results: TmdbRawMedia[];
              page: number;
              total_pages: number;
              total_results: number;
            }>('/discover/tv', buildDiscoverQuery('tv', tvGenre.genreId))
          : Promise.resolve(emptyRes),
      ]);

      const merged = deduplicateMediaByTmdbId([
        ...(movieRes.results ?? []).map((r) => this.mapMedia(r, 'movie')),
        ...(tvRes.results ?? []).map((r) => this.mapMedia(r, 'tv')),
      ]).sort((a, b) => {
        if (params.sortBy === 'rating') return b.voteAverage - a.voteAverage;
        if (params.sortBy === 'votes') return b.voteCount - a.voteCount;
        if (params.sortBy === 'release_date') return (b.releaseDate || '').localeCompare(a.releaseDate || '');
        if (params.sortBy === 'release_date_asc') return (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');
        if (params.sortBy === 'title_asc') return a.title.localeCompare(b.title, 'pt-BR');
        return b.popularity - a.popularity;
      });

      const totalPages = Math.max(1, Math.min(Math.max(movieRes.total_pages ?? 1, tvRes.total_pages ?? 1), 500));
      return {
        items: merged,
        page,
        totalPages,
        totalResults: (movieRes.total_results ?? 0) + (tvRes.total_results ?? 0),
        source: 'tmdb',
        demoMode: false,
      };
    }

    const targetType: MediaType = params.mediaType === 'tv' ? 'tv' : 'movie';
    const mappedGenre = resolveTmdbGenreForMediaType(params.genreId, targetType);
    const res = await this.request<{
      results: TmdbRawMedia[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(
      `/discover/${targetType}`,
      buildDiscoverQuery(targetType, mappedGenre.genreId ?? params.genreId ?? undefined)
    );

    return {
      items: deduplicateMediaByTmdbId((res.results ?? []).map((r) => this.mapMedia(r, targetType))),
      page: res.page ?? page,
      totalPages: Math.max(1, Math.min(res.total_pages ?? 1, 500)),
      totalResults: res.total_results ?? 0,
      source: 'tmdb',
      demoMode: false,
    };
  }

  async search(
    query: string,
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    page = 1,
    year?: number | null
  ): Promise<PaginatedCatalogResponse> {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const subset = filterAndSortMedia(this.getDemoOrCustomBaseCatalog(), {
        mediaType,
        year,
        query,
        page,
        pageSize: 20,
      });
      return { ...subset, source: 'demo', demoMode: true };
    }

    await this.ensureImageConfig();
    const target = parseCatalogSearchTarget(query);

    if (page === 1 && target.kind === 'imdb') {
      try {
        const found = await this.request<{
          movie_results?: TmdbRawMedia[];
          tv_results?: TmdbRawMedia[];
        }>(`/find/${target.imdbId}`, { external_source: 'imdb_id' });
        const items = deduplicateMediaByTmdbId([
          ...(mediaType !== 'tv' ? (found.movie_results ?? []).map((r) => this.mapMedia(r, 'movie')) : []),
          ...(mediaType !== 'movie' ? (found.tv_results ?? []).map((r) => this.mapMedia(r, 'tv')) : []),
        ]);
        return {
          items,
          page: 1,
          totalPages: 1,
          totalResults: items.length,
          source: 'tmdb',
          demoMode: false,
        };
      } catch {
        // Fallback to standard search
      }
    }

    if (page === 1 && target.kind === 'tmdb_typed') {
      try {
        const detail = await this.getDetail(target.tmdbId, target.mediaType);
        const items = detail ? [detail] : [];
        return {
          items,
          page: 1,
          totalPages: 1,
          totalResults: items.length,
          source: 'tmdb',
          demoMode: false,
        };
      } catch {
        return {
          items: [],
          page: 1,
          totalPages: 1,
          totalResults: 0,
          source: 'tmdb',
          demoMode: false,
        };
      }
    }

    let idMatches: MediaItem[] = [];
    if (page === 1 && target.kind === 'tmdb_numeric') {
      const lookups: Array<Promise<MediaItem | null>> = [];
      if (mediaType !== 'tv') {
        lookups.push(
          this.request<TmdbRawMedia>(`/movie/${target.tmdbId}`)
            .then((r) => this.mapMedia(r, 'movie'))
            .catch(() => null)
        );
      }
      if (mediaType !== 'movie') {
        lookups.push(
          this.request<TmdbRawMedia>(`/tv/${target.tmdbId}`)
            .then((r) => this.mapMedia(r, 'tv'))
            .catch(() => null)
        );
      }
      idMatches = (await Promise.all(lookups)).filter((x): x is MediaItem => x !== null);
    }

    const endpoint =
      mediaType === 'movie'
        ? '/search/movie'
        : mediaType === 'tv'
          ? '/search/tv'
          : '/search/multi';

    const includeAdult = SystemSettingsService.getSettings().includeAdult ? 'true' : 'false';
    const searchParams: Record<string, string | number | undefined> = {
      query,
      page,
      include_adult: includeAdult,
    };
    if (year) {
      if (mediaType === 'movie') searchParams.year = year;
      else if (mediaType === 'tv') searchParams.first_air_date_year = year;
    }

    interface TmdbMultiSearchRaw extends TmdbRawMedia {
      known_for?: TmdbRawMedia[];
    }

    const res = await this.request<{
      results: TmdbMultiSearchRaw[];
      page: number;
      total_pages: number;
      total_results: number;
    }>(endpoint, searchParams);

    const directMedia: MediaItem[] = [];
    const personKnownFor: MediaItem[] = [];
    let topPersonId: number | null = null;

    for (const r of res.results ?? []) {
      if (r.media_type === 'person') {
        if (!topPersonId) topPersonId = r.id;
        for (const kf of r.known_for ?? []) {
          if (kf.media_type === 'movie' || kf.media_type === 'tv') {
            personKnownFor.push(this.mapMedia(kf));
          }
        }
        continue;
      }
      if (mediaType === 'all' && r.media_type !== 'movie' && r.media_type !== 'tv') {
        continue;
      }
      directMedia.push(this.mapMedia(r, mediaType === 'all' ? undefined : mediaType));
    }

    // If user searched an actor/director by name on page 1 and title matches are sparse, include full person filmography
    let personCredits: MediaItem[] = [];
    if (page === 1 && topPersonId && directMedia.length < 4) {
      try {
        const credits = await this.request<{
          cast?: TmdbRawMedia[];
          crew?: TmdbRawMedia[];
        }>(`/person/${topPersonId}/combined_credits`);
        personCredits = [...(credits.cast ?? []), ...(credits.crew ?? [])]
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .slice(0, 24)
          .map((r) => this.mapMedia(r));
      } catch {
        // Optional person expansion
      }
    }

    // Fallback enrichment via FreeAPI.Pro (/api/msearch) when TMDB search yields sparse results
    let freeApiMatches: MediaItem[] = [];
    if (page === 1 && target.kind === 'text' && directMedia.length < 4 && query.trim().length >= 2) {
      try {
        const freeResults = await FreeApiProService.searchMoviesAndSeries(query);
        const topImdbIds = freeResults
          .filter((item) => {
            if (!item?.id || !/^tt\d{5,12}$/i.test(item.id)) return false;
            const rawType = (item.type || '').toLowerCase();
            const isTv = /(?:tv series|mini series|tv mini series|tv special)/i.test(rawType);
            if (mediaType === 'movie' && isTv) return false;
            if (mediaType === 'tv' && !isTv) return false;
            return true;
          })
          .slice(0, 4)
          .map((item) => item.id!.trim().toLowerCase());

        if (topImdbIds.length > 0) {
          const foundByImdb = await Promise.all(
            topImdbIds.map((imdbId) =>
              this.request<{
                movie_results?: TmdbRawMedia[];
                tv_results?: TmdbRawMedia[];
              }>(`/find/${imdbId}`, { external_source: 'imdb_id' }).catch(() => null)
            )
          );
          for (const found of foundByImdb) {
            if (!found) continue;
            if (mediaType !== 'tv') {
              freeApiMatches.push(...(found.movie_results ?? []).map((r) => this.mapMedia(r, 'movie')));
            }
            if (mediaType !== 'movie') {
              freeApiMatches.push(...(found.tv_results ?? []).map((r) => this.mapMedia(r, 'tv')));
            }
          }
        }
      } catch {
        // Optional FreeAPI search enrichment
      }
    }

    const combined = deduplicateMediaByTmdbId([
      ...idMatches,
      ...directMedia,
      ...freeApiMatches,
      ...personKnownFor,
      ...personCredits,
    ]).filter((item) => {
      if (mediaType !== 'all' && item.mediaType !== mediaType) return false;
      if (year && Number(item.releaseYear) !== year) return false;
      return true;
    });

    return {
      items: combined,
      page: res.page ?? page,
      totalPages: Math.max(1, Math.min(res.total_pages ?? 1, 500)),
      totalResults: Math.max(res.total_results ?? 0, combined.length),
      source: 'tmdb',
      demoMode: false,
    };
  }

  async getDetail(tmdbId: number, mediaType: MediaType): Promise<MediaDetail | null> {
    await Promise.all([SiteConfigService.ensureHydrated(), SystemSettingsService.ensureHydrated()]);
    const customMatch = repositoryStore
      .getCustomCatalog()
      .find((c) => c.active && c.tmdbId === tmdbId && c.mediaType === mediaType);

    if (!this.isConfigured()) {
      const demo = getDemoMediaDetail(tmdbId, mediaType);
      if (customMatch) {
        const baseCustom = customMediaToMediaItem(customMatch);
        if (!demo) {
          return {
            ...baseCustom,
            runtime: null,
            status: 'Disponível',
            tagline: '',
            director: null,
            cast: [],
            videos: [],
            recommendations: DEMO_MEDIA_CATALOG.slice(0, 6),
            similar: DEMO_MEDIA_CATALOG.slice(6, 12),
            seasons:
              mediaType === 'tv'
                ? [{ id: 1, seasonNumber: 1, name: 'Temporada 1', overview: '', posterPath: baseCustom.posterPath, episodeCount: 1, airDate: '' }]
                : undefined,
          };
        }
        return {
          ...demo,
          title: customMatch.title,
          originalTitle: customMatch.originalTitle || demo.originalTitle,
          overview: customMatch.overview || demo.overview,
          posterPath: customMatch.posterPath ?? demo.posterPath,
          backdropPath: customMatch.backdropPath ?? demo.backdropPath,
          releaseYear: customMatch.releaseYear || demo.releaseYear,
          voteAverage: customMatch.voteAverage,
        };
      }
      return demo;
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
      belongs_to_collection?: {
        id: number;
        name: string;
        poster_path: string | null;
        backdrop_path: string | null;
      } | null;
      recommendations?: { results?: TmdbRawMedia[] };
      similar?: { results?: TmdbRawMedia[] };
    }

    let raw: TmdbDetailPayload;
    try {
      raw = await this.request<TmdbDetailPayload>(`/${mediaType}/${tmdbId}`, {
        append_to_response: 'credits,videos,recommendations,similar',
      });
    } catch (err) {
      if (customMatch) {
        const baseCustom = customMediaToMediaItem(customMatch);
        return {
          ...baseCustom,
          runtime: null,
          status: 'Disponível',
          tagline: '',
          director: null,
          cast: [],
          videos: [],
          recommendations: [],
          similar: [],
          seasons:
            mediaType === 'tv'
              ? [{ id: 1, seasonNumber: 1, name: 'Temporada 1', overview: '', posterPath: baseCustom.posterPath, episodeCount: 1, airDate: '' }]
              : undefined,
        };
      }
      throw err;
    }

    const base = this.mapMedia(raw, mediaType);
    const director =
      raw.credits?.crew?.find((c) => c.job === 'Director' || c.job === 'Creator')?.name ?? null;

    const imageBase = this.getActiveImageBaseUrl();
    const cast: CastMember[] = (raw.credits?.cast ?? []).slice(0, 14).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: buildTmdbImageUrl(c.profile_path, 'w185', imageBase),
    }));

    const videos: VideoItem[] = (raw.videos?.results ?? []).filter((v) => v.site === 'YouTube');
    const recommendations = deduplicateMediaByTmdbId(
      (raw.recommendations?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );
    const similar = deduplicateMediaByTmdbId(
      (raw.similar?.results ?? []).map((r) => this.mapMedia(r, mediaType))
    );

    let collection: MediaCollectionSummary | null = null;
    if (mediaType === 'movie' && raw.belongs_to_collection?.id) {
      try {
        const colRaw = await this.request<{
          id: number;
          name: string;
          overview?: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          parts?: TmdbRawMedia[];
        }>(`/collection/${raw.belongs_to_collection.id}`);
        const parts = deduplicateMediaByTmdbId(
          (colRaw.parts ?? []).map((p) => this.mapMedia(p, 'movie'))
        ).sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));
        if (parts.length > 1) {
          collection = {
            id: colRaw.id,
            name: colRaw.name,
            overview: colRaw.overview || '',
            posterPath: buildTmdbImageUrl(colRaw.poster_path, 'w342', imageBase),
            backdropPath: buildTmdbImageUrl(colRaw.backdrop_path, 'w1280', imageBase),
            parts,
          };
        }
      } catch {
        // Optional franchise collection lookup
      }
    }

    const detail: MediaDetail = {
      ...base,
      runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
      status: raw.status ?? '',
      tagline: raw.tagline ?? '',
      director,
      cast,
      videos,
      recommendations,
      similar,
      collection,
      numberOfSeasons: raw.number_of_seasons,
      numberOfEpisodes: raw.number_of_episodes,
      seasons: (raw.seasons ?? []).map((s) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: buildTmdbImageUrl(s.poster_path, 'w342', imageBase),
        episodeCount: s.episode_count,
        airDate: s.air_date ?? '',
      })),
    };

    if (customMatch) {
      return {
        ...detail,
        title: customMatch.title,
        originalTitle: customMatch.originalTitle || detail.originalTitle,
        overview: customMatch.overview || detail.overview,
        posterPath: customMatch.posterPath ?? detail.posterPath,
        backdropPath: customMatch.backdropPath ?? detail.backdropPath,
        releaseYear: customMatch.releaseYear || detail.releaseYear,
        voteAverage: customMatch.voteAverage,
      };
    }

    return detail;
  }

  async getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<SeasonDetail> {
    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const demoSeason = getDemoSeasonDetail(tmdbId, seasonNumber);
      if (demoSeason.episodes.length > 0) return demoSeason;
      const sbFallback = await StreamBetterService.getSeasonEpisodes(tmdbId, seasonNumber).catch(
        () => []
      );
      if (sbFallback.length > 0) {
        const mapped = sbFallback.map((ep, idx) => ({
          id: Number(`${tmdbId}${seasonNumber}${ep.episode ?? ep.episode_number ?? idx + 1}`) || idx + 1,
          episodeNumber: Number(ep.episode ?? ep.episode_number ?? idx + 1),
          seasonNumber,
          name: ep.name || ep.title || `Episódio ${ep.episode ?? ep.episode_number ?? idx + 1}`,
          overview: ep.overview || 'Descrição do episódio indisponível.',
          stillPath: ep.still_path || ep.image || null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ?? '',
          voteAverage: 0,
        }));
        return {
          ...demoSeason,
          episodeCount: mapped.length,
          episodes: mapped,
        };
      }
      return demoSeason;
    }
    await this.ensureImageConfig();
    const imageBase = this.getActiveImageBaseUrl();
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
      stillPath: buildTmdbImageUrl(ep.still_path, 'w500', imageBase),
      runtime: ep.runtime,
      airDate: ep.air_date ?? '',
      voteAverage: Number((ep.vote_average ?? 0).toFixed(1)),
    }));

    if (episodes.length === 0) {
      const sbFallback = await StreamBetterService.getSeasonEpisodes(tmdbId, seasonNumber).catch(
        () => []
      );
      for (let i = 0; i < sbFallback.length; i++) {
        const ep = sbFallback[i];
        const epNum = Number(ep.episode ?? ep.episode_number ?? i + 1);
        episodes.push({
          id: Number(`${tmdbId}${seasonNumber}${epNum}`) || i + 1,
          episodeNumber: epNum,
          seasonNumber,
          name: ep.name || ep.title || `Episódio ${epNum}`,
          overview: ep.overview || 'Descrição do episódio indisponível.',
          stillPath: ep.still_path || ep.image || null,
          runtime: ep.runtime ?? null,
          airDate: ep.air_date ?? '',
          voteAverage: 0,
        });
      }
    }

    return {
      id: raw.id,
      seasonNumber: raw.season_number,
      name: raw.name,
      overview: raw.overview,
      posterPath: buildTmdbImageUrl(raw.poster_path, 'w342', imageBase),
      episodeCount: episodes.length,
      airDate: raw.air_date ?? '',
      episodes,
    };
  }

  private readonly externalImdbCache = new Map<string, string | null>();

  async getExternalImdbId(tmdbId: number, mediaType: MediaType): Promise<string | null> {
    const cacheKey = `${mediaType}:${tmdbId}`;
    if (this.externalImdbCache.has(cacheKey)) {
      return this.externalImdbCache.get(cacheKey) ?? null;
    }
    await SystemSettingsService.ensureHydrated();
    let valid: string | null = null;
    if (this.isConfigured()) {
      try {
        const path =
          mediaType === 'tv' ? `/tv/${tmdbId}/external_ids` : `/movie/${tmdbId}/external_ids`;
        const data = await this.request<{ imdb_id?: string | null }>(path);
        valid =
          typeof data.imdb_id === 'string' && /^tt\d{5,12}$/i.test(data.imdb_id.trim())
            ? data.imdb_id.trim().toLowerCase()
            : null;
      } catch {
        valid = null;
      }
    }

    if (!valid) {
      try {
        const info = await this.getEnglishTitleAndYear(tmdbId, mediaType);
        const freeMatch = await FreeApiProService.lookupBestMatch({
          title: info.title,
          ptTitle: info.ptTitle,
          originalTitle: info.originalTitle,
          releaseYear: info.releaseYear,
          mediaType,
        });
        valid = freeMatch?.imdbId ?? null;
      } catch {
        valid = null;
      }
    }

    if (this.externalImdbCache.size > 500) {
      const firstKey = this.externalImdbCache.keys().next().value;
      if (firstKey) this.externalImdbCache.delete(firstKey);
    }
    this.externalImdbCache.set(cacheKey, valid);
    return valid;
  }

  async getMovieExternalImdbId(tmdbId: number): Promise<string | null> {
    return this.getExternalImdbId(tmdbId, 'movie');
  }

  private readonly titleYearCache = new Map<
    string,
    {
      title: string | null;
      ptTitle: string | null;
      originalTitle: string | null;
      releaseYear: string | null;
      originalLanguage: string | null;
      genreIds: number[];
    }
  >();

  async getEnglishTitleAndYear(
    tmdbId: number,
    mediaType: MediaType
  ): Promise<{
    title: string | null;
    ptTitle: string | null;
    originalTitle: string | null;
    releaseYear: string | null;
    originalLanguage: string | null;
    genreIds: number[];
  }> {
    const cacheKey = `${mediaType}:${tmdbId}`;
    const cached = this.titleYearCache.get(cacheKey);
    if (cached) return cached;

    await SystemSettingsService.ensureHydrated();
    if (!this.isConfigured()) {
      const demo = DEMO_MEDIA_CATALOG.find(
        (d) => d.tmdbId === tmdbId && d.mediaType === mediaType
      );
      return {
        title: demo?.originalTitle || demo?.title || null,
        ptTitle: demo?.title || null,
        originalTitle: demo?.originalTitle || demo?.title || null,
        releaseYear: demo?.releaseYear || null,
        originalLanguage: demo?.originalLanguage || null,
        genreIds: demo?.genreIds || [],
      };
    }

    try {
      const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
      const [rawEn, rawPt] = await Promise.all([
        this.request<{
          title?: string;
          name?: string;
          original_title?: string;
          original_name?: string;
          release_date?: string;
          first_air_date?: string;
          original_language?: string;
          genres?: Array<{ id?: number }>;
        }>(endpoint, { language: 'en-US' }),
        this.request<{
          title?: string;
          name?: string;
          original_title?: string;
          original_name?: string;
        }>(endpoint, { language: 'pt-BR' }).catch(() => null),
      ]);

      const cleanTitle =
        (rawEn.title || rawEn.name || rawEn.original_title || rawEn.original_name || '').trim() ||
        null;
      const ptTitle =
        (rawPt?.title || rawPt?.name || '').trim() || cleanTitle;
      const originalTitle =
        (rawEn.original_title || rawEn.original_name || cleanTitle || '').trim() || null;
      const dateStr = (rawEn.release_date || rawEn.first_air_date || '').trim();
      const releaseYear = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : null;
      const originalLanguage =
        typeof rawEn.original_language === 'string' && rawEn.original_language.trim()
          ? rawEn.original_language.trim().toLowerCase()
          : null;
      const genreIds = Array.isArray(rawEn.genres)
        ? rawEn.genres.map((g) => Number(g?.id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];

      const result = {
        title: cleanTitle,
        ptTitle,
        originalTitle,
        releaseYear,
        originalLanguage,
        genreIds,
      };
      if (this.titleYearCache.size > 500) {
        const firstKey = this.titleYearCache.keys().next().value;
        if (firstKey) this.titleYearCache.delete(firstKey);
      }
      this.titleYearCache.set(cacheKey, result);
      return result;
    } catch {
      return {
        title: null,
        ptTitle: null,
        originalTitle: null,
        releaseYear: null,
        originalLanguage: null,
        genreIds: [],
      };
    }
  }
}

export const TMDBService = new TMDBServiceImpl();
