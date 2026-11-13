import {
  buildMegaEmbedUrl,
  normalizeTmdbId,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from '../../shared/playerUrl';
import type { EmbedPlayResponse, MediaType } from '../../shared/types';
import { playerConfigStore } from '../config/playerConfig';

class MegaEmbedServiceImpl {
  getEmbedPayload(params: {
    tmdbId: string | number;
    mediaType: MediaType;
    domain?: string | null;
    player?: string | null;
    colorHex?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
  }): EmbedPlayResponse {
    const validId = normalizeTmdbId(params.tmdbId);
    if (!validId) {
      throw new Error('Identificador TMDB inválido.');
    }

    const cfg = playerConfigStore.getConfig();
    const domain = validateMegaEmbedDomain(params.domain, cfg.defaultDomain);
    const player = validateMegaEmbedPlayer(params.player, cfg.defaultPlayer);
    const colorHex = sanitizeHexColor(params.colorHex, cfg.defaultColorHex);

    const embedUrl = buildMegaEmbedUrl({
      tmdbId: validId,
      domain,
      player,
      colorHex,
      mediaType: params.mediaType,
    });

    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      ...(params.mediaType === 'tv'
        ? {
            seriesSupportNote: cfg.seriesLimitationNote,
          }
        : {}),
    };
  }
}

export const MegaEmbedService = new MegaEmbedServiceImpl();
