import {
  DEFAULT_PLAYER_CONFIG,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from '../../shared/playerUrl.ts';
import type { MegaEmbedDomain, MegaEmbedPlayer, PlayerConfig } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

class PlayerConfigStore {
  private getPersisted(): PlayerConfig {
    const stored = repositoryStore.getPlayerSettings();
    if (!stored) {
      return { ...DEFAULT_PLAYER_CONFIG };
    }
    return {
      ...DEFAULT_PLAYER_CONFIG,
      defaultDomain: validateMegaEmbedDomain(stored.defaultDomain, DEFAULT_PLAYER_CONFIG.defaultDomain),
      defaultPlayer: validateMegaEmbedPlayer(stored.defaultPlayer, DEFAULT_PLAYER_CONFIG.defaultPlayer),
      defaultColorHex: sanitizeHexColor(stored.defaultColorHex, DEFAULT_PLAYER_CONFIG.defaultColorHex),
    };
  }

  getConfig(): PlayerConfig {
    return this.getPersisted();
  }

  updateConfig(partial: Partial<PlayerConfig>): PlayerConfig {
    const current = this.getPersisted();

    const nextDomain: MegaEmbedDomain = partial.defaultDomain
      ? validateMegaEmbedDomain(partial.defaultDomain, current.defaultDomain)
      : current.defaultDomain;

    const nextPlayer: MegaEmbedPlayer = partial.defaultPlayer
      ? validateMegaEmbedPlayer(partial.defaultPlayer, current.defaultPlayer)
      : current.defaultPlayer;

    const nextColor = partial.defaultColorHex
      ? sanitizeHexColor(partial.defaultColorHex, current.defaultColorHex)
      : current.defaultColorHex;

    repositoryStore.savePlayerSettings({
      defaultDomain: nextDomain,
      defaultPlayer: nextPlayer,
      defaultColorHex: nextColor,
    });

    return this.getPersisted();
  }
}

export const playerConfigStore = new PlayerConfigStore();
