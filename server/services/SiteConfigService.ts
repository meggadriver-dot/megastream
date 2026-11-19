import {
  DEFAULT_SITE_CONFIG,
  sanitizeCustomMediaInput,
  sanitizeSiteConfig,
  toIsoTimestamp,
} from '../../shared/siteConfigUtils.ts';
import type { CustomMediaItem, MediaType, SiteConfig } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';

class SiteConfigServiceImpl {
  private lastHydratedAt = 0;
  private readonly hydrationTtlMs = 2_500;
  private hydrationPromise: Promise<void> | null = null;

  async ensureHydrated(force = false): Promise<void> {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }
    if (!force && this.hydrationPromise) {
      return this.hydrationPromise;
    }

    const run = (async () => {
      const [remoteSite, remoteCustomRes] = await Promise.all([
        FirestoreRestService.getDocument<Partial<SiteConfig>>('siteConfig/global'),
        FirestoreRestService.queryActiveCollectionChecked<
          Partial<CustomMediaItem> & { title?: string; mediaType?: string }
        >('customCatalog'),
      ]);

      if (remoteSite) {
        const local = repositoryStore.getSiteConfig();
        const localTs = Date.parse(local.updatedAt || DEFAULT_SITE_CONFIG.updatedAt) || 0;
        const remoteIso = toIsoTimestamp(remoteSite.updatedAt, '');
        const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
        const isLocalDefault = local.updatedAt === DEFAULT_SITE_CONFIG.updatedAt;
        const changedRemote = remoteIso && remoteIso !== local.updatedAt;

        if (isLocalDefault || localTs === 0 || (changedRemote && remoteTs >= localTs)) {
          const merged = sanitizeSiteConfig(remoteSite, local, true);
          repositoryStore.saveSiteConfig(merged);
        }
      }

      if (remoteCustomRes.ok) {
        let changed = false;
        const localList = repositoryStore.getCustomCatalog();
        const remoteIds = new Set<string>();

        for (const raw of remoteCustomRes.items) {
          try {
            if (!raw.title) continue;
            const existing = raw.id ? localList.find((c) => c.id === raw.id) : undefined;
            const sanitized = sanitizeCustomMediaInput(raw, existing);
            const remoteItemIso = toIsoTimestamp(raw.updatedAt, '');
            if (remoteItemIso) {
              sanitized.updatedAt = remoteItemIso;
            }
            remoteIds.add(sanitized.id);
            if (!existing || existing.updatedAt !== sanitized.updatedAt) {
              repositoryStore.upsertCustomMedia(sanitized);
              changed = true;
            }
          } catch {
            // Skip malformed remote item gracefully
          }
        }

        // Remove items deactivated/deleted on Firestore from this lambda's local cache
        for (const localItem of localList) {
          if (!remoteIds.has(localItem.id)) {
            if (repositoryStore.deleteCustomMedia(localItem.id)) {
              changed = true;
            }
          }
        }

        if (changed) {
          CacheService.clear('catalog:');
        }
      }

      this.lastHydratedAt = Date.now();
    })().finally(() => {
      if (this.hydrationPromise === run) {
        this.hydrationPromise = null;
      }
    });

    this.hydrationPromise = run;
    return run;
  }

  getConfig(): SiteConfig {
    return repositoryStore.getSiteConfig();
  }

  async getConfigAsync(force = false): Promise<SiteConfig> {
    await this.ensureHydrated(force);
    return repositoryStore.getSiteConfig();
  }

  updateConfig(input: Partial<SiteConfig>): SiteConfig {
    const current = repositoryStore.getSiteConfig();
    const next = sanitizeSiteConfig(input, current, false);
    repositoryStore.saveSiteConfig(next);
    this.lastHydratedAt = Date.now();
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

  async listCustomCatalogAsync(force = false): Promise<CustomMediaItem[]> {
    await this.ensureHydrated(force);
    return repositoryStore.getCustomCatalog();
  }

  getCustomMatch(tmdbId: number, mediaType: MediaType): CustomMediaItem | null {
    return (
      repositoryStore
        .getCustomCatalog()
        .find((c) => c.active && c.tmdbId === tmdbId && c.mediaType === mediaType) ?? null
    );
  }

  async getCustomMatchAsync(tmdbId: number, mediaType: MediaType): Promise<CustomMediaItem | null> {
    await this.ensureHydrated();
    return this.getCustomMatch(tmdbId, mediaType);
  }

  upsertCustomMedia(
    input: Partial<CustomMediaItem> & { title?: string; mediaType?: string }
  ): CustomMediaItem {
    const existing = input.id
      ? repositoryStore.getCustomCatalog().find((c) => c.id === input.id)
      : undefined;
    const sanitized = sanitizeCustomMediaInput(input, existing);
    const saved = repositoryStore.upsertCustomMedia(sanitized);
    this.lastHydratedAt = Date.now();
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
    this.lastHydratedAt = Date.now();
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
