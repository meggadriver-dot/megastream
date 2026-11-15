import {
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildWatchaFlixEmbedUrl,
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

    let embedUrl: string | null = null;
    let referrerPolicy: 'no-referrer' | 'strict-origin' = 'no-referrer';

    if (cfg.sourceMode === 'watchaflix') {
      embedUrl = buildWatchaFlixEmbedUrl({
        tmdbId: validId,
        mediaType: params.mediaType,
        seasonNumber,
        episodeNumber,
        baseUrl: cfg.watchaflixBaseUrl,
        colorHex,
        lang: cfg.watchaflixLang,
      });
      referrerPolicy = 'strict-origin';
    } else if (cfg.sourceMode === 'custom_template') {
      const tpl =
        params.mediaType === 'tv' ? cfg.customEmbedTvTemplate : cfg.customEmbedMovieTemplate;
      if (tpl) {
        embedUrl = buildCustomEmbedUrl({
          template: tpl,
          tmdbId: validId,
          mediaType: params.mediaType,
          seasonNumber,
          episodeNumber,
          player,
          colorHex,
        });
        referrerPolicy = 'strict-origin';
      }
    }

    if (!embedUrl) {
      embedUrl = buildMegaEmbedUrl({
        tmdbId: validId,
        domain,
        player,
        colorHex,
        mediaType: params.mediaType,
        seasonNumber,
        episodeNumber,
      });
      referrerPolicy = 'no-referrer';
    }

    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      referrerPolicy,
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
