import { extractPlayerBranding } from '../../shared/playerUrl.ts';
import { toIsoTimestamp } from '../../shared/siteConfigUtils.ts';
import {
  DEFAULT_SYSTEM_SETTINGS,
  extractPublicRuntimeSettings,
  maskSecretValue,
  sanitizeSecretToken,
  sanitizeSystemSettings,
} from '../../shared/systemSettingsUtils.ts';
import type {
  AdminSecretsStatus,
  AdminSystemSettingsResponse,
  PublicRuntimeSettings,
  SystemSettings,
} from '../../shared/types.ts';
import { playerConfigStore } from '../config/playerConfig.ts';
import { repositoryStore, type StoredAdminSecrets } from '../repositories/interfaces.ts';
import { CacheService } from './CacheService.ts';
import { FirestoreRestService } from './FirestoreRestService.ts';
import { PlayerService } from './PlayerService.ts';

export interface UpdateSystemSettingsPayload extends Partial<SystemSettings> {
  tmdbAccessToken?: string;
  clearTmdbAccessToken?: boolean;
  geminiApiKey?: string;
  clearGeminiApiKey?: boolean;
}

class SystemSettingsServiceImpl {
  private lastHydratedAt = 0;
  private readonly hydrationTtlMs = 20_000;

  async ensureHydrated(force = false): Promise<void> {
    if (!force && Date.now() - this.lastHydratedAt < this.hydrationTtlMs) {
      return;
    }

    const remote = await FirestoreRestService.getDocument<Partial<SystemSettings>>(
      'systemSettings/global'
    );

    if (remote) {
      const local = repositoryStore.getSystemSettings();
      const localTs = Date.parse(local.updatedAt || DEFAULT_SYSTEM_SETTINGS.updatedAt) || 0;
      const remoteIso = toIsoTimestamp(remote.updatedAt, '');
      const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
      const isLocalDefault = local.updatedAt === DEFAULT_SYSTEM_SETTINGS.updatedAt;

      if (isLocalDefault || remoteTs >= localTs) {
        const merged = sanitizeSystemSettings(remote, local, true);
        repositoryStore.saveSystemSettings(merged);
      }
    }

    this.lastHydratedAt = Date.now();
  }

  getSettings(): SystemSettings {
    return repositoryStore.getSystemSettings();
  }

  async getSettingsAsync(): Promise<SystemSettings> {
    await this.ensureHydrated();
    return repositoryStore.getSystemSettings();
  }

  async getPublicRuntimeSettingsAsync(): Promise<PublicRuntimeSettings> {
    await Promise.all([this.ensureHydrated(), PlayerService.ensureHydrated()]);
    const sys = repositoryStore.getSystemSettings();
    const playerCfg = playerConfigStore.getConfig();
    return extractPublicRuntimeSettings(
      sys,
      playerCfg.embedTimeoutSeconds,
      extractPlayerBranding(playerCfg)
    );
  }

  getSecrets(): StoredAdminSecrets {
    return repositoryStore.getAdminSecrets();
  }

  getSecretsStatus(): AdminSecretsStatus {
    const secrets = repositoryStore.getAdminSecrets();
    const envTmdb = process.env.TMDB_ACCESS_TOKEN?.trim() ?? '';
    const envGemini = process.env.GEMINI_API_KEY?.trim() ?? '';
    const hasEnvTmdbToken = Boolean(envTmdb && envTmdb !== 'MY_TMDB_ACCESS_TOKEN');
    const hasEnvGeminiKey = Boolean(envGemini && envGemini !== 'MY_GEMINI_API_KEY');

    const customTmdb = secrets.tmdbAccessToken?.trim() ?? '';
    const customGemini = secrets.geminiApiKey?.trim() ?? '';

    return {
      hasCustomTmdbToken: Boolean(customTmdb),
      tmdbTokenMask: maskSecretValue(customTmdb),
      hasEnvTmdbToken,
      hasCustomGeminiKey: Boolean(customGemini),
      geminiKeyMask: maskSecretValue(customGemini),
      hasEnvGeminiKey,
    };
  }

  async getAdminPayloadAsync(): Promise<AdminSystemSettingsResponse> {
    await this.ensureHydrated();
    return {
      settings: repositoryStore.getSystemSettings(),
      secretsStatus: this.getSecretsStatus(),
    };
  }

  updateSettings(payload: UpdateSystemSettingsPayload): AdminSystemSettingsResponse {
    const current = repositoryStore.getSystemSettings();
    const next = sanitizeSystemSettings(payload, current, false);
    repositoryStore.saveSystemSettings(next);

    const currentSecrets = repositoryStore.getAdminSecrets();
    let secretsChanged = false;
    const nextSecrets: StoredAdminSecrets = { ...currentSecrets };

    if (payload.clearTmdbAccessToken) {
      delete nextSecrets.tmdbAccessToken;
      secretsChanged = true;
    } else if (typeof payload.tmdbAccessToken === 'string') {
      const cleanToken = sanitizeSecretToken(payload.tmdbAccessToken, 500);
      if (cleanToken) {
        nextSecrets.tmdbAccessToken = cleanToken;
        secretsChanged = true;
      }
    }

    if (payload.clearGeminiApiKey) {
      delete nextSecrets.geminiApiKey;
      secretsChanged = true;
    } else if (typeof payload.geminiApiKey === 'string') {
      const cleanKey = sanitizeSecretToken(payload.geminiApiKey, 500);
      if (cleanKey) {
        nextSecrets.geminiApiKey = cleanKey;
        secretsChanged = true;
      }
    }

    if (secretsChanged) {
      nextSecrets.updatedAt = new Date().toISOString();
      repositoryStore.saveAdminSecrets(nextSecrets);
    }

    this.lastHydratedAt = Date.now();
    // Changing catalog API source, language, image quality, or TMDB base URL invalidates catalog caches
    CacheService.clear('catalog:');
    CacheService.clear('tmdb:');

    repositoryStore.addLog({
      level: 'info',
      service: 'SystemSettingsService',
      message: `Fontes de API e políticas atualizadas: catálogo=${next.catalogSource}, idioma=${next.tmdbLanguage}, IA=${next.aiMode}.`,
    });

    return {
      settings: next,
      secretsStatus: this.getSecretsStatus(),
    };
  }

  resetSettingsToDefaults(): AdminSystemSettingsResponse {
    const defaults: SystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
    repositoryStore.saveSystemSettings(defaults);
    this.lastHydratedAt = Date.now();
    CacheService.clear('catalog:');
    CacheService.clear('tmdb:');
    repositoryStore.addLog({
      level: 'warn',
      service: 'SystemSettingsService',
      message: 'Configurações de APIs e políticas restauradas para o padrão de fábrica.',
    });
    return {
      settings: defaults,
      secretsStatus: this.getSecretsStatus(),
    };
  }

  getActiveTmdbToken(): { token: string | null; source: 'env' | 'admin_override' | 'none' } {
    const custom = repositoryStore.getAdminSecrets().tmdbAccessToken?.trim();
    if (custom) {
      return { token: custom, source: 'admin_override' };
    }
    const envToken = process.env.TMDB_ACCESS_TOKEN?.trim();
    if (envToken && envToken !== 'MY_TMDB_ACCESS_TOKEN') {
      return { token: envToken, source: 'env' };
    }
    return { token: null, source: 'none' };
  }

  getActiveGeminiKey(): { key: string | null; source: 'env' | 'admin_override' | 'none' } {
    const custom = repositoryStore.getAdminSecrets().geminiApiKey?.trim();
    if (custom) {
      return { key: custom, source: 'admin_override' };
    }
    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey !== 'MY_GEMINI_API_KEY') {
      return { key: envKey, source: 'env' };
    }
    return { key: null, source: 'none' };
  }
}

export const SystemSettingsService = new SystemSettingsServiceImpl();
