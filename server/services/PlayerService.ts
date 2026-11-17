import {
  detectStreamKind,
  extractPlayerBranding,
  normalizeTmdbId,
  resolveHydratedSourceMode,
  resolveSandboxPolicy,
} from '../../shared/playerUrl.ts';
import { toIsoTimestamp } from '../../shared/siteConfigUtils.ts';
import type { EmbedPlayResponse, MediaType, PlayerConfig } from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';
import { MegaEmbedService } from './MegaEmbedService.ts';
import { SiteConfigService } from './SiteConfigService.ts';
import { StreamResolverService } from './StreamResolverService.ts';
import { TMDBService } from './TMDBService.ts';

class PlayerServiceImpl {
  private lastHydratedAt = 0;
  private readonly hydrationTtlMs = 20_000;

  async ensureHydrated(force = false): Promise<void> {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }

    const remote = await FirestoreRestService.getDocument<{
      sourceMode?: string;
      defaultDomain?: string;
      fallbackDomain?: string;
      autoFallback?: boolean;
      defaultPlayer?: string;
      defaultColorHex?: string;
      myembedBaseUrl?: string;
      antiAdSandbox?: boolean;
      preferImdbForMovies?: boolean;
      watchaflixBaseUrl?: string;
      watchaflixLang?: string;
      customEmbedMovieTemplate?: string;
      customEmbedTvTemplate?: string;
      embedTimeoutSeconds?: number;
      defaultAspectMode?: string;
      autoEnableSubtitles?: boolean;
      defaultSubtitleSize?: string;
      defaultSubtitleColor?: string;
      defaultSubtitleBg?: string;
      allowTvCast?: boolean;
      allowPipMode?: boolean;
      allowTheaterMode?: boolean;
      watermarkEnabled?: boolean;
      watermarkText?: string;
      watermarkLogoUrl?: string;
      watermarkPosition?: string;
      watermarkOpacity?: number;
      watermarkSize?: string;
      autoNextEpisode?: boolean;
      autoNextCountdownSeconds?: number;
      updatedAt?: unknown;
    }>('playerSettings/global');

    if (remote) {
      const local = playerConfigStore.getConfig();
      const localTs = Date.parse(local.updatedAt || '') || 0;
      const remoteIso = toIsoTimestamp(remote.updatedAt, '');
      const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
      if (localTs === 0 || remoteTs >= localTs || local.updatedAt === '2026-01-01T00:00:00.000Z') {
        const resolvedMode = resolveHydratedSourceMode({
          remoteSourceMode: remote.sourceMode,
          remoteAntiAdSandbox: remote.antiAdSandbox,
          remoteHasPrincipalFields: typeof remote.defaultAspectMode === 'string',
          fallback: local.sourceMode,
        });
        playerConfigStore.updateConfig(
          {
            sourceMode: resolvedMode,
            defaultDomain: remote.defaultDomain as PlayerConfig['defaultDomain'],
            fallbackDomain: remote.fallbackDomain as PlayerConfig['fallbackDomain'],
            autoFallback: remote.autoFallback,
            defaultPlayer: remote.defaultPlayer as PlayerConfig['defaultPlayer'],
            defaultColorHex: remote.defaultColorHex,
            myembedBaseUrl: remote.myembedBaseUrl,
            antiAdSandbox: remote.antiAdSandbox,
            preferImdbForMovies: remote.preferImdbForMovies,
            watchaflixBaseUrl: remote.watchaflixBaseUrl,
            watchaflixLang: remote.watchaflixLang as PlayerConfig['watchaflixLang'],
            customEmbedMovieTemplate: remote.customEmbedMovieTemplate,
            customEmbedTvTemplate: remote.customEmbedTvTemplate,
            embedTimeoutSeconds: remote.embedTimeoutSeconds,
            defaultAspectMode: remote.defaultAspectMode as PlayerConfig['defaultAspectMode'],
            autoEnableSubtitles: remote.autoEnableSubtitles,
            defaultSubtitleSize: remote.defaultSubtitleSize as PlayerConfig['defaultSubtitleSize'],
            defaultSubtitleColor: remote.defaultSubtitleColor as PlayerConfig['defaultSubtitleColor'],
            defaultSubtitleBg: remote.defaultSubtitleBg as PlayerConfig['defaultSubtitleBg'],
            allowTvCast: remote.allowTvCast,
            allowPipMode: remote.allowPipMode,
            allowTheaterMode: remote.allowTheaterMode,
            watermarkEnabled: remote.watermarkEnabled,
            watermarkText: remote.watermarkText,
            watermarkLogoUrl: remote.watermarkLogoUrl,
            watermarkPosition: remote.watermarkPosition as PlayerConfig['watermarkPosition'],
            watermarkOpacity: remote.watermarkOpacity,
            watermarkSize: remote.watermarkSize as PlayerConfig['watermarkSize'],
            autoNextEpisode: remote.autoNextEpisode,
            autoNextCountdownSeconds: remote.autoNextCountdownSeconds,
            updatedAt: remoteIso || undefined,
          },
          true
        );
      }
    }

    this.lastHydratedAt = Date.now();
  }

  getConfig(): PlayerConfig {
    return playerConfigStore.getConfig();
  }

  async getConfigAsync(): Promise<PlayerConfig> {
    await this.ensureHydrated();
    return playerConfigStore.getConfig();
  }

  updateConfig(partial: Partial<PlayerConfig>): PlayerConfig {
    const updated = playerConfigStore.updateConfig(partial);
    this.lastHydratedAt = Date.now();
    StreamResolverService.clearCache();
    repositoryStore.addLog({
      level: 'info',
      service: 'PlayerService',
      message: `Configuração do player atualizada: modo=${updated.sourceMode}, proporção=${updated.defaultAspectMode}, autoLegenda=${updated.autoEnableSubtitles}, autoPróximo=${updated.autoNextEpisode}, cor=#${updated.defaultColorHex}.`,
    });
    return updated;
  }

  async resolveStreamAsync(params: {
    tmdbId: string | number;
    mediaType: MediaType;
    domain?: string | null;
    player?: string | null;
    colorHex?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
  }): Promise<EmbedPlayResponse> {
    await Promise.all([this.ensureHydrated(), SiteConfigService.ensureHydrated()]);
    const cfg = playerConfigStore.getConfig();
    const numericId = normalizeTmdbId(params.tmdbId);

    const imdbPromise = numericId
      ? TMDBService.getExternalImdbId(numericId, params.mediaType).catch(() => null)
      : Promise.resolve(null);

    const customMatch =
      numericId && numericId > 0
        ? SiteConfigService.getCustomMatch(numericId, params.mediaType)
        : null;

    const playableStreamPromise = numericId
      ? StreamResolverService.resolvePlayableStreams({
          tmdbId: numericId,
          imdbIdPromise: imdbPromise,
          mediaType: params.mediaType,
          seasonNumber: params.seasonNumber,
          episodeNumber: params.episodeNumber,
          preferredLang: cfg.watchaflixLang,
          playerConfig: cfg,
          customStreamUrl: customMatch?.customStreamUrl,
        })
      : Promise.resolve({
          audioOptions: [],
          posterUrl: null,
          cloudflareOnly: false,
        });

    const [imdbId, playableStreams] = await Promise.all([imdbPromise, playableStreamPromise]);

    const subtitles = await StreamResolverService.resolveSubtitles({
      imdbId,
      mediaType: params.mediaType,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
    }).catch(() => []);

    const basePayload = this.resolveStream({ ...params, imdbId });

    if (playableStreams.audioOptions.length > 0) {
      const primary = playableStreams.audioOptions[0];
      return {
        ...basePayload,
        embedUrl: primary.streamUrl,
        streamKind: primary.streamKind,
        sandboxPolicy: 'none',
        audioOptions: playableStreams.audioOptions,
        subtitles,
        posterUrl: playableStreams.posterUrl,
        streamUnavailableReason: null,
      };
    }

    return {
      ...basePayload,
      subtitles,
      posterUrl: playableStreams.posterUrl,
      streamUnavailableReason: playableStreams.cloudflareOnly
        ? 'Este título exige verificação externa (Cloudflare) nas fontes configuradas e está temporariamente indisponível sem anúncios.'
        : 'Este título ainda não possui uma fonte de vídeo limpa disponível no momento.',
    };
  }

  resolveStream(params: {
    tmdbId: string | number;
    imdbId?: string | null;
    mediaType: MediaType;
    domain?: string | null;
    player?: string | null;
    colorHex?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
  }): EmbedPlayResponse {
    const numericId = Number(params.tmdbId);
    const customMatch =
      Number.isInteger(numericId) && numericId > 0
        ? SiteConfigService.getCustomMatch(numericId, params.mediaType)
        : null;

    if (customMatch?.customStreamUrl) {
      const cfg = playerConfigStore.getConfig();
      const streamKind = detectStreamKind(customMatch.customStreamUrl);
      const sandboxPolicy = resolveSandboxPolicy({
        streamKind,
        antiAdSandbox: cfg.antiAdSandbox,
      });
      repositoryStore.incrementPlaybackCounter();
      return {
        tmdbId: numericId,
        mediaType: params.mediaType,
        embedUrl: customMatch.customStreamUrl,
        domain: cfg.defaultDomain,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
        streamKind,
        sandboxPolicy,
        referrerPolicy: 'strict-origin',
        seasonNumber: params.mediaType === 'tv' ? params.seasonNumber ?? 1 : undefined,
        episodeNumber: params.mediaType === 'tv' ? params.episodeNumber ?? 1 : undefined,
        branding: extractPlayerBranding(cfg),
      };
    }

    const result = MegaEmbedService.getEmbedPayload(params);
    repositoryStore.incrementPlaybackCounter();
    return result;
  }
}

export const PlayerService = new PlayerServiceImpl();

