import { isValidStreamUrl, sanitizePlainText } from './catalogUtils.ts';
import type {
  AiMode,
  CatalogSourceMode,
  PlanId,
  PlayerBrandingConfig,
  PublicRuntimeSettings,
  SystemSettings,
  TmdbImageQuality,
  TmdbLanguage,
} from './types.ts';
import { toIsoTimestamp } from './siteConfigUtils.ts';

export const VALID_CATALOG_SOURCES: readonly CatalogSourceMode[] = [
  'auto',
  'tmdb',
  'demo',
  'custom_only',
] as const;

export const VALID_AI_MODES: readonly AiMode[] = [
  'auto',
  'gemini',
  'catalog_smart',
  'disabled',
] as const;

export const VALID_TMDB_LANGUAGES: readonly TmdbLanguage[] = [
  'pt-BR',
  'en-US',
  'es-ES',
] as const;

export const VALID_TMDB_QUALITIES: readonly TmdbImageQuality[] = [
  'w342',
  'w500',
  'w780',
] as const;

const VALID_PLANS: readonly PlanId[] = ['free', 'monthly', 'quarterly', 'annual'] as const;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  catalogSource: 'auto',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  tmdbImageBaseUrl: 'https://image.tmdb.org/t/p/',
  tmdbLanguage: 'pt-BR',
  tmdbImageQuality: 'w500',
  includeAdult: false,
  cacheTtlMinutes: 10,
  aiMode: 'auto',
  aiMaxRecommendations: 12,
  allowRegistration: true,
  requireAuthForPlayer: false,
  allowGuestFavorites: true,
  maxProfilesPerAccount: 5,
  defaultUserPlan: 'free',
  maintenanceMessage:
    'Plataforma em manutenção programada. Alguns recursos podem ficar temporariamente indisponíveis.',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function sanitizeHttpsApiUrl(
  raw: string | null | undefined,
  fallback: string,
  ensureTrailingSlash = false
): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed || !isValidStreamUrl(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallback;
    }
    const clean = trimmed.replace(/\/+$/, '');
    return ensureTrailingSlash ? `${clean}/` : clean;
  } catch {
    return fallback;
  }
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  return Math.max(min, Math.min(max, rounded));
}

export function sanitizeSystemSettings(
  input: Partial<SystemSettings>,
  current: SystemSettings = DEFAULT_SYSTEM_SETTINGS,
  preserveUpdatedAt = false
): SystemSettings {
  const catalogSource: CatalogSourceMode =
    input.catalogSource && VALID_CATALOG_SOURCES.includes(input.catalogSource)
      ? input.catalogSource
      : current.catalogSource;

  const tmdbBaseUrl =
    input.tmdbBaseUrl !== undefined
      ? sanitizeHttpsApiUrl(input.tmdbBaseUrl, current.tmdbBaseUrl, false)
      : current.tmdbBaseUrl;

  const tmdbImageBaseUrl =
    input.tmdbImageBaseUrl !== undefined
      ? sanitizeHttpsApiUrl(input.tmdbImageBaseUrl, current.tmdbImageBaseUrl, true)
      : current.tmdbImageBaseUrl;

  const tmdbLanguage: TmdbLanguage =
    input.tmdbLanguage && VALID_TMDB_LANGUAGES.includes(input.tmdbLanguage)
      ? input.tmdbLanguage
      : current.tmdbLanguage;

  const tmdbImageQuality: TmdbImageQuality =
    input.tmdbImageQuality && VALID_TMDB_QUALITIES.includes(input.tmdbImageQuality)
      ? input.tmdbImageQuality
      : current.tmdbImageQuality;

  const aiMode: AiMode =
    input.aiMode && VALID_AI_MODES.includes(input.aiMode) ? input.aiMode : current.aiMode;

  const defaultUserPlan: PlanId =
    input.defaultUserPlan && VALID_PLANS.includes(input.defaultUserPlan)
      ? input.defaultUserPlan
      : current.defaultUserPlan;

  const maintenanceMessage =
    typeof input.maintenanceMessage === 'string'
      ? sanitizePlainText(input.maintenanceMessage, 240) || current.maintenanceMessage
      : current.maintenanceMessage;

  const preservedIso = preserveUpdatedAt ? toIsoTimestamp(input.updatedAt, '') : '';

  return {
    catalogSource,
    tmdbBaseUrl,
    tmdbImageBaseUrl,
    tmdbLanguage,
    tmdbImageQuality,
    includeAdult:
      typeof input.includeAdult === 'boolean' ? input.includeAdult : current.includeAdult,
    cacheTtlMinutes:
      input.cacheTtlMinutes !== undefined
        ? clampInt(input.cacheTtlMinutes, 1, 1440, current.cacheTtlMinutes)
        : current.cacheTtlMinutes,
    aiMode,
    aiMaxRecommendations:
      input.aiMaxRecommendations !== undefined
        ? clampInt(input.aiMaxRecommendations, 4, 24, current.aiMaxRecommendations)
        : current.aiMaxRecommendations,
    allowRegistration:
      typeof input.allowRegistration === 'boolean'
        ? input.allowRegistration
        : current.allowRegistration,
    requireAuthForPlayer:
      typeof input.requireAuthForPlayer === 'boolean'
        ? input.requireAuthForPlayer
        : current.requireAuthForPlayer,
    allowGuestFavorites:
      typeof input.allowGuestFavorites === 'boolean'
        ? input.allowGuestFavorites
        : current.allowGuestFavorites,
    maxProfilesPerAccount:
      input.maxProfilesPerAccount !== undefined
        ? clampInt(input.maxProfilesPerAccount, 1, 8, current.maxProfilesPerAccount)
        : current.maxProfilesPerAccount,
    defaultUserPlan,
    maintenanceMessage,
    updatedAt: preservedIso || new Date().toISOString(),
  };
}

export function extractPublicRuntimeSettings(
  settings: SystemSettings,
  embedTimeoutSeconds = 12,
  playerBranding?: PlayerBrandingConfig
): PublicRuntimeSettings {
  return {
    allowRegistration: settings.allowRegistration,
    requireAuthForPlayer: settings.requireAuthForPlayer,
    allowGuestFavorites: settings.allowGuestFavorites,
    maxProfilesPerAccount: settings.maxProfilesPerAccount,
    maintenanceMessage: settings.maintenanceMessage,
    aiEnabled: settings.aiMode !== 'disabled',
    embedTimeoutSeconds: clampInt(embedTimeoutSeconds, 5, 30, 12),
    ...(playerBranding ? { playerBranding } : {}),
    updatedAt: settings.updatedAt,
  };
}

export function maskSecretValue(secret: string | null | undefined): string {
  const trimmed = typeof secret === 'string' ? secret.trim() : '';
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function sanitizeSecretToken(raw: unknown, maxLength = 500): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\r\n\t\s]+/g, '').slice(0, maxLength);
}
