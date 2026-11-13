import type { EmbedPlayResponse, MediaType, PlayerConfig } from '../../shared/types';
import { playerConfigStore } from '../config/playerConfig';
import { repositoryStore } from '../repositories/interfaces';
import { MegaEmbedService } from './MegaEmbedService';

class PlayerServiceImpl {
  getConfig(): PlayerConfig {
    return playerConfigStore.getConfig();
  }

  updateConfig(partial: Partial<PlayerConfig>): PlayerConfig {
    const updated = playerConfigStore.updateConfig(partial);
    repositoryStore.addLog({
      level: 'info',
      service: 'PlayerService',
      message: `Configuração do player atualizada: ${updated.defaultDomain} (${updated.defaultPlayer}, #${updated.defaultColorHex}).`,
    });
    return updated;
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
    const result = MegaEmbedService.getEmbedPayload(params);
    repositoryStore.incrementPlaybackCounter();
    return result;
  }
}

export const PlayerService = new PlayerServiceImpl();
