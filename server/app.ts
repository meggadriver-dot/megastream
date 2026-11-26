import './env.ts';
import os from 'node:os';
import express, { type Express } from 'express';
import { TMDB_BR_WATCH_PROVIDERS } from '../shared/catalogUtils.ts';
import { normalizeTmdbId } from '../shared/playerUrl.ts';
import type { CatalogSortBy, NetworkInfoResponse } from '../shared/types.ts';
import {
  type AuthenticatedRequest,
  globalErrorHandler,
  optionalAuth,
  rateLimitMiddleware,
  requireAdmin,
  requireAuth,
} from './middleware/security.ts';
import { AdminService } from './services/AdminService.ts';
import { AuthenticationService } from './services/AuthenticationService.ts';
import { CatalogService } from './services/CatalogService.ts';
import { ChannelService } from './services/ChannelService.ts';
import { FavoritesService } from './services/FavoritesService.ts';
import { HistoryService } from './services/HistoryService.ts';
import { PlayerService } from './services/PlayerService.ts';
import { ProfileService } from './services/ProfileService.ts';
import { RecommendationService } from './services/RecommendationService.ts';
import { SiteConfigService } from './services/SiteConfigService.ts';
import { StreamBetterService } from './services/StreamBetterService.ts';
import { StreamResolverService } from './services/StreamResolverService.ts';
import { SubscriptionService } from './services/SubscriptionService.ts';
import { SystemSettingsService } from './services/SystemSettingsService.ts';
import { TMDBService } from './services/TMDBService.ts';
import { UserService } from './services/UserService.ts';

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimitMiddleware(240, 60_000));
  app.use('/api', (req, res, next) => {
    const p = req.path || '';
    const isImmutableMediaChunk =
      p.startsWith('/player/hls/') && p.endsWith('/seg') ||
      p.startsWith('/player/video/') ||
      p.startsWith('/player/subtitle/');
    if (!isImmutableMediaChunk) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // --- Healthcheck ---
  app.get('/api/health', async (_req, res) => {
    await SystemSettingsService.ensureHydrated().catch(() => null);
    res.json({
      ok: true,
      service: 'megastream-api',
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node',
      tmdbConfigured: TMDBService.isConfigured(),
      geminiConfigured: RecommendationService.isGeminiConfigured(),
    });
  });

  // --- Public Site Branding & Feature Config (No Server/Source Secrets) ---
  app.get('/api/site-config', async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });

  // --- Public Runtime Policies (No Secrets, No Embed Domains) ---
  app.get('/api/system-config', async (_req, res, next) => {
    try {
      res.json(await SystemSettingsService.getPublicRuntimeSettingsAsync());
    } catch (err) {
      next(err);
    }
  });

  // --- Local Wi-Fi / LAN Origins for Smart TV Mirroring (No Secrets) ---
  app.get('/api/system/network-info', (_req, res) => {
    const port = Number(process.env.PORT) || 3000;
    const ifaces = os.networkInterfaces();
    const lanIps: string[] = [];

    const isPrivateLanIp = (ip: string): boolean =>
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(ip);

    for (const list of Object.values(ifaces)) {
      if (!Array.isArray(list)) continue;
      for (const info of list) {
        if (!info || info.internal || info.family !== 'IPv4' || !info.address) continue;
        if (!isPrivateLanIp(info.address)) continue;
        if (!lanIps.includes(info.address)) {
          lanIps.push(info.address);
        }
      }
    }

    const rankIp = (ip: string): number => {
      if (ip.startsWith('192.168.')) return 0;
      if (ip.startsWith('10.')) return 1;
      if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(ip)) return 2;
      return 3;
    };
    lanIps.sort((a, b) => rankIp(a) - rankIp(b));

    const portSuffix = port === 80 ? '' : `:${port}`;
    const localOrigins = lanIps.map((ip) => `http://${ip}${portSuffix}`);
    const payload: NetworkInfoResponse = {
      port,
      localOrigins,
      preferredLanOrigin: localOrigins[0] ?? null,
    };
    res.json(payload);
  });

  // --- Integrations Status (Admin Only) ---
  app.get('/api/integrations/status', requireAdmin, async (req, res, next) => {
    try {
      const status = await AdminService.getIntegrationStatus(true, req.headers.authorization);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  // --- Home & Catalog ---
  app.get('/api/catalog/home', async (_req, res, next) => {
    try {
      const data = await CatalogService.getHomeSections();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/genres', async (_req, res, next) => {
    try {
      const genres = await TMDBService.getAllGenres();
      res.json({ ...genres, providers: TMDB_BR_WATCH_PROVIDERS });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/discover', async (req, res, next) => {
    try {
      const mediaType =
        req.query.type === 'movie' || req.query.type === 'tv' ? req.query.type : 'all';
      const genreId = req.query.genreId ? Number(req.query.genreId) : null;
      const year = req.query.year ? Number(req.query.year) : null;
      const yearFrom = req.query.yearFrom ? Number(req.query.yearFrom) : null;
      const yearTo = req.query.yearTo ? Number(req.query.yearTo) : null;
      const minRating = req.query.minRating ? Number(req.query.minRating) : null;
      const watchProvider = req.query.provider ? Number(req.query.provider) : null;
      const language = typeof req.query.language === 'string' ? req.query.language : 'all';
      const country = typeof req.query.country === 'string' ? req.query.country : 'all';
      const rawSort = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'popularity';
      const validSorts: readonly CatalogSortBy[] = [
        'popularity',
        'rating',
        'votes',
        'release_date',
        'release_date_asc',
        'title_asc',
      ];
      const sortBy: CatalogSortBy = validSorts.includes(rawSort as CatalogSortBy)
        ? (rawSort as CatalogSortBy)
        : 'popularity';
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const page = req.query.page ? Math.max(1, Math.min(500, Number(req.query.page))) : 1;

      const data = await TMDBService.discover({
        mediaType,
        genreId: Number.isFinite(genreId) ? genreId : null,
        year: Number.isFinite(year) ? year : null,
        yearFrom: Number.isFinite(yearFrom) ? yearFrom : null,
        yearTo: Number.isFinite(yearTo) ? yearTo : null,
        minRating: Number.isFinite(minRating) ? minRating : null,
        watchProvider: Number.isFinite(watchProvider) ? watchProvider : null,
        language,
        country,
        sortBy,
        query,
        page,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/search', async (req, res, next) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const type =
        req.query.type === 'movie' || req.query.type === 'tv' ? req.query.type : 'all';
      const page = req.query.page ? Math.max(1, Math.min(500, Number(req.query.page))) : 1;
      const year = req.query.year ? Number(req.query.year) : null;
      if (!q) {
        return res.json({
          items: [],
          page: 1,
          totalPages: 1,
          totalResults: 0,
          source: 'tmdb',
          demoMode: !TMDBService.isConfigured(),
        });
      }
      const data = await TMDBService.search(q, type, page, Number.isFinite(year) ? year : null);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // --- Movies ---
  app.get('/api/movies', async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const category =
        req.query.category === 'now_playing' ||
        req.query.category === 'top_rated' ||
        req.query.category === 'upcoming'
          ? req.query.category
          : 'popular';
      const data = await TMDBService.getMovieList(category, page);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/movies/popular', async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      res.json(await TMDBService.getMovieList('popular', page));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/movies/:id', async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID TMDB de filme inválido.' });
      const detail = await TMDBService.getDetail(id, 'movie');
      if (!detail) return res.status(404).json({ error: 'Filme não encontrado.' });
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/movies/:id/recommendations', async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID TMDB inválido.' });
      const detail = await TMDBService.getDetail(id, 'movie');
      res.json({ items: detail?.recommendations ?? [] });
    } catch (err) {
      next(err);
    }
  });

  // --- Series ---
  app.get('/api/series', async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      const category =
        req.query.category === 'top_rated' ||
        req.query.category === 'on_the_air' ||
        req.query.category === 'airing_today'
          ? req.query.category
          : 'popular';
      res.json(await TMDBService.getSeriesList(category, page));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/series/popular', async (req, res, next) => {
    try {
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
      res.json(await TMDBService.getSeriesList('popular', page));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/series/:id', async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID TMDB de série inválido.' });
      const detail = await TMDBService.getDetail(id, 'tv');
      if (!detail) return res.status(404).json({ error: 'Série não encontrada.' });
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/series/:id/seasons', async (req, res, next) => {
    try {
      const id = normalizeTmdbId(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID TMDB de série inválido.' });
      const seasonNumber = req.query.season ? Number(req.query.season) : 1;
      const detail = await TMDBService.getSeasonEpisodes(id, Math.max(0, seasonNumber));
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  // --- Player Stream Resolution (Clean Playback Response) ---
  app.get('/api/player/config', requireAdmin, async (_req, res, next) => {
    try {
      res.json(await PlayerService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/player/hls/:token/playlist.m3u8', async (req, res) => {
    await StreamResolverService.handleHlsManifestRequest(req.params.token, req, res);
  });

  app.get('/api/player/video/:token', async (req, res) => {
    await StreamResolverService.handleHlsManifestRequest(req.params.token, req, res);
  });

  app.get('/api/player/hls/:token/seg', async (req, res) => {
    const targetUrl = typeof req.query.u === 'string' ? req.query.u : '';
    const sig = typeof req.query.s === 'string' ? req.query.s : '';
    if (!targetUrl) {
      return res.status(400).json({ error: 'Parâmetro de segmento ausente.' });
    }
    await StreamResolverService.handleHlsSegmentRequest(req.params.token, targetUrl, sig, req, res);
  });

  app.get('/api/player/subtitle/:subId.vtt', async (req, res) => {
    await StreamResolverService.handleSubtitleVttRequest(req.params.subId, res);
  });

  app.get('/api/player/movie/:tmdbId', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: 'Faça login na plataforma para assistir a este título.' });
      }
      const payload = await PlayerService.resolveStreamAsync({
        tmdbId: req.params.tmdbId,
        mediaType: 'movie',
      });
      res.json({
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType,
        embedUrl: payload.embedUrl,
        streamKind: payload.streamKind ?? 'iframe',
        sandboxPolicy: payload.sandboxPolicy ?? 'strict_no_ads',
        referrerPolicy: payload.referrerPolicy,
        branding: payload.branding,
        audioOptions: payload.audioOptions,
        subtitles: payload.subtitles,
        posterUrl: payload.posterUrl,
        streamUnavailableReason: payload.streamUnavailableReason ?? null,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao carregar reprodução.' });
    }
  });

  app.get('/api/player/tv/:tmdbId', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: 'Faça login na plataforma para assistir a esta série.' });
      }
      const seasonNumber =
        typeof req.query.season === 'string' && req.query.season.trim() !== ''
          ? Number(req.query.season)
          : undefined;
      const episodeNumber =
        typeof req.query.episode === 'string' && req.query.episode.trim() !== ''
          ? Number(req.query.episode)
          : undefined;
      const payload = await PlayerService.resolveStreamAsync({
        tmdbId: req.params.tmdbId,
        mediaType: 'tv',
        seasonNumber,
        episodeNumber,
      });
      res.json({
        tmdbId: payload.tmdbId,
        mediaType: payload.mediaType,
        embedUrl: payload.embedUrl,
        streamKind: payload.streamKind ?? 'iframe',
        sandboxPolicy: payload.sandboxPolicy ?? 'strict_no_ads',
        referrerPolicy: payload.referrerPolicy,
        seasonNumber: payload.seasonNumber,
        episodeNumber: payload.episodeNumber,
        branding: payload.branding,
        audioOptions: payload.audioOptions,
        subtitles: payload.subtitles,
        posterUrl: payload.posterUrl,
        streamUnavailableReason: payload.streamUnavailableReason ?? null,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao carregar reprodução.' });
    }
  });

  // --- Channels, Live Hub & Plans ---
  app.get('/api/channels', async (req, res, next) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      res.json({ items: await ChannelService.listPublicAsync(category) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/live/hub', async (_req, res, next) => {
    try {
      const adminChannels = await ChannelService.listPublicAsync();
      const hub = await StreamBetterService.getLiveHub(adminChannels);
      res.json(hub);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/live/resolve', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await SystemSettingsService.ensureHydrated();
      const sys = SystemSettingsService.getSettings();
      if (sys.requireAuthForPlayer && !req.identity) {
        return res.status(401).json({ error: 'Faça login na plataforma para assistir ao vivo.' });
      }

      const id = typeof req.query.id === 'string' ? req.query.id.trim().slice(0, 120) : undefined;
      const rawKind = typeof req.query.kind === 'string' ? req.query.kind.trim() : '';
      const kind =
        rawKind === 'channel' || rawKind === 'game' || rawKind === 'event' ? rawKind : undefined;
      const slug = typeof req.query.slug === 'string' ? req.query.slug.trim().slice(0, 140) : undefined;
      const title =
        typeof req.query.title === 'string' ? req.query.title.trim().slice(0, 160) : undefined;
      const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim().slice(0, 600) : '';

      if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
        return res.status(400).json({ error: 'URL de transmissão ao vivo inválida.' });
      }

      const resolution = await StreamResolverService.resolveLiveStreamBetterPlayback({
        id,
        kind,
        slug,
        rawUrl: rawUrl || undefined,
        title,
      });
      res.json(resolution);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao resolver transmissão ao vivo.',
      });
    }
  });

  app.get('/api/plans', (_req, res) => {
    res.json({ items: SubscriptionService.getPlans() });
  });

  app.post('/api/subscriptions/select', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const planId = req.body?.planId;
      if (planId !== 'monthly' && planId !== 'quarterly' && planId !== 'annual') {
        return res.status(400).json({ error: 'Plano inválido.' });
      }
      const record = SubscriptionService.selectPlanPendingGateway(req.identity!.uid, planId);
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao selecionar plano.' });
    }
  });

  // --- AI Inteligente ---
  app.post('/api/ai/recommend', optionalAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      const preferredMediaType =
        req.body?.mediaType === 'movie' || req.body?.mediaType === 'tv'
          ? req.body.mediaType
          : 'all';
      const uid = req.identity?.uid;
      const favorites = uid ? FavoritesService.list(uid) : [];
      const history = uid ? HistoryService.list(uid) : [];

      const result = await RecommendationService.recommend({
        prompt,
        favorites,
        history,
        preferredMediaType,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // --- Authenticated User Area ---
  app.get('/api/users/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = AuthenticationService.ensureUserRecord(req.identity!);
    const subscription = SubscriptionService.getUserSubscription(user.uid);
    res.json({ user, subscription });
  });

  app.patch('/api/users/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const updated = UserService.updatePreferences(req.identity!.uid, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ user: updated });
  });

  // --- Multi-Profile API ---
  app.get('/api/users/profiles', requireAuth, (req: AuthenticatedRequest, res) => {
    const items = ProfileService.list(req.identity!.uid, req.identity!.name);
    res.json({ items });
  });

  app.post('/api/users/profiles', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const created = await ProfileService.create(req.identity!.uid, req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar perfil.' });
    }
  });

  app.patch('/api/users/profiles/:profileId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await ProfileService.update(
        req.identity!.uid,
        req.params.profileId,
        req.body ?? {}
      );
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar perfil.' });
    }
  });

  app.post(
    '/api/users/profiles/:profileId/verify-pin',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
      const verified = await ProfileService.verifyPin(
        req.identity!.uid,
        req.params.profileId,
        pin
      );
      if (!verified) {
        return res.status(403).json({ verified: false, error: 'Senha do perfil incorreta.' });
      }
      res.json({ verified: true });
    }
  );

  app.delete('/api/users/profiles/:profileId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const currentPin = typeof req.body?.currentPin === 'string' ? req.body.currentPin : undefined;
      const removed = await ProfileService.remove(
        req.identity!.uid,
        req.params.profileId,
        currentPin
      );
      res.json({ removed });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao remover perfil.' });
    }
  });

  app.get('/api/users/favorites', requireAuth, (req: AuthenticatedRequest, res) => {
    const type =
      req.query.type === 'movie' || req.query.type === 'tv' ? req.query.type : 'all';
    res.json({ items: FavoritesService.list(req.identity!.uid, type) });
  });

  app.post('/api/users/favorites', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const item = FavoritesService.add(req.identity!.uid, req.body ?? {});
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar favorito.' });
    }
  });

  app.delete('/api/users/favorites/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const tmdbId = normalizeTmdbId(req.params.id);
    const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
    if (!tmdbId) return res.status(400).json({ error: 'ID TMDB inválido.' });
    const removed = FavoritesService.remove(req.identity!.uid, tmdbId, mediaType);
    res.json({ removed });
  });

  app.get('/api/users/history', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ items: HistoryService.list(req.identity!.uid) });
  });

  app.post('/api/users/history', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const item = HistoryService.record(req.identity!.uid, req.body ?? {});
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao registrar histórico.' });
    }
  });

  app.delete('/api/users/history/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const tmdbId = normalizeTmdbId(req.params.id);
    const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
    if (!tmdbId) return res.status(400).json({ error: 'ID TMDB inválido.' });
    const removed = HistoryService.remove(req.identity!.uid, tmdbId, mediaType);
    res.json({ removed });
  });

  // --- Admin Panel (Backend Role-Verified) ---
  app.get('/api/admin/dashboard', requireAdmin, async (req, res, next) => {
    try {
      const [stats, integrations] = await Promise.all([
        AdminService.getDashboardStats(true, req.headers.authorization),
        AdminService.getIntegrationStatus(true, req.headers.authorization),
      ]);
      res.json({ stats, integrations });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ items: UserService.getAllUsers() });
  });

  app.patch('/api/admin/users/:uid', requireAdmin, (req, res) => {
    const updated = UserService.adminUpdateUser(req.params.uid, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(updated);
  });

  app.get('/api/admin/channels', requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await ChannelService.listAllAdminAsync(true) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/channels', requireAdmin, (req, res) => {
    try {
      const channel = ChannelService.createOrUpdate(req.body ?? {});
      res.status(201).json(channel);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar canal.' });
    }
  });

  app.delete('/api/admin/channels/:id', requireAdmin, (req, res) => {
    const removed = ChannelService.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Canal não encontrado.' });
    res.json({ removed: true });
  });

  app.get('/api/admin/player-config', requireAdmin, async (_req, res, next) => {
    try {
      res.json(await PlayerService.getConfigAsync(true));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/player-config', requireAdmin, (req, res) => {
    const updated = PlayerService.updateConfig(req.body ?? {});
    res.json(updated);
  });

  app.post('/api/admin/player-sources/test', requireAdmin, async (req, res, next) => {
    try {
      const cfg = await PlayerService.getConfigAsync(true);
      const rawSources = Array.isArray(req.body?.customSources)
        ? req.body.customSources
        : cfg.customSources || [];
      const results = await StreamResolverService.testCustomSources(rawSources);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/player-sources/discover', requireAdmin, async (req, res, next) => {
    try {
      const cfg = await PlayerService.getConfigAsync(true);
      const rawSources = Array.isArray(req.body?.customSources)
        ? req.body.customSources
        : cfg.customSources || [];
      const extraUrls = Array.isArray(req.body?.extraUrls)
        ? req.body.extraUrls.filter((u: unknown): u is string => typeof u === 'string')
        : [];
      const m3uUrl = typeof req.body?.m3uUrl === 'string' ? req.body.m3uUrl : undefined;
      const result = await StreamResolverService.discoverAndVerifySources({
        customSources: rawSources,
        extraUrls,
        m3uUrl,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/site-config', requireAdmin, async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync(true));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/site-config', requireAdmin, (req, res) => {
    const updated = SiteConfigService.updateConfig(req.body ?? {});
    res.json(updated);
  });

  app.get('/api/admin/system-settings', requireAdmin, async (req, res, next) => {
    try {
      res.json(await SystemSettingsService.getAdminPayloadAsync(true, req.headers.authorization));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/system-settings', requireAdmin, (req, res) => {
    const updated = SystemSettingsService.updateSettings(req.body ?? {});
    res.json(updated);
  });

  app.post('/api/admin/system-settings/reset', requireAdmin, (_req, res) => {
    const reset = SystemSettingsService.resetSettingsToDefaults();
    res.json(reset);
  });

  app.post('/api/admin/diagnostics/test', requireAdmin, async (req, res, next) => {
    try {
      const target =
        req.body?.target === 'player' ||
        req.body?.target === 'firestore' ||
        req.body?.target === 'streambetter'
          ? req.body.target
          : 'tmdb';
      const result = await AdminService.runDiagnostic(target, req.headers.authorization);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/catalog/custom', requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await SiteConfigService.listCustomCatalogAsync(true) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/catalog/custom', requireAdmin, (req, res) => {
    try {
      const saved = SiteConfigService.upsertCustomMedia(req.body ?? {});
      StreamResolverService.clearCache();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar mídia.' });
    }
  });

  app.delete('/api/admin/catalog/custom/:id', requireAdmin, (req, res) => {
    const removed = SiteConfigService.deleteCustomMedia(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Mídia personalizada não encontrada.' });
    StreamResolverService.clearCache();
    res.json({ removed: true });
  });

  app.post('/api/admin/catalog/sync', requireAdmin, async (_req, res, next) => {
    try {
      const result = await CatalogService.syncCatalog();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/cache/clear', requireAdmin, (_req, res) => {
    StreamResolverService.clearCache();
    const cleared = AdminService.clearCache();
    res.json({ cleared });
  });

  app.get('/api/admin/logs', requireAdmin, (_req, res) => {
    res.json({ items: AdminService.getLogs(120) });
  });

  // --- API 404 & Error Handlers (scoped to /api) ---
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  app.use('/api', globalErrorHandler);

  return app;
}

export const app = createApiApp();
