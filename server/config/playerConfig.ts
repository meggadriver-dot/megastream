import {
  DEFAULT_PLAYER_CONFIG,
  normalizeMyEmbedBaseUrl,
  normalizeWatchaFlixBaseUrl,
  sanitizeAutoNextCountdownSeconds,
  sanitizeCustomVideoSources,
  sanitizeEmbedTemplate,
  sanitizeEmbedTimeoutSeconds,
  sanitizeHexColor,
  sanitizeWatermarkLogoUrl,
  sanitizeWatermarkOpacity,
  sanitizeWatermarkText,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
  validatePlayerAspectMode,
  validatePlayerSourceMode,
  validateSubtitleBg,
  validateSubtitleColor,
  validateSubtitleSize,
  validateWatchaFlixLang,
  validateWatermarkPosition,
  validateWatermarkSize,
} from '../../shared/playerUrl.ts';
import type {
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerAspectMode,
  PlayerConfig,
  PlayerSourceMode,
  PlayerSubtitleBg,
  PlayerSubtitleColor,
  PlayerSubtitleSize,
  WatchaFlixLang,
  WatermarkPosition,
  WatermarkSize,
} from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

class PlayerConfigStore {
  private getPersisted(): PlayerConfig {
    const stored = repositoryStore.getPlayerSettings();
    if (!stored) {
      return { ...DEFAULT_PLAYER_CONFIG };
    }
    const sourceMode: PlayerSourceMode = validatePlayerSourceMode(
      stored.sourceMode,
      DEFAULT_PLAYER_CONFIG.sourceMode
    );
    return {
      ...DEFAULT_PLAYER_CONFIG,
      sourceMode,
      defaultDomain: validateMegaEmbedDomain(
        stored.defaultDomain,
        DEFAULT_PLAYER_CONFIG.defaultDomain
      ),
      fallbackDomain: validateMegaEmbedDomain(
        stored.fallbackDomain,
        DEFAULT_PLAYER_CONFIG.fallbackDomain
      ),
      autoFallback:
        typeof stored.autoFallback === 'boolean'
          ? stored.autoFallback
          : DEFAULT_PLAYER_CONFIG.autoFallback,
      defaultPlayer: validateMegaEmbedPlayer(
        stored.defaultPlayer,
        DEFAULT_PLAYER_CONFIG.defaultPlayer
      ),
      defaultColorHex: sanitizeHexColor(
        stored.defaultColorHex,
        DEFAULT_PLAYER_CONFIG.defaultColorHex
      ),
      myembedBaseUrl: normalizeMyEmbedBaseUrl(stored.myembedBaseUrl),
      antiAdSandbox:
        typeof stored.antiAdSandbox === 'boolean'
          ? stored.antiAdSandbox
          : DEFAULT_PLAYER_CONFIG.antiAdSandbox,
      preferImdbForMovies:
        typeof stored.preferImdbForMovies === 'boolean'
          ? stored.preferImdbForMovies
          : DEFAULT_PLAYER_CONFIG.preferImdbForMovies,
      watchaflixBaseUrl: normalizeWatchaFlixBaseUrl(stored.watchaflixBaseUrl),
      watchaflixLang: validateWatchaFlixLang(
        stored.watchaflixLang,
        DEFAULT_PLAYER_CONFIG.watchaflixLang
      ),
      customEmbedMovieTemplate: sanitizeEmbedTemplate(stored.customEmbedMovieTemplate),
      customEmbedTvTemplate: sanitizeEmbedTemplate(stored.customEmbedTvTemplate),
      customSources: sanitizeCustomVideoSources(stored.customSources),
      embedTimeoutSeconds: sanitizeEmbedTimeoutSeconds(
        stored.embedTimeoutSeconds,
        DEFAULT_PLAYER_CONFIG.embedTimeoutSeconds
      ),
      defaultAspectMode: validatePlayerAspectMode(
        stored.defaultAspectMode,
        DEFAULT_PLAYER_CONFIG.defaultAspectMode
      ),
      autoEnableSubtitles:
        typeof stored.autoEnableSubtitles === 'boolean'
          ? stored.autoEnableSubtitles
          : DEFAULT_PLAYER_CONFIG.autoEnableSubtitles,
      defaultSubtitleSize: validateSubtitleSize(
        stored.defaultSubtitleSize,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleSize
      ),
      defaultSubtitleColor: validateSubtitleColor(
        stored.defaultSubtitleColor,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleColor
      ),
      defaultSubtitleBg: validateSubtitleBg(
        stored.defaultSubtitleBg,
        DEFAULT_PLAYER_CONFIG.defaultSubtitleBg
      ),
      allowTvCast:
        typeof stored.allowTvCast === 'boolean'
          ? stored.allowTvCast
          : DEFAULT_PLAYER_CONFIG.allowTvCast,
      allowPipMode:
        typeof stored.allowPipMode === 'boolean'
          ? stored.allowPipMode
          : DEFAULT_PLAYER_CONFIG.allowPipMode,
      allowTheaterMode:
        typeof stored.allowTheaterMode === 'boolean'
          ? stored.allowTheaterMode
          : DEFAULT_PLAYER_CONFIG.allowTheaterMode,
      watermarkEnabled:
        typeof stored.watermarkEnabled === 'boolean'
          ? stored.watermarkEnabled
          : DEFAULT_PLAYER_CONFIG.watermarkEnabled,
      watermarkText:
        stored.watermarkText !== undefined
          ? sanitizeWatermarkText(stored.watermarkText)
          : DEFAULT_PLAYER_CONFIG.watermarkText,
      watermarkLogoUrl:
        stored.watermarkLogoUrl !== undefined
          ? sanitizeWatermarkLogoUrl(stored.watermarkLogoUrl)
          : DEFAULT_PLAYER_CONFIG.watermarkLogoUrl,
      watermarkPosition: validateWatermarkPosition(
        stored.watermarkPosition,
        DEFAULT_PLAYER_CONFIG.watermarkPosition
      ),
      watermarkOpacity: sanitizeWatermarkOpacity(
        stored.watermarkOpacity,
        DEFAULT_PLAYER_CONFIG.watermarkOpacity
      ),
      watermarkSize: validateWatermarkSize(
        stored.watermarkSize,
        DEFAULT_PLAYER_CONFIG.watermarkSize
      ),
      autoNextEpisode:
        typeof stored.autoNextEpisode === 'boolean'
          ? stored.autoNextEpisode
          : DEFAULT_PLAYER_CONFIG.autoNextEpisode,
      autoNextCountdownSeconds: sanitizeAutoNextCountdownSeconds(
        stored.autoNextCountdownSeconds,
        DEFAULT_PLAYER_CONFIG.autoNextCountdownSeconds
      ),
      updatedAt: stored.updatedAt ?? DEFAULT_PLAYER_CONFIG.updatedAt,
    };
  }

  getConfig(): PlayerConfig {
    return this.getPersisted();
  }

  updateConfig(partial: Partial<PlayerConfig>, preserveUpdatedAt = false): PlayerConfig {
    const current = this.getPersisted();

    const nextSourceMode: PlayerSourceMode = validatePlayerSourceMode(
      partial.sourceMode,
      current.sourceMode
    );

    const nextDomain: MegaEmbedDomain = partial.defaultDomain
      ? validateMegaEmbedDomain(partial.defaultDomain, current.defaultDomain)
      : current.defaultDomain;

    const nextFallback: MegaEmbedDomain = partial.fallbackDomain
      ? validateMegaEmbedDomain(partial.fallbackDomain, current.fallbackDomain)
      : current.fallbackDomain;

    const nextAutoFallback =
      typeof partial.autoFallback === 'boolean' ? partial.autoFallback : current.autoFallback;

    const nextPlayer: MegaEmbedPlayer = partial.defaultPlayer
      ? validateMegaEmbedPlayer(partial.defaultPlayer, current.defaultPlayer)
      : current.defaultPlayer;

    const nextColor = partial.defaultColorHex
      ? sanitizeHexColor(partial.defaultColorHex, current.defaultColorHex)
      : current.defaultColorHex;

    const nextMyEmbedBaseUrl =
      partial.myembedBaseUrl !== undefined
        ? normalizeMyEmbedBaseUrl(partial.myembedBaseUrl)
        : current.myembedBaseUrl;

    const nextAntiAdSandbox =
      typeof partial.antiAdSandbox === 'boolean'
        ? partial.antiAdSandbox
        : current.antiAdSandbox;

    const nextPreferImdb =
      typeof partial.preferImdbForMovies === 'boolean'
        ? partial.preferImdbForMovies
        : current.preferImdbForMovies;

    const nextWatchaflixBaseUrl =
      partial.watchaflixBaseUrl !== undefined
        ? normalizeWatchaFlixBaseUrl(partial.watchaflixBaseUrl)
        : current.watchaflixBaseUrl;

    const nextWatchaflixLang: WatchaFlixLang =
      partial.watchaflixLang !== undefined
        ? validateWatchaFlixLang(partial.watchaflixLang, current.watchaflixLang)
        : current.watchaflixLang;

    const nextMovieTpl =
      partial.customEmbedMovieTemplate !== undefined
        ? sanitizeEmbedTemplate(partial.customEmbedMovieTemplate)
        : current.customEmbedMovieTemplate;

    const nextTvTpl =
      partial.customEmbedTvTemplate !== undefined
        ? sanitizeEmbedTemplate(partial.customEmbedTvTemplate)
        : current.customEmbedTvTemplate;

    const nextCustomSources =
      partial.customSources !== undefined
        ? sanitizeCustomVideoSources(partial.customSources)
        : current.customSources ?? [];

    const nextTimeout =
      partial.embedTimeoutSeconds !== undefined
        ? sanitizeEmbedTimeoutSeconds(partial.embedTimeoutSeconds, current.embedTimeoutSeconds)
        : current.embedTimeoutSeconds;

    const nextAspectMode: PlayerAspectMode =
      partial.defaultAspectMode !== undefined
        ? validatePlayerAspectMode(partial.defaultAspectMode, current.defaultAspectMode)
        : current.defaultAspectMode;

    const nextAutoEnableSubtitles =
      typeof partial.autoEnableSubtitles === 'boolean'
        ? partial.autoEnableSubtitles
        : current.autoEnableSubtitles;

    const nextSubtitleSize: PlayerSubtitleSize =
      partial.defaultSubtitleSize !== undefined
        ? validateSubtitleSize(partial.defaultSubtitleSize, current.defaultSubtitleSize)
        : current.defaultSubtitleSize;

    const nextSubtitleColor: PlayerSubtitleColor =
      partial.defaultSubtitleColor !== undefined
        ? validateSubtitleColor(partial.defaultSubtitleColor, current.defaultSubtitleColor)
        : current.defaultSubtitleColor;

    const nextSubtitleBg: PlayerSubtitleBg =
      partial.defaultSubtitleBg !== undefined
        ? validateSubtitleBg(partial.defaultSubtitleBg, current.defaultSubtitleBg)
        : current.defaultSubtitleBg;

    const nextAllowTvCast =
      typeof partial.allowTvCast === 'boolean' ? partial.allowTvCast : current.allowTvCast;

    const nextAllowPipMode =
      typeof partial.allowPipMode === 'boolean' ? partial.allowPipMode : current.allowPipMode;

    const nextAllowTheaterMode =
      typeof partial.allowTheaterMode === 'boolean'
        ? partial.allowTheaterMode
        : current.allowTheaterMode;

    const nextWatermarkEnabled =
      typeof partial.watermarkEnabled === 'boolean'
        ? partial.watermarkEnabled
        : current.watermarkEnabled;

    const nextWatermarkText =
      partial.watermarkText !== undefined
        ? sanitizeWatermarkText(partial.watermarkText)
        : current.watermarkText;

    const nextWatermarkLogoUrl =
      partial.watermarkLogoUrl !== undefined
        ? sanitizeWatermarkLogoUrl(partial.watermarkLogoUrl)
        : current.watermarkLogoUrl;

    const nextWatermarkPosition: WatermarkPosition =
      partial.watermarkPosition !== undefined
        ? validateWatermarkPosition(partial.watermarkPosition, current.watermarkPosition)
        : current.watermarkPosition;

    const nextWatermarkOpacity =
      partial.watermarkOpacity !== undefined
        ? sanitizeWatermarkOpacity(partial.watermarkOpacity, current.watermarkOpacity)
        : current.watermarkOpacity;

    const nextWatermarkSize: WatermarkSize =
      partial.watermarkSize !== undefined
        ? validateWatermarkSize(partial.watermarkSize, current.watermarkSize)
        : current.watermarkSize;

    const nextAutoNextEpisode =
      typeof partial.autoNextEpisode === 'boolean'
        ? partial.autoNextEpisode
        : current.autoNextEpisode;

    const nextAutoNextCountdown =
      partial.autoNextCountdownSeconds !== undefined
        ? sanitizeAutoNextCountdownSeconds(
            partial.autoNextCountdownSeconds,
            current.autoNextCountdownSeconds
          )
        : current.autoNextCountdownSeconds;

    const updatedAt =
      preserveUpdatedAt && partial.updatedAt
        ? partial.updatedAt
        : new Date().toISOString();

    repositoryStore.savePlayerSettings({
      sourceMode: nextSourceMode,
      defaultDomain: nextDomain,
      fallbackDomain: nextFallback,
      autoFallback: nextAutoFallback,
      defaultPlayer: nextPlayer,
      defaultColorHex: nextColor,
      myembedBaseUrl: nextMyEmbedBaseUrl,
      antiAdSandbox: nextAntiAdSandbox,
      preferImdbForMovies: nextPreferImdb,
      watchaflixBaseUrl: nextWatchaflixBaseUrl,
      watchaflixLang: nextWatchaflixLang,
      customEmbedMovieTemplate: nextMovieTpl,
      customEmbedTvTemplate: nextTvTpl,
      customSources: nextCustomSources,
      embedTimeoutSeconds: nextTimeout,
      defaultAspectMode: nextAspectMode,
      autoEnableSubtitles: nextAutoEnableSubtitles,
      defaultSubtitleSize: nextSubtitleSize,
      defaultSubtitleColor: nextSubtitleColor,
      defaultSubtitleBg: nextSubtitleBg,
      allowTvCast: nextAllowTvCast,
      allowPipMode: nextAllowPipMode,
      allowTheaterMode: nextAllowTheaterMode,
      watermarkEnabled: nextWatermarkEnabled,
      watermarkText: nextWatermarkText,
      watermarkLogoUrl: nextWatermarkLogoUrl,
      watermarkPosition: nextWatermarkPosition,
      watermarkOpacity: nextWatermarkOpacity,
      watermarkSize: nextWatermarkSize,
      autoNextEpisode: nextAutoNextEpisode,
      autoNextCountdownSeconds: nextAutoNextCountdown,
      updatedAt,
    });

    return this.getPersisted();
  }
}

export const playerConfigStore = new PlayerConfigStore();
