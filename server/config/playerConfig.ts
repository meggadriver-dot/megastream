import {
  DEFAULT_PLAYER_CONFIG,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from '../../shared/playerUrl';
import type { MegaEmbedDomain, MegaEmbedPlayer, PlayerConfig } from '../../shared/types';

class PlayerConfigStore {
  private config: PlayerConfig = { ...DEFAULT_PLAYER_CONFIG };

  getConfig(): PlayerConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<PlayerConfig>): PlayerConfig {
    const nextDomain: MegaEmbedDomain = partial.defaultDomain
      ? validateMegaEmbedDomain(partial.defaultDomain, this.config.defaultDomain)
      : this.config.defaultDomain;

    const nextPlayer: MegaEmbedPlayer = partial.defaultPlayer
      ? validateMegaEmbedPlayer(partial.defaultPlayer, this.config.defaultPlayer)
      : this.config.defaultPlayer;

    const nextColor = partial.defaultColorHex
      ? sanitizeHexColor(partial.defaultColorHex, this.config.defaultColorHex)
      : this.config.defaultColorHex;

    this.config = {
      ...this.config,
      defaultDomain: nextDomain,
      defaultPlayer: nextPlayer,
      defaultColorHex: nextColor,
    };
    return this.getConfig();
  }
}

export const playerConfigStore = new PlayerConfigStore();
