import './server/env';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { normalizeTmdbId } from './shared/playerUrl';
import {
  type AuthenticatedRequest,
  globalErrorHandler,
  optionalAuth,
  rateLimitMiddleware,
  requireAdmin,
  requireAuth,
} from './server/middleware/security';
import { AdminService } from './server/services/AdminService';
import { AuthenticationService } from './server/services/AuthenticationService';
import { CatalogService } from './server/services/CatalogService';
import { ChannelService } from './server/services/ChannelService';
import { FavoritesService } from './server/services/FavoritesService';
import { HistoryService } from './server/services/HistoryService';
import { PlayerService } from './server/services/PlayerService';
import { RecommendationService } from './server/services/RecommendationService';
import { SubscriptionService } from './server/services/SubscriptionService';
import { TMDBService } from './server/services/TMDBService';
import { UserService } from './server/services/UserService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimitMiddleware(240, 60_000));

  // --- Integrations Status ---
  app.get('/api/integrations/status', async (_req, res, next) => {
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
        return res.json({ items: [], page: 1, totalPages: 1, totalResults: 0, source: 'tmdb', demoMode: !TMDBService.isConfigured() });
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

  // --- MegaEmbed Player API ---
  app.get('/api/player/config', (_req, res) => {
    res.json(PlayerService.getConfig());
  });

  app.get('/api/player/movie/:tmdbId', (req, res) => {
    try {
      const payload = PlayerService.resolveStream({
        tmdbId: req.params.tmdbId,
        mediaType: 'movie',
        domain: typeof req.query.domain === 'string' ? req.query.domain : undefined,
        player: typeof req.query.player === 'string' ? req.query.player : undefined,
        colorHex: typeof req.query.color === 'string' ? req.query.color : undefined,
      });
      res.json(payload);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro no player.' });
    }
  });

  app.get('/api/player/tv/:tmdbId', (req, res) => {
    try {
      const seasonNumber = req.query.season ? Number(req.query.season) : undefined;
      const episodeNumber = req.query.episode ? Number(req.query.episode) : undefined;
      const payload = PlayerService.resolveStream({
        tmdbId: req.params.tmdbId,
        mediaType: 'tv',
        domain: typeof req.query.domain === 'string' ? req.query.domain : undefined,
        player: typeof req.query.player === 'string' ? req.query.player : undefined,
        colorHex: typeof req.query.color === 'string' ? req.query.color : undefined,
        seasonNumber,
        episodeNumber,
      });
      res.json(payload);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro no player.' });
    }
  });

  // --- Channels & Plans ---
  app.get('/api/channels', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    res.json({ items: ChannelService.listPublic(category) });
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

  app.get('/api/admin/channels', requireAdmin, (_req, res) => {
    res.json({ items: ChannelService.listAllAdmin() });
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

  app.put('/api/admin/player-config', requireAdmin, (req, res) => {
    const updated = PlayerService.updateConfig(req.body ?? {});
    res.json(updated);
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

  app.use(globalErrorHandler);

  // --- Frontend Serving (Vite Dev Middleware vs Production Static) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MegaStream server listening on http://0.0.0.0:${PORT}`);
    if (TMDBService.isConfigured()) {
      CatalogService.syncCatalog().catch((err) => {
        console.warn('Initial TMDB catalog sync warning:', err instanceof Error ? err.message : err);
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start MegaStream server:', err);
  process.exit(1);
});
