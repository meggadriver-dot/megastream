import {
  DEFAULT_PLAYER_CONFIG,
  normalizeMyEmbedBaseUrl,
  normalizeWatchaFlixBaseUrl,
  sanitizeEmbedTemplate,
  sanitizeEmbedTimeoutSeconds,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
  validatePlayerSourceMode,
  validateWatchaFlixLang,
} from '../../shared/playerUrl.ts';
import type {
  MegaEmbedDomain,
  MegaEmbedPlayer,
  PlayerConfig,
  PlayerSourceMode,
  WatchaFlixLang,
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
      watchaflixBaseUrl: normalizeWatchaFlixBaseUrl(stored.watchaflixBaseUrl),
      watchaflixLang: validateWatchaFlixLang(
        stored.watchaflixLang,
        DEFAULT_PLAYER_CONFIG.watchaflixLang
      ),
      customEmbedMovieTemplate: sanitizeEmbedTemplate(stored.customEmbedMovieTemplate),
      customEmbedTvTemplate: sanitizeEmbedTemplate(stored.customEmbedTvTemplate),
      embedTimeoutSeconds: sanitizeEmbedTimeoutSeconds(
        stored.embedTimeoutSeconds,
        DEFAULT_PLAYER_CONFIG.embedTimeoutSeconds
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

    const nextTimeout =
      partial.embedTimeoutSeconds !== undefined
        ? sanitizeEmbedTimeoutSeconds(partial.embedTimeoutSeconds, current.embedTimeoutSeconds)
        : current.embedTimeoutSeconds;

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
      watchaflixBaseUrl: nextWatchaflixBaseUrl,
      watchaflixLang: nextWatchaflixLang,
      customEmbedMovieTemplate: nextMovieTpl,
      customEmbedTvTemplate: nextTvTpl,
      embedTimeoutSeconds: nextTimeout,
      updatedAt,
    });

    return this.getPersisted();
  }
}

export const playerConfigStore = new PlayerConfigStore();
