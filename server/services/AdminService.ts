import type {
  AdminDashboardStats,
  DiagnosticResult,
  IntegrationStatus,
  SystemLogEntry,
} from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { CatalogService } from './CatalogService.ts';
import { ChannelService } from './ChannelService.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';
import { PlayerService } from './PlayerService.ts';
import { RecommendationService } from './RecommendationService.ts';
import { SiteConfigService } from './SiteConfigService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';
import { TMDBService } from './TMDBService.ts';

class AdminServiceImpl {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    await Promise.all([
      ChannelService.ensureHydrated(),
      SiteConfigService.ensureHydrated(),
      SystemSettingsService.ensureHydrated(),
      PlayerService.ensureHydrated(),
    ]);
    const users = repositoryStore.getUsers();
    const activeUsers = users.filter((u) => !u.blocked).length;
    const synced = await CatalogService.getSyncedCatalog();
    const catalogMovies = synced.filter((m) => m.mediaType === 'movie').length;
    const catalogSeries = synced.filter((m) => m.mediaType === 'tv').length;
    const subs = repositoryStore.getAllSubscriptions();
    const activeSubscriptions = subs.filter((s) => s.status === 'active').length;
    const channelsCount = repositoryStore.getChannels().length;
    const totalPlaybacks = repositoryStore.getTotalPlaybacks();

    return {
      totalUsers: users.length,
      activeUsers,
      catalogMovies,
      catalogSeries,
      totalPlaybacks,
      activeSubscriptions,
      channelsCount,
      usageSeries: [
        { label: 'Seg', playbacks: Math.max(4, Math.round(totalPlaybacks * 0.12)), searches: 14 },
        { label: 'Ter', playbacks: Math.max(6, Math.round(totalPlaybacks * 0.14)), searches: 19 },
        { label: 'Qua', playbacks: Math.max(8, Math.round(totalPlaybacks * 0.16)), searches: 22 },
        { label: 'Qui', playbacks: Math.max(7, Math.round(totalPlaybacks * 0.15)), searches: 18 },
        { label: 'Sex', playbacks: Math.max(11, Math.round(totalPlaybacks * 0.2)), searches: 28 },
        { label: 'Sáb', playbacks: Math.max(14, Math.round(totalPlaybacks * 0.24)), searches: 34 },
        { label: 'Dom', playbacks: Math.max(12, Math.round(totalPlaybacks * 0.21)), searches: 31 },
      ],
    };
  }

  async getIntegrationStatus(): Promise<IntegrationStatus> {
    await Promise.all([SystemSettingsService.ensureHydrated(), PlayerService.ensureHydrated()]);
    const synced = await CatalogService.getSyncedCatalog();
    const sys = SystemSettingsService.getSettings();
    const tmdbToken = SystemSettingsService.getActiveTmdbToken();
    const geminiKey = SystemSettingsService.getActiveGeminiKey();
    const playerCfg = playerConfigStore.getConfig();

    return {
      tmdbConfigured: TMDBService.isConfigured(),
      tmdbRuntimeSource: sys.catalogSource,
      tmdbActiveTokenSource: tmdbToken.source,
      geminiConfigured: RecommendationService.isGeminiConfigured(),
      geminiActiveKeySource: geminiKey.source,
      firebaseConfigured: true,
      megaEmbedConfigured: true,
      playerSourceMode: playerCfg.sourceMode,
      paymentGatewayConfigured: false,
      demoMode: !TMDBService.isConfigured(),
      cacheEntries: CacheService.size(),
      lastSyncAt: repositoryStore.getLastSyncAt(),
      catalogSyncedCount: synced.length,
    };
  }

  async runDiagnostic(target: 'tmdb' | 'player' | 'firestore'): Promise<DiagnosticResult> {
    const started = Date.now();
    if (target === 'tmdb') {
      return TMDBService.testConnection();
    }

    if (target === 'player') {
      await PlayerService.ensureHydrated();
      const movieSample = PlayerService.resolveStream({ tmdbId: 693134, mediaType: 'movie' });
      const tvSample = PlayerService.resolveStream({
        tmdbId: 1399,
        mediaType: 'tv',
        seasonNumber: 1,
        episodeNumber: 2,
      });
      const cfg = playerConfigStore.getConfig();
      return {
        target: 'player',
        ok: Boolean(movieSample.embedUrl && tvSample.embedUrl),
        latencyMs: Date.now() - started,
        message: `Resolução de player validada (${cfg.sourceMode === 'custom_template' ? 'Template Customizado' : `MegaEmbed · ${cfg.defaultDomain}`}).`,
        detail: `Filme exemplo: ${movieSample.embedUrl} | Série exemplo: ${tvSample.embedUrl}`,
        testedAt: new Date().toISOString(),
      };
    }

    // Firestore REST check
    try {
      const ping = await FirestoreRestService.getDocument<Record<string, unknown>>('siteConfig/global');
      return {
        target: 'firestore',
        ok: true,
        latencyMs: Date.now() - started,
        message: ping
          ? 'Conexão REST com Cloud Firestore ativa e documento global encontrado.'
          : 'Conexão REST com Cloud Firestore respondeu (documento ainda não criado na nuvem).',
        testedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        target: 'firestore',
        ok: false,
        latencyMs: Date.now() - started,
        message: `Erro ao consultar Firestore: ${err instanceof Error ? err.message : String(err)}`,
        testedAt: new Date().toISOString(),
      };
    }
  }

  getLogs(limit = 100): SystemLogEntry[] {
    return repositoryStore.getLogs(limit);
  }

  clearCache(): number {
    const cleared = CacheService.clear();
    repositoryStore.addLog({
      level: 'info',
      service: 'AdminService',
      message: `Cache limpo pelo administrador (${cleared} entradas removidas).`,
    });
    return cleared;
  }
}

export const AdminService = new AdminServiceImpl();
