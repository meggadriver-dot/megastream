import { sanitizeCustomMediaInput, sanitizeSiteConfig } from '../../shared/siteConfigUtils.ts';
import type { CustomMediaItem, MediaType, SiteConfig } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';

class SiteConfigServiceImpl {
  getConfig(): SiteConfig {
    return repositoryStore.getSiteConfig();
  }

  updateConfig(input: Partial<SiteConfig>): SiteConfig {
    const current = repositoryStore.getSiteConfig();
    const next = sanitizeSiteConfig(input, current);
    repositoryStore.saveSiteConfig(next);
    repositoryStore.addLog({
      level: 'info',
      service: 'SiteConfigService',
      message: `Configurações do site atualizadas pelo administrador (${next.siteName}).`,
    });
    return next;
  }

  listCustomCatalog(): CustomMediaItem[] {
    return repositoryStore.getCustomCatalog();
  }

  getCustomMatch(tmdbId: number, mediaType: MediaType): CustomMediaItem | null {
    return (
      repositoryStore
        .getCustomCatalog()
        .find((c) => c.active && c.tmdbId === tmdbId && c.mediaType === mediaType) ?? null
    );
  }

  upsertCustomMedia(
    input: Partial<CustomMediaItem> & { title?: string; mediaType?: string }
  ): CustomMediaItem {
    const existing = input.id
      ? repositoryStore.getCustomCatalog().find((c) => c.id === input.id)
      : undefined;
    const sanitized = sanitizeCustomMediaInput(input, existing);
    const saved = repositoryStore.upsertCustomMedia(sanitized);
    CacheService.clear('catalog:');
    repositoryStore.addLog({
      level: 'info',
      service: 'CatalogAdminService',
      message: `Mídia personalizada salva: ${saved.title} (${saved.mediaType} #${saved.tmdbId}).`,
    });
    return saved;
  }

  deleteCustomMedia(id: string): boolean {
    const ok = repositoryStore.deleteCustomMedia(id);
    if (ok) {
      CacheService.clear('catalog:');
      repositoryStore.addLog({
        level: 'warn',
        service: 'CatalogAdminService',
        message: `Mídia personalizada removida: ${id}.`,
      });
    }
    return ok;
  }
}

export const SiteConfigService = new SiteConfigServiceImpl();
