import { sanitizePlainText } from './catalogUtils.ts';
import type {
  AvatarPresetMeta,
  StoredStreamProfile,
  StreamProfile,
  ThemeId,
} from './types.ts';

export const MAX_PROFILES_PER_ACCOUNT = 6;

export const VALID_PROFILE_THEMES: readonly ThemeId[] = [
  'cinematografico',
  'neon-roxo',
  'minimalista',
  'gold-premium',
  '3d-glass',
] as const;

export const PROFILE_AVATAR_PRESETS: readonly AvatarPresetMeta[] = [
  {
    id: 'avatar_cartoon_hero',
    label: 'Herói Animado',
    category: 'desenhos',
    fallbackPath: '/src/assets/images/avatar_cartoon_hero_1794675751477.jpg',
  },
  {
    id: 'avatar_anime_pilot',
    label: 'Piloto Cyber Anime',
    category: 'desenhos',
    fallbackPath: '/src/assets/images/avatar_anime_pilot_1794675752025.jpg',
  },
  {
    id: 'avatar_series_detective',
    label: 'Detetive Noir',
    category: 'series',
    fallbackPath: '/src/assets/images/avatar_series_detective_1794675751043.jpg',
  },
  {
    id: 'avatar_series_queen',
    label: 'Rainha Fantasia',
    category: 'series',
    fallbackPath: '/src/assets/images/avatar_series_queen_1794675751674.jpg',
  },
  {
    id: 'avatar_movie_explorer',
    label: 'Explorador Duna',
    category: 'filmes',
    fallbackPath: '/src/assets/images/avatar_movie_explorer_1794675752185.jpg',
  },
  {
    id: 'avatar_movie_vigilante',
    label: 'Vigilante Noturno',
    category: 'filmes',
    fallbackPath: '/src/assets/images/avatar_movie_vigilante_1794675753040.jpg',
  },
  {
    id: 'avatar_kids_dino',
    label: 'Dino Pipoca Kids',
    category: 'infantil',
    fallbackPath: '/src/assets/images/avatar_kids_dino_1794675753063.jpg',
  },
  {
    id: 'avatar_movie_astronaut',
    label: 'Astronauta Neon',
    category: 'filmes',
    fallbackPath: '/src/assets/images/avatar_movie_astronaut_1794675753848.jpg',
  },
] as const;

export function getAvatarPresetById(id?: string | null): AvatarPresetMeta | undefined {
  if (!id) return undefined;
  return PROFILE_AVATAR_PRESETS.find((preset) => preset.id === id);
}

export function sanitizeProfileName(input?: string | null, fallback = 'Perfil'): string {
  const cleaned = sanitizePlainText(input ?? '', 40);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function isValidProfileId(id?: string | null): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export function sanitizeProfileTheme(theme?: string | null, fallback: ThemeId = 'cinematografico'): ThemeId {
  if (theme && (VALID_PROFILE_THEMES as readonly string[]).includes(theme)) {
    return theme as ThemeId;
  }
  return fallback;
}

export function sanitizeAvatarUrl(url?: string | null): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) {
    return PROFILE_AVATAR_PRESETS[7].fallbackPath;
  }
  if (trimmed.startsWith('/src/assets/images/') || trimmed.startsWith('/assets/')) {
    return trimmed.slice(0, 300);
  }
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 45000 ? trimmed : PROFILE_AVATAR_PRESETS[7].fallbackPath;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    // Invalid URL
  }
  return PROFILE_AVATAR_PRESETS[7].fallbackPath;
}

export function validateProfilePin(pin?: string | null): boolean {
  if (typeof pin !== 'string') return false;
  const trimmed = pin.trim();
  return trimmed.length >= 4 && trimmed.length <= 12 && !/\s/.test(trimmed);
}

export async function hashProfilePin(profileId: string, pin: string): Promise<string> {
  const normalized = pin.trim();
  if (!validateProfilePin(normalized)) {
    throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`megastream:profile:v1:${profileId}:${normalized}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyProfilePin(
  profileId: string,
  pin: string,
  expectedHash?: string | null
): Promise<boolean> {
  if (!expectedHash || !validateProfilePin(pin)) {
    return false;
  }
  const computed = await hashProfilePin(profileId, pin);
  return computed === expectedHash;
}

export function toPublicStreamProfile(profile: StoredStreamProfile): StreamProfile {
  const { pinHash: _ignored, ...publicProfile } = profile;
  return publicProfile;
}

export function createDefaultProfiles(userId: string, ownerName?: string): StoredStreamProfile[] {
  const now = new Date().toISOString();
  const mainName = sanitizeProfileName(ownerName || 'Principal', 'Principal');
  return [
    {
      id: 'profile_main',
      userId,
      name: mainName,
      avatarId: 'avatar_movie_astronaut',
      avatarUrl: PROFILE_AVATAR_PRESETS[7].fallbackPath,
      hasPin: false,
      pinHash: '',
      isKids: false,
      preferredTheme: 'cinematografico',
      preferredLanguage: 'pt-BR',
      preferredQuality: '1080p',
      autoplayNext: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function shouldShowProfileGate(params: {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  profileSelectedForSession: boolean;
}): boolean {
  if (params.isAuthLoading) return false;
  if (!params.isAuthenticated) return false;
  return !params.profileSelectedForSession;
}

