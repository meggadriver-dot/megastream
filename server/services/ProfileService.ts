import crypto from 'node:crypto';
import {
  createDefaultProfiles,
  getAvatarPresetById,
  hashProfilePin,
  isValidProfileId,
  MAX_PROFILES_PER_ACCOUNT,
  sanitizeAvatarUrl,
  sanitizeProfileName,
  sanitizeProfileTheme,
  toPublicStreamProfile,
  validateProfilePin,
  verifyProfilePin,
} from '../../shared/profileUtils.ts';
import type { StoredStreamProfile, StreamProfile } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

export interface UpsertProfilePayload {
  id?: string;
  name?: string;
  avatarId?: string;
  avatarUrl?: string;
  pin?: string | null;
  currentPin?: string | null;
  removePin?: boolean;
  isKids?: boolean;
  preferredTheme?: string;
  preferredLanguage?: string;
  preferredQuality?: string;
  autoplayNext?: boolean;
}

class ProfileServiceImpl {
  private ensureProfiles(userId: string, ownerName?: string): StoredStreamProfile[] {
    const existing = repositoryStore.getProfiles(userId);
    if (existing.length > 0) return existing;
    const defaults = createDefaultProfiles(userId, ownerName);
    for (const prof of defaults) {
      repositoryStore.upsertProfile(prof);
    }
    return defaults;
  }

  list(userId: string, ownerName?: string): StreamProfile[] {
    return this.ensureProfiles(userId, ownerName).map(toPublicStreamProfile);
  }

  async create(userId: string, payload: UpsertProfilePayload): Promise<StreamProfile> {
    const current = this.ensureProfiles(userId);
    if (current.length >= MAX_PROFILES_PER_ACCOUNT) {
      throw new Error(`Limite máximo de ${MAX_PROFILES_PER_ACCOUNT} perfis por conta atingido.`);
    }

    const requestedId =
      typeof payload.id === 'string' &&
      isValidProfileId(payload.id) &&
      !current.some((p) => p.id === payload.id)
        ? payload.id
        : null;
    const profileId =
      requestedId ?? `prof_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    const preset = getAvatarPresetById(payload.avatarId);
    const avatarId = preset ? preset.id : 'custom';
    const avatarUrl = preset ? preset.fallbackPath : sanitizeAvatarUrl(payload.avatarUrl);

    const rawPin = typeof payload.pin === 'string' ? payload.pin.trim() : '';
    let hasPin = false;
    let pinHash = '';
    if (rawPin.length > 0) {
      if (!validateProfilePin(rawPin)) {
        throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
      }
      hasPin = true;
      pinHash = await hashProfilePin(profileId, rawPin);
    }

    const created: StoredStreamProfile = {
      id: profileId,
      userId,
      name: sanitizeProfileName(payload.name, 'Novo Perfil'),
      avatarId,
      avatarUrl,
      hasPin,
      pinHash,
      isKids: Boolean(payload.isKids),
      preferredTheme: sanitizeProfileTheme(payload.preferredTheme, 'cinematografico'),
      preferredLanguage:
        payload.preferredLanguage === 'en-US' || payload.preferredLanguage === 'es-ES'
          ? payload.preferredLanguage
          : 'pt-BR',
      preferredQuality:
        payload.preferredQuality === 'auto' || payload.preferredQuality === '720p'
          ? payload.preferredQuality
          : '1080p',
      autoplayNext: payload.autoplayNext !== undefined ? Boolean(payload.autoplayNext) : true,
      createdAt: now,
      updatedAt: now,
    };

    repositoryStore.upsertProfile(created);
    return toPublicStreamProfile(created);
  }

  async update(
    userId: string,
    profileId: string,
    payload: UpsertProfilePayload
  ): Promise<StreamProfile> {
    if (!isValidProfileId(profileId)) {
      throw new Error('Identificador de perfil inválido.');
    }
    const current = this.ensureProfiles(userId);
    const existing = current.find((p) => p.id === profileId);
    if (!existing) {
      throw new Error('Perfil não encontrado.');
    }

    if (existing.hasPin && (payload.pin || payload.removePin)) {
      const ok = await verifyProfilePin(profileId, payload.currentPin ?? '', existing.pinHash);
      if (!ok) {
        throw new Error('Senha atual do perfil incorreta.');
      }
    }

    let nextHasPin = existing.hasPin;
    let nextPinHash = existing.pinHash ?? '';
    if (payload.removePin) {
      nextHasPin = false;
      nextPinHash = '';
    } else if (typeof payload.pin === 'string' && payload.pin.trim().length > 0) {
      if (!validateProfilePin(payload.pin)) {
        throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
      }
      nextHasPin = true;
      nextPinHash = await hashProfilePin(profileId, payload.pin);
    }

    const preset = payload.avatarId ? getAvatarPresetById(payload.avatarId) : undefined;
    const nextAvatarId = payload.avatarId
      ? preset
        ? preset.id
        : 'custom'
      : existing.avatarId;
    const nextAvatarUrl =
      payload.avatarId || payload.avatarUrl
        ? preset
          ? preset.fallbackPath
          : sanitizeAvatarUrl(payload.avatarUrl ?? existing.avatarUrl)
        : existing.avatarUrl;

    const updated: StoredStreamProfile = {
      ...existing,
      name:
        payload.name !== undefined
          ? sanitizeProfileName(payload.name, existing.name)
          : existing.name,
      avatarId: nextAvatarId,
      avatarUrl: nextAvatarUrl,
      hasPin: nextHasPin,
      pinHash: nextPinHash,
      isKids: payload.isKids !== undefined ? Boolean(payload.isKids) : existing.isKids,
      preferredTheme:
        payload.preferredTheme !== undefined
          ? sanitizeProfileTheme(payload.preferredTheme, existing.preferredTheme)
          : existing.preferredTheme,
      preferredLanguage:
        payload.preferredLanguage === 'pt-BR' ||
        payload.preferredLanguage === 'en-US' ||
        payload.preferredLanguage === 'es-ES'
          ? payload.preferredLanguage
          : existing.preferredLanguage,
      preferredQuality:
        payload.preferredQuality === 'auto' ||
        payload.preferredQuality === '1080p' ||
        payload.preferredQuality === '720p'
          ? payload.preferredQuality
          : existing.preferredQuality,
      autoplayNext:
        payload.autoplayNext !== undefined
          ? Boolean(payload.autoplayNext)
          : existing.autoplayNext,
      updatedAt: new Date().toISOString(),
    };

    repositoryStore.upsertProfile(updated);
    return toPublicStreamProfile(updated);
  }

  async verifyPin(userId: string, profileId: string, pin: string): Promise<boolean> {
    if (!isValidProfileId(profileId)) return false;
    const list = this.ensureProfiles(userId);
    const target = list.find((p) => p.id === profileId);
    if (!target) return false;
    if (!target.hasPin) return true;
    return verifyProfilePin(profileId, pin, target.pinHash);
  }

  async remove(userId: string, profileId: string, currentPin?: string): Promise<boolean> {
    if (!isValidProfileId(profileId)) {
      throw new Error('Identificador de perfil inválido.');
    }
    const list = this.ensureProfiles(userId);
    if (list.length <= 1) {
      throw new Error('É necessário manter pelo menos um perfil ativo.');
    }
    const target = list.find((p) => p.id === profileId);
    if (!target) return false;
    if (target.hasPin) {
      const ok = await verifyProfilePin(profileId, currentPin ?? '', target.pinHash);
      if (!ok) {
        throw new Error('Informe a senha atual do perfil para removê-lo.');
      }
    }
    return repositoryStore.deleteProfile(userId, profileId);
  }
}

export const ProfileService = new ProfileServiceImpl();
