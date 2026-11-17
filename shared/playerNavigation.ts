import type { EpisodeItem, MediaType, SeasonSummary } from './types.ts';

export const PLAYER_LAST_ROUTE_KEY = 'ms_last_non_player_route';

export interface NextEpisodeTarget {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  isNewSeason: boolean;
}

export function resolveNextEpisode(params: {
  currentSeason: number;
  currentEpisode: number;
  seasons?: SeasonSummary[] | null;
  episodes?: EpisodeItem[] | null;
}): NextEpisodeTarget | null {
  const currentSeason = Number.isInteger(params.currentSeason) ? params.currentSeason : 1;
  const currentEpisode = Number.isInteger(params.currentEpisode) ? params.currentEpisode : 1;

  const sortedEpisodes = [...(params.episodes ?? [])]
    .filter((ep) => ep.seasonNumber === currentSeason && ep.episodeNumber > 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);

  const nextInSeason = sortedEpisodes.find((ep) => ep.episodeNumber > currentEpisode);
  if (nextInSeason) {
    return {
      seasonNumber: nextInSeason.seasonNumber,
      episodeNumber: nextInSeason.episodeNumber,
      title: nextInSeason.name || `Episódio ${nextInSeason.episodeNumber}`,
      isNewSeason: false,
    };
  }

  // Also handle case where TMDB season metadata shows more episodes than loaded list
  const currentSeasonSummary = (params.seasons ?? []).find(
    (s) => s.seasonNumber === currentSeason
  );
  if (
    sortedEpisodes.length === 0 &&
    currentSeasonSummary &&
    currentEpisode < currentSeasonSummary.episodeCount
  ) {
    return {
      seasonNumber: currentSeason,
      episodeNumber: currentEpisode + 1,
      title: `Episódio ${currentEpisode + 1}`,
      isNewSeason: false,
    };
  }

  // Advance to the next regular season (skip season 0 specials when moving forward)
  const nextSeasons = [...(params.seasons ?? [])]
    .filter(
      (s) =>
        s.seasonNumber > currentSeason &&
        s.seasonNumber > 0 &&
        s.episodeCount > 0
    )
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const nextSeason = nextSeasons[0];
  if (nextSeason) {
    return {
      seasonNumber: nextSeason.seasonNumber,
      episodeNumber: 1,
      title: `${nextSeason.name || `Temporada ${nextSeason.seasonNumber}`} · Ep. 1`,
      isNewSeason: true,
    };
  }

  return null;
}

export function parsePlayerPostMessageEvent(
  rawData: unknown
): { ended: boolean; nextRequested?: boolean } {
  if (!rawData) return { ended: false };

  let obj: Record<string, unknown> | null = null;
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    if (
      trimmed === 'ended' ||
      trimmed === 'complete' ||
      trimmed === 'video_ended' ||
      trimmed === 'MEDIA_ENDED'
    ) {
      return { ended: true };
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        obj = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return { ended: false };
      }
    } else {
      return { ended: false };
    }
  } else if (typeof rawData === 'object') {
    obj = rawData as Record<string, unknown>;
  }

  if (!obj) return { ended: false };

  const eventName = String(
    obj.event ?? obj.type ?? obj.action ?? obj.name ?? ''
  ).toLowerCase();

  if (
    eventName === 'ended' ||
    eventName === 'complete' ||
    eventName === 'video_ended' ||
    eventName === 'media_ended' ||
    eventName === 'playback_ended' ||
    obj.ended === true
  ) {
    return { ended: true };
  }

  if (eventName === 'next' || eventName === 'next_episode') {
    return { ended: true, nextRequested: true };
  }

  const currentTime = typeof obj.currentTime === 'number' ? obj.currentTime : NaN;
  const duration = typeof obj.duration === 'number' ? obj.duration : NaN;
  if (
    Number.isFinite(currentTime) &&
    Number.isFinite(duration) &&
    duration > 30 &&
    currentTime >= duration - 1.5
  ) {
    return { ended: true };
  }

  return { ended: false };
}

export function isPlayerRoute(pathOrUrl: string): boolean {
  const clean = pathOrUrl.trim().split('?')[0].split('#')[0];
  return clean === '/watch' || clean.startsWith('/watch/');
}

export function isTrackableNonPlayerRoute(pathname: string): boolean {
  const clean = pathname.trim().split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) return false;
  if (isPlayerRoute(clean)) return false;
  if (clean === '/profiles' || clean.startsWith('/profiles/')) return false;
  return true;
}

export function resolvePlayerBackTarget(params: {
  lastNonPlayerRoute?: string | null;
  mediaType: MediaType;
  tmdbId?: string | number | null;
}): string {
  const candidate = (params.lastNonPlayerRoute || '').trim();
  if (
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !isPlayerRoute(candidate) &&
    candidate !== '/profiles' &&
    !candidate.startsWith('/profiles/')
  ) {
    return candidate;
  }

  const numericId = Number(params.tmdbId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return params.mediaType === 'tv' ? `/series/${numericId}` : `/movie/${numericId}`;
  }

  return '/';
}

export const SKIP_NEXT_FINAL_WINDOW_SECONDS = 45;

export function shouldShowSkipNextInPlayer(params: {
  hasNextEpisode: boolean;
  durationSeconds: number;
  currentTimeSeconds: number;
  isEnded?: boolean;
}): boolean {
  if (!params.hasNextEpisode) return false;
  if (params.isEnded) return true;
  const duration = params.durationSeconds;
  const current = params.currentTimeSeconds;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (!Number.isFinite(current) || current < 0) return false;
  if (duration <= 60) {
    return current >= duration * 0.75;
  }
  return duration - current <= SKIP_NEXT_FINAL_WINDOW_SECONDS;
}

