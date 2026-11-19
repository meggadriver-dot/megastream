import fs from 'node:fs';
import path from 'node:path';
import { FirestoreRestService } from './FirestoreRestService.ts';
import type { UserProfile } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';

const ADMIN_EMAILS = new Set(['meggadriver@gmail.com']);

interface VerifiedIdentity {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

function getFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { projectId?: string };
      if (cfg.projectId) return cfg.projectId;
    }
  } catch {
    // ignore
  }
  return 'gen-lang-client-0094430568';
}

class AuthenticationServiceImpl {
  private projectId = getFirebaseProjectId();
  private readonly remoteAdminCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

  private async checkFirestoreAdmin(uid: string, bearerToken: string): Promise<boolean> {
    const cached = this.remoteAdminCache.get(uid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isAdmin;
    }
    try {
      const [adminDoc, userDoc] = await Promise.all([
        FirestoreRestService.getDocument<Record<string, unknown>>(`admins/${uid}`, bearerToken),
        FirestoreRestService.getDocument<{ role?: string }>(`users/${uid}`, bearerToken),
      ]);
      const isAdmin = Boolean(adminDoc) || userDoc?.role === 'admin';
      this.remoteAdminCache.set(uid, {
        isAdmin,
        expiresAt: Date.now() + 60_000,
      });
      return isAdmin;
    } catch {
      return false;
    }
  }

  async verifyBearerToken(authHeader?: string): Promise<VerifiedIdentity | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        user_id?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
        aud?: string;
        iss?: string;
        exp?: number;
      };

      const uid = payload.user_id || payload.sub;
      if (!uid || !payload.email) return null;

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }

      if (payload.aud && payload.aud !== this.projectId) {
        return null;
      }

      const existingUser = repositoryStore.getUser(uid);
      const isAdminEmail = ADMIN_EMAILS.has(payload.email.toLowerCase()) && Boolean(payload.email_verified);
      let isAdmin = isAdminEmail || existingUser?.role === 'admin';

      if (!isAdmin) {
        isAdmin = await this.checkFirestoreAdmin(uid, token);
      }

      return {
        uid,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
        emailVerified: Boolean(payload.email_verified),
        isAdmin,
      };
    } catch {
      return null;
    }
  }

  ensureUserRecord(identity: VerifiedIdentity): UserProfile {
    const existing = repositoryStore.getUser(identity.uid);
    const now = new Date().toISOString();
    const isBootAdmin = ADMIN_EMAILS.has(identity.email.toLowerCase()) && identity.emailVerified;

    if (existing) {
      if (isBootAdmin && existing.role !== 'admin') {
        const promoted = { ...existing, role: 'admin' as const, updatedAt: now };
        return repositoryStore.upsertUser(promoted);
      }
      return existing;
    }

    const defaultPlan = SystemSettingsService.getSettings().defaultUserPlan || 'free';

    const created: UserProfile = {
      uid: identity.uid,
      name: identity.name,
      email: identity.email,
      photoUrl: identity.picture,
      plan: defaultPlan,
      role: isBootAdmin ? 'admin' : 'user',
      blocked: false,
      preferredTheme: 'cinematografico',
      preferredLanguage: 'pt-BR',
      preferredQuality: '1080p',
      parentalControl: false,
      notificationsEnabled: true,
      createdAt: now,
      updatedAt: now,
    };

    repositoryStore.upsertUser(created);
    repositoryStore.addLog({
      level: 'info',
      service: 'AuthenticationService',
      message: `Novo perfil sincronizado: ${created.email} (${created.role}).`,
    });
    return created;
  }
}

export const AuthenticationService = new AuthenticationServiceImpl();
export type { VerifiedIdentity };
