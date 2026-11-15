import './env.ts';
import express, { type Express } from 'express';
import { normalizeTmdbId } from '../shared/playerUrl.ts';
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
import { SubscriptionService } from './services/SubscriptionService.ts';
import { SystemSettingsService } from './services/SystemSettingsService.ts';
import { TMDBService } from './services/TMDBService.ts';
import { UserService } from './services/UserService.ts';

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimitMiddleware(240, 60_000));

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

  // --- Integrations Status (Admin Only) ---
  app.get('/api/integrations/status', requireAdmin, async (_req, res, next) => {
    try {
      const status = await AdminService.getIntegrationStatus();
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
      const [movie, tv] = await Promise.all([
        TMDBService.getGenres('movie'),
        TMDBService.getGenres('tv'),
      ]);
      res.json({ movie, tv });
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
      const minRating = req.query.minRating ? Number(req.query.minRating) : null;
      const language = typeof req.query.language === 'string' ? req.query.language : 'all';
      const country = typeof req.query.country === 'string' ? req.query.country : 'all';
      const sortBy =
        req.query.sortBy === 'rating' || req.query.sortBy === 'release_date'
          ? req.query.sortBy
          : 'popularity';
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;

      const data = await TMDBService.discover({
        mediaType,
        genreId: Number.isFinite(genreId) ? genreId : null,
        year: Number.isFinite(year) ? year : null,
        minRating: Number.isFinite(minRating) ? minRating : null,
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
      const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
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
      const data = await TMDBService.search(q, type, page);
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
        seasonNumber: payload.seasonNumber,
        episodeNumber: payload.episodeNumber,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao carregar reprodução.' });
    }
  });

  // --- Channels & Plans ---
  app.get('/api/channels', async (req, res, next) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      res.json({ items: await ChannelService.listPublicAsync(category) });
    } catch (err) {
      next(err);
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
  app.get('/api/admin/dashboard', requireAdmin, async (_req, res, next) => {
    try {
      const [stats, integrations] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getIntegrationStatus(),
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
      res.json({ items: await ChannelService.listAllAdminAsync() });
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
      res.json(await PlayerService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/player-config', requireAdmin, (req, res) => {
    const updated = PlayerService.updateConfig(req.body ?? {});
    res.json(updated);
  });

  app.get('/api/admin/site-config', requireAdmin, async (_req, res, next) => {
    try {
      res.json(await SiteConfigService.getConfigAsync());
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/admin/site-config', requireAdmin, (req, res) => {
    const updated = SiteConfigService.updateConfig(req.body ?? {});
    res.json(updated);
  });

  app.get('/api/admin/system-settings', requireAdmin, async (_req, res, next) => {
    try {
      res.json(await SystemSettingsService.getAdminPayloadAsync());
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
        req.body?.target === 'player' || req.body?.target === 'firestore'
          ? req.body.target
          : 'tmdb';
      const result = await AdminService.runDiagnostic(target);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/catalog/custom', requireAdmin, async (_req, res, next) => {
    try {
      res.json({ items: await SiteConfigService.listCustomCatalogAsync() });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/catalog/custom', requireAdmin, (req, res) => {
    try {
      const saved = SiteConfigService.upsertCustomMedia(req.body ?? {});
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar mídia.' });
    }
  });

  app.delete('/api/admin/catalog/custom/:id', requireAdmin, (req, res) => {
    const removed = SiteConfigService.deleteCustomMedia(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Mídia personalizada não encontrada.' });
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
