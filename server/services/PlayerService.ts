import type { EmbedPlayResponse, MediaType, PlayerConfig } from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';
import { MegaEmbedService } from './MegaEmbedService.ts';
import { SiteConfigService } from './SiteConfigService.ts';

class PlayerServiceImpl {
  private lastHydratedAt = 0;
  private readonly hydrationTtlMs = 20_000;

  async ensureHydrated(force = false): Promise<void> {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }

    const remote = await FirestoreRestService.getDocument<{
      defaultDomain?: string;
      defaultPlayer?: string;
      defaultColorHex?: string;
    }>('playerSettings/global');

    if (remote) {
      playerConfigStore.updateConfig({
        defaultDomain: remote.defaultDomain as PlayerConfig['defaultDomain'],
        defaultPlayer: remote.defaultPlayer as PlayerConfig['defaultPlayer'],
        defaultColorHex: remote.defaultColorHex,
      });
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
    repositoryStore.addLog({
      level: 'info',
      service: 'PlayerService',
      message: `Configuração do player atualizada: ${updated.defaultDomain} (${updated.defaultPlayer}, #${updated.defaultColorHex}).`,
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
    return this.resolveStream(params);
  }

  resolveStream(params: {
    tmdbId: string | number;
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
      repositoryStore.incrementPlaybackCounter();
      return {
        tmdbId: numericId,
        mediaType: params.mediaType,
        embedUrl: customMatch.customStreamUrl,
        domain: cfg.defaultDomain,
        player: cfg.defaultPlayer,
        colorHex: cfg.defaultColorHex,
        seasonNumber: params.mediaType === 'tv' ? params.seasonNumber ?? 1 : undefined,
        episodeNumber: params.mediaType === 'tv' ? params.episodeNumber ?? 1 : undefined,
      };
    }

    const result = MegaEmbedService.getEmbedPayload(params);
    repositoryStore.incrementPlaybackCounter();
    return result;
  }
}

export const PlayerService = new PlayerServiceImpl();

