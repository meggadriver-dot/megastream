import {
  buildChannelMatchKeys,
  DIRECT_IPTV_PLAYLIST_URLS,
  normalizeChannelMatchKey,
  parseDirectChannelM3u,
  type DirectChannelGroup,
} from '../../shared/directChannelUtils.ts';
import type { LiveChannel, LiveEpgProgram, LiveHubChannel } from '../../shared/types.ts';
import { CacheService } from './CacheService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface VerifiedDirectChannel {
  id: string;
  matchKey: string;
  matchKeys: string[];
  name: string;
  category: LiveChannel['category'];
  logoUrl?: string;
  groupTitle: string;
  verifiedUrls: string[];
}

class DirectChannelsServiceImpl {
  private warmupPromise: Promise<void> | null = null;
  private groupsCache: { includeAdult: boolean; fetchedAt: number; groups: DirectChannelGroup[] } | null = null;
  private verifiedMap = new Map<string, { checkedAt: number; verifiedUrls: string[] }>();
  private readonly listTtlMs = 15 * 60 * 1000;
  private readonly probeTtlMs = 12 * 60 * 1000;

  private async fetchPlaylistText(url: string, signal?: AbortSignal): Promise<string> {
    const cacheKey = `direct_m3u:${url}`;
    const cached = CacheService.get<string>(cacheKey);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_UA,
          Accept: '*/*',
        },
      });
      if (!res.ok) return '';
      const text = await res.text();
      if (text && text.includes('#EXTM3U')) {
        CacheService.set(cacheKey, text, this.listTtlMs);
        return text;
      }
      return '';
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  private async getChannelGroups(includeAdult: boolean): Promise<DirectChannelGroup[]> {
    const now = Date.now();
    if (
      this.groupsCache &&
      this.groupsCache.includeAdult === includeAdult &&
      now - this.groupsCache.fetchedAt < this.listTtlMs
    ) {
      return this.groupsCache.groups;
    }

    const [
      brText,
      plutoBrText,
      freeTvBrText,
      freeTvPtText,
      freeTvLatinText,
      freeTvAnimText,
      freeTvMovText,
      freeTvSpoText,
      catMovText,
      catSerText,
      catAnimText,
      catSpoText,
      catKidsText,
      porText,
    ] = await Promise.all([
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.brazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.plutoBrazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvBrazil),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvPortugal),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvLatin),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvAnimation),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvMovies),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.freeTvSports),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryMovies),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categorySeries),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryAnimation),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categorySports),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.categoryKids),
      this.fetchPlaylistText(DIRECT_IPTV_PLAYLIST_URLS.portuguese),
    ]);

    const mergedMap = new Map<string, DirectChannelGroup>();
    const addGroups = (groups: DirectChannelGroup[], priorityBonus: number) => {
      for (const g of groups) {
        const existing = mergedMap.get(g.matchKey);
        if (!existing) {
          mergedMap.set(g.matchKey, {
            ...g,
            candidates: g.candidates.map((c) => ({
              ...c,
              qualityScore: c.qualityScore + priorityBonus,
            })),
          });
        } else {
          for (const cand of g.candidates) {
            if (!existing.candidates.some((c) => c.url === cand.url)) {
              existing.candidates.push({
                ...cand,
                qualityScore: cand.qualityScore + priorityBonus,
              });
            }
          }
          existing.candidates.sort((a, b) => b.qualityScore - a.qualityScore);
          if (!existing.logoUrl && g.logoUrl) {
            existing.logoUrl = g.logoUrl;
          }
        }
      }
    };

    // Prioritize Brazilian & Pluto playlists first, then Free-TV, categories, and Portuguese mirrors
    addGroups(parseDirectChannelM3u(brText, includeAdult), 30);
    addGroups(parseDirectChannelM3u(plutoBrText, includeAdult), 28);
    addGroups(parseDirectChannelM3u(freeTvBrText, includeAdult), 22);
    addGroups(parseDirectChannelM3u(freeTvLatinText, includeAdult), 18);
    addGroups(parseDirectChannelM3u(freeTvMovText, includeAdult), 16);
    addGroups(parseDirectChannelM3u(freeTvSpoText, includeAdult), 16);
    addGroups(parseDirectChannelM3u(freeTvAnimText, includeAdult), 14);
    addGroups(parseDirectChannelM3u(freeTvPtText, includeAdult), 12);
    addGroups(parseDirectChannelM3u(catMovText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catSerText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catSpoText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catAnimText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(catKidsText, includeAdult), 10);
    addGroups(parseDirectChannelM3u(porText, includeAdult), 0);

    const groups = Array.from(mergedMap.values());
    groups.sort((a, b) => {
      const aTop = a.candidates[0]?.qualityScore ?? 0;
      const bTop = b.candidates[0]?.qualityScore ?? 0;
      return bTop - aTop;
    });

    this.groupsCache = {
      includeAdult,
      fetchedAt: now,
      groups,
    };
    return groups;
  }

  async probeDirectHlsUrl(url: string, timeoutMs = 3200): Promise<boolean> {
    if (!/^https?:\/\//i.test(url)) return false;
    const cacheKey = `direct_probe:${url}`;
    const cached = CacheService.get<{ ok: boolean }>(cacheKey);
    if (cached !== null) return cached.ok;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': DESKTOP_UA,
          Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
        },
      });
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        CacheService.set(cacheKey, { ok: false }, 3 * 60 * 1000);
        return false;
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html') || ct.includes('application/xhtml')) {
        await res.body?.cancel().catch(() => {});
        CacheService.set(cacheKey, { ok: false }, 5 * 60 * 1000);
        return false;
      }

      if (ct.includes('video/mp2t') || ct.includes('video/mp4')) {
        await res.body?.cancel().catch(() => {});
        CacheService.set(cacheKey, { ok: true }, this.probeTtlMs);
        return true;
      }

      const reader = res.body?.getReader();
      let headText = '';
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        while (bytes < 2048) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value?.byteLength ?? 0;
          headText += decoder.decode(chunk.value, { stream: true });
          if (headText.includes('#EXTM3U')) break;
        }
        await reader.cancel().catch(() => {});
      }

      const lower = headText.trim().toLowerCase();
      if (lower.startsWith('<!doctype') || lower.startsWith('<html')) {
        CacheService.set(cacheKey, { ok: false }, 5 * 60 * 1000);
        return false;
      }

      const ok =
        headText.includes('#EXTM3U') ||
        ct.includes('mpegurl') ||
        ct.includes('octet-stream');
      CacheService.set(cacheKey, { ok }, ok ? this.probeTtlMs : 3 * 60 * 1000);
      return ok;
    } catch {
      CacheService.set(cacheKey, { ok: false }, 2 * 60 * 1000);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private async probeGroup(group: DirectChannelGroup): Promise<string[]> {
    const existing = this.verifiedMap.get(group.matchKey);
    const now = Date.now();
    if (existing && now - existing.checkedAt < this.probeTtlMs) {
      return existing.verifiedUrls;
    }

    const candidates = group.candidates.slice(0, 4).map((c) => c.url);
    const verifiedUrls: string[] = [];

    // Probe top 2 first, then remaining backups only if needed
    for (const url of candidates) {
      const ok = await this.probeDirectHlsUrl(url, 2800);
      if (ok) {
        verifiedUrls.push(url);
        if (verifiedUrls.length >= 2) break;
      }
    }

    this.verifiedMap.set(group.matchKey, {
      checkedAt: Date.now(),
      verifiedUrls,
    });
    return verifiedUrls;
  }

  private async runBatchProbes(groups: DirectChannelGroup[], concurrency = 32): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, groups.length) }, async () => {
      while (index < groups.length) {
        const currentIdx = index++;
        const group = groups[currentIdx];
        if (!group) break;
        await this.probeGroup(group);
      }
    });
    await Promise.all(workers);
  }

  private scheduleRemainingWarmup(groups: DirectChannelGroup[]): void {
    if (this.warmupPromise) return;
    const now = Date.now();
    const pending = groups.filter((g) => {
      const entry = this.verifiedMap.get(g.matchKey);
      return !entry || now - entry.checkedAt >= this.probeTtlMs;
    });
    if (pending.length === 0) return;

    this.warmupPromise = this.runBatchProbes(pending, 28)
      .catch(() => {})
      .finally(() => {
        this.warmupPromise = null;
      });
  }

  async getVerifiedChannels(): Promise<VerifiedDirectChannel[]> {
    const includeAdult = SystemSettingsService.getSettings().includeAdult;
    const groups = await this.getChannelGroups(includeAdult);
    if (groups.length === 0) return [];

    const now = Date.now();
    const uncached = groups.filter((g) => {
      const entry = this.verifiedMap.get(g.matchKey);
      return !entry || now - entry.checkedAt >= this.probeTtlMs;
    });

    if (uncached.length > 0) {
      // Synchronously verify top priority batch within 4s budget so Live Hub responds fast with verified direct streams
      const initialBatch = uncached.slice(0, 128);
      await Promise.race([
        this.runBatchProbes(initialBatch, 48),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);
      // Finish the rest seamlessly in background
      this.scheduleRemainingWarmup(groups);
    }

    const verified: VerifiedDirectChannel[] = [];
    for (const g of groups) {
      const status = this.verifiedMap.get(g.matchKey);
      if (status && status.verifiedUrls.length > 0) {
        verified.push({
          id: g.id,
          matchKey: g.matchKey,
          matchKeys: g.matchKeys,
          name: g.name,
          category: g.category,
          logoUrl: g.logoUrl,
          groupTitle: g.groupTitle,
          verifiedUrls: status.verifiedUrls,
        });
      }
    }
    return verified;
  }

  async resolveWorkingStreams(params: {
    id?: string;
    slug?: string;
    title?: string;
    rawUrl?: string;
  }): Promise<string[]> {
    const includeAdult = SystemSettingsService.getSettings().includeAdult;
    const groups = await this.getChannelGroups(includeAdult);

    const candidateUrls: string[] = [];
    const pushUrl = (u?: string) => {
      if (u && /^https?:\/\//i.test(u) && !candidateUrls.includes(u)) {
        candidateUrls.push(u);
      }
    };

    if (
      params.rawUrl &&
      (/\.m3u8(?:$|\?)/i.test(params.rawUrl) ||
        /^https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(params.rawUrl))
    ) {
      pushUrl(params.rawUrl);
    }

    const searchKeys = new Set<string>();
    if (params.id?.startsWith('direct_ch_')) {
      searchKeys.add(params.id.slice('direct_ch_'.length));
    }
    if (params.slug) {
      for (const k of buildChannelMatchKeys(params.slug.replace(/-/g, ' '))) {
        searchKeys.add(k);
      }
    }
    if (params.title) {
      for (const k of buildChannelMatchKeys(params.title)) {
        searchKeys.add(k);
      }
    }

    for (const g of groups) {
      const matches =
        searchKeys.has(g.matchKey) ||
        g.matchKeys.some((k) => searchKeys.has(k));
      if (matches) {
        const cached = this.verifiedMap.get(g.matchKey);
        if (cached && cached.verifiedUrls.length > 0) {
          for (const u of cached.verifiedUrls) pushUrl(u);
        }
        for (const c of g.candidates) pushUrl(c.url);
      }
    }

    if (candidateUrls.length === 0) return [];

    const working: string[] = [];
    for (const u of candidateUrls.slice(0, 6)) {
      const ok = await this.probeDirectHlsUrl(u, 3200);
      if (ok) {
        working.push(u);
        if (working.length >= 3) break;
      }
    }
    return working;
  }

  matchEpgForDirectChannel(
    channel: VerifiedDirectChannel,
    epgMap: Map<string, { nowPlaying: LiveEpgProgram | null; nextProgram: LiveEpgProgram | null }>
  ): { nowPlaying: LiveEpgProgram | null; nextProgram: LiveEpgProgram | null } | null {
    const slugDash = channel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const exact = epgMap.get(slugDash) ?? epgMap.get(channel.name.toLowerCase());
    if (exact) return exact;

    for (const [epgKey, entry] of epgMap.entries()) {
      const epgNorm = normalizeChannelMatchKey(epgKey.replace(/-/g, ' '));
      if (!epgNorm) continue;
      if (channel.matchKeys.includes(epgNorm)) {
        return entry;
      }
    }
    return null;
  }

  toLiveHubChannel(
    ch: VerifiedDirectChannel,
    epgEntry: { nowPlaying: LiveEpgProgram | null; nextProgram: LiveEpgProgram | null } | null
  ): LiveHubChannel {
    return {
      id: ch.id,
      slug: ch.matchKey,
      name: ch.name,
      category: ch.category,
      streamUrl: ch.verifiedUrls[0],
      logoUrl: ch.logoUrl,
      description: epgEntry?.nowPlaying?.title
        ? `Agora: ${epgEntry.nowPlaying.title}`
        : ch.groupTitle || 'Transmissão direta em alta definição',
      active: true,
      createdAt: new Date().toISOString(),
      source: 'direct',
      isDirectStream: true,
      directStreamUrl: ch.verifiedUrls[0],
      backupDirectUrls: ch.verifiedUrls.slice(1),
      nowPlaying: epgEntry?.nowPlaying ?? null,
      nextProgram: epgEntry?.nextProgram ?? null,
    };
  }
}

export const DirectChannelsService = new DirectChannelsServiceImpl();
