import type { MediaType } from '../../shared/types.ts';
import {
  resolveFreeApiUrl,
  selectBestFreeApiAnimeMatch,
  selectBestFreeApiMovieMatch,
  type FreeApiAnimeResultInput,
  type FreeApiMovieResultInput,
} from '../../shared/openMediaMatchers.ts';

const FREEAPI_BASE = 'https://freeapi.pro';
const FREEAPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface FreeApiMovieResolvedMatch {
  imdbId: string;
  title: string;
  type: string;
  normalizedMediaType: MediaType;
  year: number | null;
  poster: string | null;
  watchUrl: string | null;
  imdbUrl: string | null;
}

export interface FreeApiAnimeStreamPayload {
  m3u8Url: string;
  server: 'kira' | 'naoka';
  voiceType: 'sub' | 'dub';
  tracks: Array<{ url: string; lang: string }>;
}

class FreeApiProServiceImpl {
  private readonly msearchCache = new Map<string, CacheEntry<FreeApiMovieResultInput[]>>();
  private readonly animeSearchCache = new Map<string, CacheEntry<FreeApiAnimeResultInput[]>>();

  private setBoundedCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
    if (map.size > 300) {
      const oldest = map.keys().next().value;
      if (oldest) map.delete(oldest);
    }
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async searchMoviesAndSeries(
    query: string,
    signal?: AbortSignal
  ): Promise<FreeApiMovieResultInput[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    const cacheKey = cleanQuery.toLowerCase();
    const cached = this.msearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const url = `${FREEAPI_BASE}/api/msearch?q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': FREEAPI_UA,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 404) {
          this.setBoundedCache(this.msearchCache, cacheKey, [], 5 * 60_000);
        }
        return [];
      }
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        results?: FreeApiMovieResultInput[];
      } | null;
      const results = Array.isArray(data?.results) ? data!.results! : [];
      this.setBoundedCache(this.msearchCache, cacheKey, results, 10 * 60_000);
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async lookupBestMatch(params: {
    imdbId?: string | null;
    title?: string | null;
    ptTitle?: string | null;
    originalTitle?: string | null;
    releaseYear?: string | number | null;
    mediaType?: MediaType;
    signal?: AbortSignal;
  }): Promise<FreeApiMovieResolvedMatch | null> {
    const queries = Array.from(
      new Set(
        [params.title, params.originalTitle, params.ptTitle]
          .map((t) => (t || '').trim())
          .filter(Boolean)
      )
    );
    if (queries.length === 0) return null;

    const allTitles = [params.title, params.originalTitle, params.ptTitle];
    for (const q of queries.slice(0, 2)) {
      const results = await this.searchMoviesAndSeries(q, params.signal);
      if (results.length === 0) continue;
      const picked = selectBestFreeApiMovieMatch(results, {
        imdbId: params.imdbId,
        titles: allTitles,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
      });
      if (picked) {
        return {
          imdbId: picked.imdbId,
          title: (picked.title || q).trim(),
          type: (picked.type || (picked.normalizedMediaType === 'tv' ? 'TV Series' : 'Movie')).trim(),
          normalizedMediaType: picked.normalizedMediaType,
          year: Number(picked.year) || null,
          poster: picked.poster && /^https?:\/\//i.test(picked.poster) ? picked.poster : null,
          watchUrl: picked.watchUrl && /^https?:\/\//i.test(picked.watchUrl) ? picked.watchUrl : null,
          imdbUrl: picked.imdbUrl && /^https?:\/\//i.test(picked.imdbUrl) ? picked.imdbUrl : null,
        };
      }
    }
    return null;
  }

  async searchAnime(query: string, signal?: AbortSignal): Promise<FreeApiAnimeResultInput[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    const cacheKey = cleanQuery.toLowerCase();
    const cached = this.animeSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const url = `${FREEAPI_BASE}/api/anime?action=search&q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': FREEAPI_UA,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return [];
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        results?: FreeApiAnimeResultInput[];
      } | null;
      const results = Array.isArray(data?.results) ? data!.results! : [];
      this.setBoundedCache(this.animeSearchCache, cacheKey, results, 10 * 60_000);
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async resolveBestAnimeId(params: {
    title?: string | null;
    originalTitle?: string | null;
    ptTitle?: string | null;
    releaseYear?: string | null;
    mediaType: MediaType;
    signal?: AbortSignal;
  }): Promise<number | null> {
    const queries = Array.from(
      new Set(
        [params.title, params.originalTitle, params.ptTitle]
          .map((t) => (t || '').trim())
          .filter(Boolean)
      )
    );
    if (queries.length === 0) return null;

    const allTitles = [params.title, params.originalTitle, params.ptTitle];
    for (const q of queries.slice(0, 2)) {
      const list = await this.searchAnime(q, params.signal);
      const picked = selectBestFreeApiAnimeMatch(list, {
        titles: allTitles,
        releaseYear: params.releaseYear,
        mediaType: params.mediaType,
      });
      if (picked?.id) return picked.id;
    }
    return null;
  }

  async fetchAnimeStream(params: {
    anilistId: number;
    episode: number;
    voiceType: 'sub' | 'dub';
    server: 'kira' | 'naoka';
    signal?: AbortSignal;
  }): Promise<FreeApiAnimeStreamPayload | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const onAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const url = `${FREEAPI_BASE}/api/anime?action=stream&id=${encodeURIComponent(String(params.anilistId))}&ep=${encodeURIComponent(String(params.episode))}&a=${params.voiceType}&server=${params.server}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': FREEAPI_UA,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        src?: string;
        tracks?: Array<{ file?: string; label?: string; kind?: string }>;
      } | null;
      if (!data?.ok || !data?.src) return null;

      const m3u8Url = resolveFreeApiUrl(data.src);
      if (!m3u8Url) return null;

      const tracks: Array<{ url: string; lang: string }> = [];
      if (Array.isArray(data.tracks)) {
        for (const tr of data.tracks) {
          if (tr?.kind === 'thumbnails' || !tr?.file || !tr?.label) continue;
          const resolvedTrack = resolveFreeApiUrl(tr.file);
          if (resolvedTrack) {
            tracks.push({ url: resolvedTrack, lang: tr.label.trim() });
          }
        }
      }

      return {
        m3u8Url,
        server: params.server,
        voiceType: params.voiceType,
        tracks,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onAbort);
    }
  }
}

export const FreeApiProService = new FreeApiProServiceImpl();
