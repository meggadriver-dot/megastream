import {
  buildMegaEmbedUrl,
  normalizeEpisodeNumber,
  normalizeSeasonNumber,
  normalizeTmdbId,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from '../../shared/playerUrl.ts';
import type { EmbedPlayResponse, MediaType } from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';

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
    const seasonNumber =
      params.mediaType === 'tv' ? normalizeSeasonNumber(params.seasonNumber, 1) : undefined;
    const episodeNumber =
      params.mediaType === 'tv' ? normalizeEpisodeNumber(params.episodeNumber, 1) : undefined;

    const embedUrl = buildMegaEmbedUrl({
      tmdbId: validId,
      domain,
      player,
      colorHex,
      mediaType: params.mediaType,
      seasonNumber,
      episodeNumber,
    });

    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      seasonNumber,
      episodeNumber,
      ...(params.mediaType === 'tv' && !cfg.seriesSeasonEpisodeDocumented
        ? {
            seriesSupportNote: cfg.seriesLimitationNote,
          }
        : {}),
    };
  }
}

export const MegaEmbedService = new MegaEmbedServiceImpl();
