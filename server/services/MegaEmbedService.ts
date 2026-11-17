import {
  buildCustomEmbedUrl,
  buildMegaEmbedUrl,
  buildMyEmbedUrl,
  buildWatchaFlixEmbedUrl,
  detectStreamKind,
  extractPlayerBranding,
  normalizeEpisodeNumber,
  normalizeSeasonNumber,
  normalizeTmdbId,
  resolveSandboxPolicy,
  sanitizeHexColor,
  validateMegaEmbedDomain,
  validateMegaEmbedPlayer,
} from '../../shared/playerUrl.ts';
import type { EmbedPlayResponse, MediaType } from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';

class MegaEmbedServiceImpl {
  getEmbedPayload(params: {
    tmdbId: string | number;
    imdbId?: string | null;
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
    let referrerPolicy: 'no-referrer' | 'strict-origin' = 'strict-origin';

    if (cfg.sourceMode === 'myembed') {
      embedUrl = buildMyEmbedUrl({
        tmdbId: validId,
        imdbId: params.imdbId,
        preferImdbForMovies: cfg.preferImdbForMovies,
        mediaType: params.mediaType,
        seasonNumber,
        episodeNumber,
        baseUrl: cfg.myembedBaseUrl,
      });
      referrerPolicy = 'strict-origin';
    } else if (cfg.sourceMode === 'watchaflix') {
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
          imdbId: params.imdbId,
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
      if (cfg.sourceMode === 'megaembed') {
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
      } else {
        embedUrl = buildMyEmbedUrl({
          tmdbId: validId,
          imdbId: params.imdbId,
          preferImdbForMovies: cfg.preferImdbForMovies,
          mediaType: params.mediaType,
          seasonNumber,
          episodeNumber,
          baseUrl: cfg.myembedBaseUrl,
        });
        referrerPolicy = 'strict-origin';
      }
    }

    const streamKind = detectStreamKind(embedUrl);
    const sandboxPolicy = resolveSandboxPolicy({
      streamKind,
      antiAdSandbox: cfg.antiAdSandbox,
    });

    return {
      tmdbId: validId,
      mediaType: params.mediaType,
      embedUrl,
      domain,
      player,
      colorHex,
      streamKind,
      sandboxPolicy,
      referrerPolicy,
      seasonNumber,
      episodeNumber,
      branding: extractPlayerBranding(cfg),
      ...(params.mediaType === 'tv' && !cfg.seriesSeasonEpisodeDocumented
        ? {
            seriesSupportNote: cfg.seriesLimitationNote,
          }
        : {}),
    };
  }
}

export const MegaEmbedService = new MegaEmbedServiceImpl();
