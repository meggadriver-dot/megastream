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
  streamBetterApiKey?: string;
  clearStreamBetterApiKey?: boolean;
}

class SystemSettingsServiceImpl {
  private lastHydratedAt = 0;
  private lastSecretsHydratedAt = 0;
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
      const remote = await FirestoreRestService.getDocument<Partial<SystemSettings>>(
        'systemSettings/global'
      );

      if (remote) {
        const local = repositoryStore.getSystemSettings();
        const localTs = Date.parse(local.updatedAt || DEFAULT_SYSTEM_SETTINGS.updatedAt) || 0;
        const remoteIso = toIsoTimestamp(remote.updatedAt, '');
        const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
        const isLocalDefault = local.updatedAt === DEFAULT_SYSTEM_SETTINGS.updatedAt;
        const changedRemote = remoteIso && remoteIso !== local.updatedAt;

        if (isLocalDefault || localTs === 0 || (changedRemote && remoteTs >= localTs)) {
          const merged = sanitizeSystemSettings(remote, local, true);
          repositoryStore.saveSystemSettings(merged);
          CacheService.clear('catalog:');
          CacheService.clear('tmdb:');
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

  async ensureSecretsHydrated(bearerToken?: string, force = false): Promise<void> {
    if (!bearerToken) return;
    if (!force && Date.now() - this.lastSecretsHydratedAt < 10_000) return;

    const remoteSecrets = await FirestoreRestService.getDocument<StoredAdminSecrets>(
      'adminSecrets/apiKeys',
      bearerToken
    );
    if (remoteSecrets) {
      const localSecrets = repositoryStore.getAdminSecrets();
      const localTs = Date.parse(localSecrets.updatedAt || '') || 0;
      const remoteIso = toIsoTimestamp(remoteSecrets.updatedAt, '');
      const remoteTs = remoteIso ? Date.parse(remoteIso) : 0;
      if (localTs === 0 || remoteTs >= localTs) {
        const next: StoredAdminSecrets = {};
        if (typeof remoteSecrets.tmdbAccessToken === 'string' && remoteSecrets.tmdbAccessToken.trim()) {
          next.tmdbAccessToken = remoteSecrets.tmdbAccessToken.trim();
        }
        if (typeof remoteSecrets.geminiApiKey === 'string' && remoteSecrets.geminiApiKey.trim()) {
          next.geminiApiKey = remoteSecrets.geminiApiKey.trim();
        }
        if (
          typeof remoteSecrets.streamBetterApiKey === 'string' &&
          remoteSecrets.streamBetterApiKey.trim()
        ) {
          next.streamBetterApiKey = remoteSecrets.streamBetterApiKey.trim();
        }
        if (remoteIso) next.updatedAt = remoteIso;
        repositoryStore.saveAdminSecrets(next);
        CacheService.clear('catalog:');
        CacheService.clear('tmdb:');
        CacheService.clear('streambetter:');
      }
    }
    this.lastSecretsHydratedAt = Date.now();
  }

  getSettings(): SystemSettings {
    return repositoryStore.getSystemSettings();
  }

  async getSettingsAsync(force = false): Promise<SystemSettings> {
    await this.ensureHydrated(force);
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
    const envStreamBetter =
      (process.env.STREAMBETTER_SECRET_KEY || process.env.STREAMBETTER_API_KEY)?.trim() ?? '';
    const hasEnvTmdbToken = Boolean(envTmdb && envTmdb !== 'MY_TMDB_ACCESS_TOKEN');
    const hasEnvGeminiKey = Boolean(envGemini && envGemini !== 'MY_GEMINI_API_KEY');
    const hasEnvStreamBetterKey = Boolean(envStreamBetter);

    const customTmdb = secrets.tmdbAccessToken?.trim() ?? '';
    const customGemini = secrets.geminiApiKey?.trim() ?? '';
    const customStreamBetter = secrets.streamBetterApiKey?.trim() ?? '';

    return {
      hasCustomTmdbToken: Boolean(customTmdb),
      tmdbTokenMask: maskSecretValue(customTmdb),
      hasEnvTmdbToken,
      hasCustomGeminiKey: Boolean(customGemini),
      geminiKeyMask: maskSecretValue(customGemini),
      hasEnvGeminiKey,
      hasCustomStreamBetterKey: Boolean(customStreamBetter),
      streamBetterKeyMask: maskSecretValue(customStreamBetter),
      hasEnvStreamBetterKey,
    };
  }

  async getAdminPayloadAsync(force = false, bearerToken?: string): Promise<AdminSystemSettingsResponse> {
    await Promise.all([
      this.ensureHydrated(force),
      this.ensureSecretsHydrated(bearerToken, force),
    ]);
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

    if (payload.clearStreamBetterApiKey) {
      delete nextSecrets.streamBetterApiKey;
      secretsChanged = true;
    } else if (typeof payload.streamBetterApiKey === 'string') {
      const cleanKey = sanitizeSecretToken(payload.streamBetterApiKey, 500);
      if (cleanKey) {
        nextSecrets.streamBetterApiKey = cleanKey;
        secretsChanged = true;
      }
    }

    if (secretsChanged) {
      nextSecrets.updatedAt = new Date().toISOString();
      repositoryStore.saveAdminSecrets(nextSecrets);
      CacheService.clear('streambetter:');
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

  getActiveStreamBetterKey(): { key: string | null; source: 'env' | 'admin_override' | 'none' } {
    const custom = repositoryStore.getAdminSecrets().streamBetterApiKey?.trim();
    if (custom) {
      return { key: custom, source: 'admin_override' };
    }
    const envKey = (
      process.env.STREAMBETTER_SECRET_KEY || process.env.STREAMBETTER_API_KEY
    )?.trim();
    if (envKey) {
      return { key: envKey, source: 'env' };
    }
    return { key: null, source: 'none' };
  }
}

export const SystemSettingsService = new SystemSettingsServiceImpl();
