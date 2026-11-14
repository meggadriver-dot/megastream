import type { AdminDashboardStats, IntegrationStatus, SystemLogEntry } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { CatalogService } from './CatalogService.ts';
import { ChannelService } from './ChannelService.ts';
import { RecommendationService } from './RecommendationService.ts';
import { SiteConfigService } from './SiteConfigService.ts';
import { TMDBService } from './TMDBService.ts';

class AdminServiceImpl {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    await Promise.all([ChannelService.ensureHydrated(), SiteConfigService.ensureHydrated()]);
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
    const synced = await CatalogService.getSyncedCatalog();
    return {
      tmdbConfigured: TMDBService.isConfigured(),
      geminiConfigured: RecommendationService.isGeminiConfigured(),
      firebaseConfigured: true,
      megaEmbedConfigured: true,
      paymentGatewayConfigured: false,
      demoMode: !TMDBService.isConfigured(),
      cacheEntries: CacheService.size(),
      lastSyncAt: repositoryStore.getLastSyncAt(),
      catalogSyncedCount: synced.length,
    };
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
