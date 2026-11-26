import {
  buildStreamBetter451Candidates,
  buildStreamBetterV1StreamUrl,
  extractStreamBetterSlugFromUrl,
  extractStreamFlashMp4FromHtml,
  parseStreamBetterV1Sources,
  STREAMBETTER_BASE_URL,
  type ParsedStreamBetterSource,
  type StreamBetterChannelRaw,
  type StreamBetterEventRaw,
  type StreamBetterGameRaw,
} from '../../shared/streamBetterUtils.ts';
import type {
  DiagnosticResult,
  LiveChannel,
  LiveEpgProgram,
  LiveEventCard,
  LiveGameCard,
  LiveHubChannel,
  LiveHubResponse,
  MediaType,
} from '../../shared/types.ts';
import { buildChannelMatchKeys } from '../../shared/directChannelUtils.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { DirectChannelsService } from './DirectChannelsService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function normalizeTimestampToIso(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ms = val < 1e12 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^\d{10}$/.test(trimmed)) {
      return new Date(Number(trimmed) * 1000).toISOString();
    }
    if (/^\d{13}$/.test(trimmed)) {
      return new Date(Number(trimmed)).toISOString();
    }
    return trimmed;
  }
  return '';
}

export interface StreamBetterTitleRecord {
  tmdb_id?: number;
  title?: string;
  type?: 'movie' | 'tv' | string;
  url?: string;
  sources?: string[];
  dublado?: boolean;
  legendado?: boolean;
  updated_at?: string;
}

export interface StreamBetterSeasonEpisodeRaw {
  episode?: number;
  episode_number?: number;
  name?: string;
  title?: string;
  overview?: string;
  still_path?: string | null;
  image?: string | null;
  air_date?: string;
  runtime?: number | null;
  url?: string;
}

export interface StreamBetterV1Result {
  ok: boolean;
  hasApiKey: boolean;
  statusCode?: number;
  sources: ParsedStreamBetterSource[];
  error?: string;
}

class StreamBetterServiceImpl {
  private async fetchJson<T>(
    url: string,
    opts: {
      cacheKey?: string;
      ttlMs?: number;
      bearerKey?: string | null;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ ok: boolean; status: number; data: T | null }> {
    if (opts.cacheKey) {
      const cached = CacheService.get<T>(opts.cacheKey);
      if (cached !== null && cached !== undefined) {
        return { ok: true, status: 200, data: cached };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6500);
    const onParentAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': DESKTOP_UA,
      };
      if (opts.bearerKey) {
        headers.Authorization = `Bearer ${opts.bearerKey}`;
      }

      const res = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      if (!res.ok) {
        return { ok: false, status: res.status, data: null };
      }

      const data = (await res.json().catch(() => null)) as T | null;
      if (data !== null && opts.cacheKey && (opts.ttlMs ?? 0) > 0) {
        CacheService.set(opts.cacheKey, data, opts.ttlMs!);
      }
      return { ok: data !== null, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: null };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  async getLegalBlocks(signal?: AbortSignal): Promise<string[]> {
    const res = await this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/legal-blocks`, {
      cacheKey: 'streambetter:legal-blocks',
      ttlMs: 15 * 60 * 1000,
      timeoutMs: 4500,
      signal,
    });
    if (!res.ok || !res.data) return [];
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as { blocks?: unknown[] }).blocks)
        ? (res.data as { blocks: unknown[] }).blocks
        : Array.isArray((res.data as { paths?: unknown[] }).paths)
          ? (res.data as { paths: unknown[] }).paths
          : [];
    return list
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return String(obj.path || obj.url || obj.slug || '');
        }
        return '';
      })
      .filter(Boolean);
  }

  async resolveWith451Fallback(
    rawUrl: string,
    opts: { fetchHtml?: boolean; signal?: AbortSignal } = {}
  ): Promise<{
    finalUrl: string;
    status: number;
    html?: string;
    blockedByLegal451: boolean;
  }> {
    const legalBlocks = await this.getLegalBlocks(opts.signal).catch(() => []);
    const candidates = buildStreamBetter451Candidates(rawUrl, legalBlocks);
    let lastStatus = 0;

    for (const candidate of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const onParentAbort = () => controller.abort();
      opts.signal?.addEventListener('abort', onParentAbort, { once: true });

      try {
        const res = await fetch(candidate, {
          method: opts.fetchHtml ? 'GET' : 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': DESKTOP_UA,
            Accept: opts.fetchHtml ? 'text/html,application/xhtml+xml,*/*' : '*/*',
            Referer: `${STREAMBETTER_BASE_URL}/`,
          },
        });
        lastStatus = res.status;

        if (res.status === 451 || res.status === 404) {
          await res.body?.cancel().catch(() => {});
          continue;
        }

        if (res.status === 405 && !opts.fetchHtml) {
          await res.body?.cancel().catch(() => {});
          const getRes = await fetch(candidate, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent': DESKTOP_UA,
              Referer: `${STREAMBETTER_BASE_URL}/`,
            },
          });
          lastStatus = getRes.status;
          await getRes.body?.cancel().catch(() => {});
          if (getRes.status === 451 || getRes.status === 404) continue;
          if (getRes.ok) {
            return {
              finalUrl: getRes.url || candidate,
              status: getRes.status,
              blockedByLegal451: false,
            };
          }
          continue;
        }

        if (res.ok) {
          const finalUrl = res.url || candidate;
          if (opts.fetchHtml) {
            const html = await res.text().catch(() => '');
            return { finalUrl, status: res.status, html, blockedByLegal451: false };
          }
          await res.body?.cancel().catch(() => {});
          return { finalUrl, status: res.status, blockedByLegal451: false };
        }
        await res.body?.cancel().catch(() => {});
      } catch {
        // Try next mirror candidate
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', onParentAbort);
      }
    }

    return {
      finalUrl: candidates[0] || rawUrl,
      status: lastStatus,
      blockedByLegal451: lastStatus === 451,
    };
  }

  async getTitleAvailability(
    tmdbId: number,
    signal?: AbortSignal
  ): Promise<StreamBetterTitleRecord[]> {
    if (!tmdbId || tmdbId <= 0) return [];
    const res = await this.fetchJson<unknown>(
      `${STREAMBETTER_BASE_URL}/api/titles?tmdb_id=${encodeURIComponent(String(tmdbId))}`,
      {
        cacheKey: `streambetter:titles:${tmdbId}`,
        ttlMs: 10 * 60 * 1000,
        timeoutMs: 4500,
        signal,
      }
    );
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data as StreamBetterTitleRecord[];
    const wrapped = (res.data as { titles?: unknown; data?: unknown }).titles ??
      (res.data as { data?: unknown }).data;
    if (Array.isArray(wrapped)) return wrapped as StreamBetterTitleRecord[];
    if (typeof res.data === 'object') return [res.data as StreamBetterTitleRecord];
    return [];
  }

  async getRecentFeed(signal?: AbortSignal): Promise<StreamBetterTitleRecord[]> {
    const res = await this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/recents`, {
      cacheKey: 'streambetter:recents',
      ttlMs: 10 * 60 * 1000,
      timeoutMs: 5000,
      signal,
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data as StreamBetterTitleRecord[];
    const wrapped = (res.data as { items?: unknown; titles?: unknown; data?: unknown }).items ??
      (res.data as { titles?: unknown }).titles ??
      (res.data as { data?: unknown }).data;
    return Array.isArray(wrapped) ? (wrapped as StreamBetterTitleRecord[]) : [];
  }

  async getSeasonEpisodes(
    tmdbId: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<StreamBetterSeasonEpisodeRaw[]> {
    if (!tmdbId || tmdbId <= 0 || seasonNumber < 0) return [];
    const res = await this.fetchJson<unknown>(
      `${STREAMBETTER_BASE_URL}/api/season-episodes?tmdb_id=${encodeURIComponent(String(tmdbId))}&season=${encodeURIComponent(String(seasonNumber))}`,
      {
        cacheKey: `streambetter:season:${tmdbId}:${seasonNumber}`,
        ttlMs: 20 * 60 * 1000,
        timeoutMs: 4500,
        signal,
      }
    );
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data as StreamBetterSeasonEpisodeRaw[];
    const obj = res.data as { episodes?: unknown; data?: unknown };
    if (Array.isArray(obj.episodes)) return obj.episodes as StreamBetterSeasonEpisodeRaw[];
    if (Array.isArray(obj.data)) return obj.data as StreamBetterSeasonEpisodeRaw[];
    return [];
  }

  async getChannels(signal?: AbortSignal): Promise<StreamBetterChannelRaw[]> {
    const cacheKey = 'streambetter:channels:all';
    const cached = CacheService.get<StreamBetterChannelRaw[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const first = await this.fetchJson<{
      channels?: StreamBetterChannelRaw[];
      items?: StreamBetterChannelRaw[];
      data?: StreamBetterChannelRaw[];
      pagination?: { totalPages?: number; currentPage?: number };
    }>(`${STREAMBETTER_BASE_URL}/api/channels?limit=100&page=1`, {
      timeoutMs: 6500,
      signal,
    });
    if (!first.ok || !first.data) return [];

    const extractList = (d: unknown): StreamBetterChannelRaw[] => {
      if (Array.isArray(d)) return d as StreamBetterChannelRaw[];
      if (d && typeof d === 'object') {
        const obj = d as { channels?: unknown; items?: unknown; data?: unknown };
        const l = obj.channels ?? obj.items ?? obj.data;
        if (Array.isArray(l)) return l as StreamBetterChannelRaw[];
      }
      return [];
    };

    const collected: StreamBetterChannelRaw[] = [...extractList(first.data)];
    const totalPages = Math.min(10, Math.max(1, Number(first.data.pagination?.totalPages) || 1));

    if (totalPages > 1) {
      const restPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map((page) =>
          this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/channels?limit=100&page=${page}`, {
            timeoutMs: 6500,
            signal,
          }).then((r) => (r.ok && r.data ? extractList(r.data) : []))
        )
      );
      for (const pageList of restPages) {
        collected.push(...pageList);
      }
    }

    if (collected.length > 0) {
      CacheService.set(cacheKey, collected, 5 * 60 * 1000);
    }
    return collected;
  }

  async getGames(signal?: AbortSignal): Promise<StreamBetterGameRaw[]> {
    const res = await this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/games`, {
      cacheKey: 'streambetter:games',
      ttlMs: 2 * 60 * 1000,
      timeoutMs: 5500,
      signal,
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data as StreamBetterGameRaw[];
    const obj = res.data as { games?: unknown; items?: unknown; data?: unknown };
    const list = obj.games ?? obj.items ?? obj.data;
    return Array.isArray(list) ? (list as StreamBetterGameRaw[]) : [];
  }

  async getEvents(signal?: AbortSignal): Promise<StreamBetterEventRaw[]> {
    const res = await this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/events`, {
      cacheKey: 'streambetter:events',
      ttlMs: 2 * 60 * 1000,
      timeoutMs: 5500,
      signal,
    });
    if (!res.ok || !res.data) return [];
    if (Array.isArray(res.data)) return res.data as StreamBetterEventRaw[];
    const obj = res.data as { events?: unknown; items?: unknown; data?: unknown };
    const list = obj.events ?? obj.items ?? obj.data;
    return Array.isArray(list) ? (list as StreamBetterEventRaw[]) : [];
  }

  async getEpgAll(
    signal?: AbortSignal
  ): Promise<Map<string, { nowPlaying: LiveEpgProgram | null; nextProgram: LiveEpgProgram | null }>> {
    const resultMap = new Map<
      string,
      { nowPlaying: LiveEpgProgram | null; nextProgram: LiveEpgProgram | null }
    >();
    const res = await this.fetchJson<unknown>(
      `${STREAMBETTER_BASE_URL}/api/epg?channel=all&hoursPast=3&hoursFuture=24`,
      {
        cacheKey: 'streambetter:epg:all',
        ttlMs: 3 * 60 * 1000,
        timeoutMs: 6000,
        signal,
      }
    );
    if (!res.ok || !res.data || typeof res.data !== 'object') return resultMap;

    const nowMs = Date.now();
    const parsePrograms = (rawPrograms: unknown[]): LiveEpgProgram[] =>
      rawPrograms
        .map((p): LiveEpgProgram | null => {
          if (!p || typeof p !== 'object') return null;
          const obj = p as Record<string, unknown>;
          const title = String(obj.title || obj.name || '').trim();
          const startAt = normalizeTimestampToIso(obj.start ?? obj.startAt ?? obj.start_time);
          const stopAt = normalizeTimestampToIso(obj.stop ?? obj.end ?? obj.stopAt ?? obj.end_time);
          if (!title) return null;
          const startMs = Date.parse(startAt);
          const stopMs = Date.parse(stopAt);
          const isLive =
            obj.isLive === true ||
            (Number.isFinite(startMs) && Number.isFinite(stopMs) && startMs <= nowMs && nowMs < stopMs);
          return {
            title,
            startAt,
            stopAt,
            isLive,
            image: typeof obj.image === 'string' ? obj.image : null,
            description: typeof obj.description === 'string' ? obj.description : null,
          };
        })
        .filter((item): item is LiveEpgProgram => item !== null);

    const assignChannelPrograms = (channelKey: string, programs: LiveEpgProgram[]) => {
      if (!channelKey || programs.length === 0) return;
      const liveIdx = programs.findIndex((p) => p.isLive);
      const nowPlaying = liveIdx >= 0 ? programs[liveIdx] : null;
      const nextProgram =
        liveIdx >= 0 && liveIdx + 1 < programs.length
          ? programs[liveIdx + 1]
          : programs.find((p) => {
              const s = Date.parse(p.startAt);
              return Number.isFinite(s) && s > nowMs;
            }) ?? null;
      const normalized = channelKey.trim().toLowerCase();
      resultMap.set(normalized, { nowPlaying, nextProgram });
    };

    const dataObj = res.data as Record<string, unknown>;
    if (Array.isArray(res.data)) {
      for (const entry of res.data) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        const key = String(e.slug || e.channel || e.id || e.name || '');
        const progs = Array.isArray(e.programs)
          ? e.programs
          : Array.isArray(e.epg)
            ? e.epg
            : Array.isArray(e.schedule)
              ? e.schedule
              : [];
        assignChannelPrograms(key, parsePrograms(progs));
      }
    } else if (dataObj.channels && typeof dataObj.channels === 'object') {
      for (const [k, v] of Object.entries(dataObj.channels as Record<string, unknown>)) {
        const progs = Array.isArray(v)
          ? v
          : v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).programs)
            ? ((v as Record<string, unknown>).programs as unknown[])
            : [];
        assignChannelPrograms(k, parsePrograms(progs));
      }
    } else {
      for (const [k, v] of Object.entries(dataObj)) {
        if (Array.isArray(v)) {
          assignChannelPrograms(k, parsePrograms(v));
        }
      }
    }

    return resultMap;
  }

  private async resolveStreamFlashMp4Url(
    pageUrl: string,
    referer?: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const res = await fetch(pageUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_UA,
          Referer: referer || `${STREAMBETTER_BASE_URL}/`,
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
      });
      if (!res.ok) return null;
      const html = await res.text();
      return extractStreamFlashMp4FromHtml(html);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  async fetchV1Streams(params: {
    tmdbId?: number | null;
    mediaType?: MediaType;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    channel?: string | null;
    game?: string | null;
    event?: string | null;
    fonte?: string | null;
    directUrlOverride?: string;
    signal?: AbortSignal;
  }): Promise<StreamBetterV1Result> {
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();
    if (!keyInfo.key) {
      return {
        ok: false,
        hasApiKey: false,
        sources: [],
        error: 'Chave secreta StreamBetter (sb_sk_...) não configurada.',
      };
    }

    const endpointUrl =
      params.directUrlOverride ||
      buildStreamBetterV1StreamUrl({
        tmdbId: params.tmdbId,
        mediaType: params.mediaType,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber,
        channel: params.channel,
        game: params.game,
        event: params.event,
        fonte: params.fonte,
      });

    const isLive = Boolean(params.channel || params.game || params.event);
    const cacheKey = `streambetter:v1:${endpointUrl}`;
    const cached = CacheService.get<ParsedStreamBetterSource[]>(cacheKey);
    if (cached && cached.length > 0) {
      return { ok: true, hasApiKey: true, statusCode: 200, sources: cached };
    }

    const res = await this.fetchJson<unknown>(endpointUrl, {
      bearerKey: keyInfo.key,
      timeoutMs: 8500,
      signal: params.signal,
    });

    if (!res.ok || !res.data) {
      return {
        ok: false,
        hasApiKey: true,
        statusCode: res.status,
        sources: [],
        error: res.status === 401
          ? 'Chave StreamBetter inválida ou expirada (HTTP 401).'
          : `StreamBetter API retornou status ${res.status || 'erro de rede'}.`,
      };
    }

    const parsed = parseStreamBetterV1Sources(res.data);

    // Resolve streamflash HTML pages into direct MP4 URLs
    const resolvedSources = await Promise.all(
      parsed.map(async (src) => {
        if (src.kind !== 'streamflash') return src;
        const mp4Url = await this.resolveStreamFlashMp4Url(
          src.url,
          src.referer || `${STREAMBETTER_BASE_URL}/`,
          params.signal
        );
        if (!mp4Url) return null;
        return {
          ...src,
          url: mp4Url,
          format: 'mp4' as const,
        };
      })
    );

    const validSources = resolvedSources.filter(
      (item): item is ParsedStreamBetterSource => item !== null
    );

    if (validSources.length > 0) {
      let ttlMs = isLive ? 90 * 1000 : 8 * 60 * 1000;
      const earliestExpiry = validSources
        .map((s) => (s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN))
        .filter((ts) => Number.isFinite(ts) && ts > Date.now() + 60_000)
        .sort((a, b) => a - b)[0];
      if (earliestExpiry) {
        ttlMs = Math.min(ttlMs, Math.max(60_000, earliestExpiry - Date.now() - 60_000));
      }
      CacheService.set(cacheKey, validSources, ttlMs);
    }

    return {
      ok: validSources.length > 0,
      hasApiKey: true,
      statusCode: res.status,
      sources: validSources,
    };
  }

  async getLiveHub(adminChannels: LiveChannel[]): Promise<LiveHubResponse> {
    const [directChannels, sbGamesRaw, sbEventsRaw, epgMap] = await Promise.all([
      DirectChannelsService.getVerifiedChannels().catch(() => []),
      this.getGames().catch(() => []),
      this.getEvents().catch(() => []),
      this.getEpgAll().catch(() => new Map()),
    ]);

    const mergedChannels: LiveHubChannel[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const directByKey = new Map<string, (typeof directChannels)[number]>();

    for (const d of directChannels) {
      for (const k of d.matchKeys) {
        if (!directByKey.has(k)) directByKey.set(k, d);
      }
    }

    for (const adminCh of adminChannels) {
      if (!adminCh.active) continue;
      const isDirect =
        /\.m3u8(?:$|\?)|\.(?:mp4|m4v|webm|mkv|ts)(?:$|\?)/i.test(adminCh.streamUrl) ||
        /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(adminCh.streamUrl);
      const adminKeys = buildChannelMatchKeys(adminCh.name);
      const matchedDirect = adminKeys.map((k) => directByKey.get(k)).find(Boolean);

      // Skip any admin channel that is not a direct playable stream (no iframe/ad embeds)
      if (!isDirect && !matchedDirect) continue;

      seenIds.add(adminCh.id);
      seenNames.add(adminCh.name.trim().toLowerCase());
      const primaryDirectUrl = isDirect ? adminCh.streamUrl : matchedDirect!.verifiedUrls[0];
      const backups = isDirect
        ? matchedDirect?.verifiedUrls ?? []
        : matchedDirect!.verifiedUrls.slice(1);
      const epgEntry = matchedDirect
        ? DirectChannelsService.matchEpgForDirectChannel(matchedDirect, epgMap)
        : epgMap.get(adminCh.name.trim().toLowerCase()) ?? null;

      mergedChannels.push({
        ...adminCh,
        streamUrl: primaryDirectUrl,
        source: 'admin',
        isDirectStream: true,
        directStreamUrl: primaryDirectUrl,
        backupDirectUrls: backups,
        nowPlaying: epgEntry?.nowPlaying ?? null,
        nextProgram: epgEntry?.nextProgram ?? null,
      });
    }

    // Populate Canais Ao Vivo exclusively with verified direct ad-free HLS (.m3u8) streams
    for (const dCh of directChannels) {
      const nameKey = dCh.name.trim().toLowerCase();
      if (seenIds.has(dCh.id) || seenNames.has(nameKey)) continue;
      seenIds.add(dCh.id);
      seenNames.add(nameKey);
      const epgEntry = DirectChannelsService.matchEpgForDirectChannel(dCh, epgMap);
      mergedChannels.push(DirectChannelsService.toLiveHubChannel(dCh, epgEntry));
    }

    const games: LiveGameCard[] = [];
    for (const raw of sbGamesRaw) {
      const title = String(raw.title || '').trim();
      if (!title) continue;
      const players = Array.isArray(raw.players)
        ? raw.players.filter((p): p is string => typeof p === 'string' && /^https?:\/\//i.test(p))
        : [];
      const primaryUrl = players[0] || '';
      if (!primaryUrl) continue;
      const slugInfo = extractStreamBetterSlugFromUrl(primaryUrl);
      const slug = slugInfo?.slug || String(raw.id || '').trim();
      games.push({
        id: `sb_game_${String(raw.id || slug || games.length)}`,
        slug,
        title,
        sport: String(raw.sport || 'Esportes').trim() || 'Esportes',
        league: raw.data?.league ? String(raw.data.league).trim() : undefined,
        startTime: raw.data?.timer?.start ? normalizeTimestampToIso(raw.data.timer.start) || undefined : undefined,
        homeTeam: raw.data?.teams?.home?.name
          ? {
              name: String(raw.data.teams.home.name),
              image: raw.data.teams.home.image || null,
            }
          : undefined,
        awayTeam: raw.data?.teams?.away?.name
          ? {
              name: String(raw.data.teams.away.name),
              image: raw.data.teams.away.image || null,
            }
          : undefined,
        players,
        primaryUrl,
      });
    }

    const events: LiveEventCard[] = [];
    for (const raw of sbEventsRaw) {
      const title = String(raw.title || raw.name || '').trim();
      if (!title) continue;
      const players = Array.isArray(raw.players)
        ? raw.players.filter((p): p is string => typeof p === 'string' && /^https?:\/\//i.test(p))
        : [];
      const primaryUrl = (raw.url && /^https?:\/\//i.test(raw.url) ? raw.url : players[0]) || '';
      if (!primaryUrl) continue;
      const slugInfo = extractStreamBetterSlugFromUrl(primaryUrl);
      const slug = slugInfo?.slug || String(raw.id || '').trim();
      events.push({
        id: `sb_event_${String(raw.id || slug || events.length)}`,
        slug,
        title,
        category: String(raw.category || raw.sport || 'Ao Vivo').trim() || 'Ao Vivo',
        image: typeof raw.image === 'string' && raw.image.trim() ? raw.image.trim() : null,
        startTime: normalizeTimestampToIso(raw.start_time || raw.startAt) || undefined,
        players: players.length > 0 ? players : [primaryUrl],
        primaryUrl,
      });
    }

    const categories = Array.from(new Set(mergedChannels.map((c) => c.category)));
    const sports = Array.from(new Set(games.map((g) => g.sport).filter(Boolean)));

    return {
      channels: mergedChannels,
      games,
      events,
      categories,
      sports,
      hasStreamBetterKey: Boolean(SystemSettingsService.getActiveStreamBetterKey().key),
    };
  }

  async testConnection(): Promise<DiagnosticResult> {
    const started = Date.now();
    const keyInfo = SystemSettingsService.getActiveStreamBetterKey();

    try {
      const [titlesRes, channelsRes] = await Promise.all([
        this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/titles?tmdb_id=550`, {
          timeoutMs: 6000,
        }),
        this.fetchJson<unknown>(`${STREAMBETTER_BASE_URL}/api/channels`, {
          timeoutMs: 6000,
        }),
      ]);

      if (!titlesRes.ok && !channelsRes.ok) {
        return {
          target: 'streambetter',
          ok: false,
          latencyMs: Date.now() - started,
          statusCode: titlesRes.status || channelsRes.status,
          message: 'Não foi possível conectar aos endpoints JSON públicos do StreamBetter.',
          testedAt: new Date().toISOString(),
        };
      }

      if (!keyInfo.key) {
        return {
          target: 'streambetter',
          ok: true,
          latencyMs: Date.now() - started,
          statusCode: 200,
          message:
            'Feeds JSON públicos do StreamBetter online (canais, jogos, eventos, EPG e episódios). Cole a chave sb_sk_... acima para ativar extração direta .m3u8/.mp4 via /api/v1/stream.',
          detail: `Canais: ${channelsRes.ok ? 'OK' : 'indisponível'} · Chave /api/v1/stream: não configurada`,
          testedAt: new Date().toISOString(),
        };
      }

      const v1Res = await this.fetchV1Streams({
        tmdbId: 550,
        mediaType: 'movie',
      });

      if (v1Res.statusCode === 401) {
        return {
          target: 'streambetter',
          ok: false,
          latencyMs: Date.now() - started,
          statusCode: 401,
          message: 'Chave secreta StreamBetter recusada (HTTP 401). Verifique se a chave sb_sk_... está correta e ativa.',
          detail: `Origem da chave: ${keyInfo.source}`,
          testedAt: new Date().toISOString(),
        };
      }

      repositoryStore.addLog({
        level: 'info',
        service: 'StreamBetterService',
        message: `Diagnóstico StreamBetter concluído: ${v1Res.sources.length} stream(s) extraído(s) via /api/v1/stream.`,
      });

      return {
        target: 'streambetter',
        ok: true,
        latencyMs: Date.now() - started,
        statusCode: v1Res.statusCode ?? 200,
        message: v1Res.sources.length > 0
          ? `StreamBetter API JSON autenticada com sucesso (${v1Res.sources.length} faixa(s) direta(s) extraída(s) para TMDB 550).`
          : 'Feeds públicos e chave StreamBetter respondendo (nenhum stream ativo retornado para o ID de teste).',
        detail: `Origem da chave: ${keyInfo.source === 'admin_override' ? 'Painel Admin' : 'Variável de Ambiente'}`,
        testedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        target: 'streambetter',
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro ao testar StreamBetter: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: new Date().toISOString(),
      };
    }
  }
}

export const StreamBetterService = new StreamBetterServiceImpl();
