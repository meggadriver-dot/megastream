import { sanitizePlainText } from '../../shared/catalogUtils';
import type { PlanId, ThemeId, UserProfile } from '../../shared/types';
import { repositoryStore } from '../repositories/interfaces';

const VALID_THEMES: ThemeId[] = [
  'cinematografico',
  'neon-roxo',
  'minimalista',
  'gold-premium',
  '3d-glass',
];

class UserServiceImpl {
  getAllUsers(): UserProfile[] {
    return repositoryStore.getUsers();
  }

  getUser(uid: string): UserProfile | null {
    return repositoryStore.getUser(uid);
  }

  updatePreferences(
    uid: string,
    updates: Partial<
      Pick<
        UserProfile,
        | 'name'
        | 'photoUrl'
        | 'preferredTheme'
        | 'preferredLanguage'
        | 'preferredQuality'
        | 'parentalControl'
        | 'notificationsEnabled'
      >
    >
  ): UserProfile | null {
    const user = repositoryStore.getUser(uid);
    if (!user) return null;

    const next: UserProfile = {
      ...user,
      name: updates.name ? sanitizePlainText(updates.name, 120) : user.name,
      photoUrl: updates.photoUrl !== undefined ? sanitizePlainText(updates.photoUrl, 500) : user.photoUrl,
      preferredTheme:
        updates.preferredTheme && VALID_THEMES.includes(updates.preferredTheme)
          ? updates.preferredTheme
          : user.preferredTheme,
      preferredLanguage: updates.preferredLanguage
        ? sanitizePlainText(updates.preferredLanguage, 16)
        : user.preferredLanguage,
      preferredQuality: updates.preferredQuality
        ? sanitizePlainText(updates.preferredQuality, 16)
        : user.preferredQuality,
      parentalControl:
        typeof updates.parentalControl === 'boolean'
          ? updates.parentalControl
          : user.parentalControl,
      notificationsEnabled:
        typeof updates.notificationsEnabled === 'boolean'
          ? updates.notificationsEnabled
          : user.notificationsEnabled,
      updatedAt: new Date().toISOString(),
    };

    return repositoryStore.upsertUser(next);
  }

  adminUpdateUser(
    uid: string,
    updates: Partial<Pick<UserProfile, 'blocked' | 'role' | 'plan'>>
  ): UserProfile | null {
    const user = repositoryStore.getUser(uid);
    if (!user) return null;

    const validPlans: PlanId[] = ['free', 'monthly', 'quarterly', 'annual'];
    const next: UserProfile = {
      ...user,
      blocked: typeof updates.blocked === 'boolean' ? updates.blocked : user.blocked,
      role: updates.role === 'admin' || updates.role === 'user' ? updates.role : user.role,
      plan: updates.plan && validPlans.includes(updates.plan) ? updates.plan : user.plan,
      updatedAt: new Date().toISOString(),
    };

    repositoryStore.upsertUser(next);
    repositoryStore.addLog({
      level: 'info',
      service: 'UserService',
      message: `Admin atualizou conta ${user.email}: role=${next.role}, blocked=${next.blocked}, plan=${next.plan}.`,
    });
    return next;
  }
}

export const UserService = new UserServiceImpl();
