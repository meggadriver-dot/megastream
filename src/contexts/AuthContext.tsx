import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  createDefaultProfiles,
  hashProfilePin,
  MAX_PROFILES_PER_ACCOUNT,
  sanitizeAvatarUrl,
  sanitizeProfileName,
  sanitizeProfileTheme,
  shouldShowProfileGate,
  toPublicStreamProfile,
  validateProfilePin,
  verifyProfilePin,
} from '../../shared/profileUtils';
import type {
  FavoriteItem,
  HistoryItem,
  MediaItem,
  MediaType,
  MegaEmbedPlayer,
  StoredStreamProfile,
  StreamProfile,
  ThemeId,
  UserProfile,
} from '../../shared/types';
import { resolveProfileAvatarUrl } from '../data/avatarPresets';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { apiRequest } from '../services/apiClient';
import { useTheme } from './ThemeContext';

const LOCAL_FAVS_KEY = 'megastream_guest_favorites';
const LOCAL_HISTORY_KEY = 'megastream_guest_history';
const LOCAL_PROFILES_KEY = 'megastream_guest_profiles_v1';
const LOCAL_ACTIVE_PROFILE_KEY = 'megastream_active_profile_v1';
const SESSION_PROFILE_KEY = 'megastream_session_profile_uid_v1';

export interface ProfileFormInput {
  name: string;
  avatarId: string;
  avatarUrl?: string;
  pin?: string;
  currentPin?: string;
  removePin?: boolean;
  isKids: boolean;
  preferredTheme: ThemeId;
  preferredLanguage: string;
  preferredQuality: string;
  autoplayNext: boolean;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  profiles: StreamProfile[];
  activeProfile: StreamProfile | null;
  loading: boolean;
  showProfileGate: boolean;
  profileSelectedForSession: boolean;
  favorites: FavoriteItem[];
  history: HistoryItem[];
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  openProfileGate: () => void;
  selectProfile: (
    profileId: string,
    pin?: string
  ) => Promise<{ ok: boolean; requiresPin?: boolean; error?: string }>;
  createProfile: (input: ProfileFormInput) => Promise<StreamProfile>;
  updateProfileItem: (profileId: string, input: ProfileFormInput) => Promise<StreamProfile>;
  deleteProfileItem: (profileId: string, currentPin?: string) => Promise<void>;
  verifyProfileAccess: (profileId: string, pin: string) => Promise<boolean>;
  isFavorite: (tmdbId: number, mediaType: MediaType) => boolean;
  toggleFavorite: (
    item: Pick<
      MediaItem,
      'tmdbId' | 'mediaType' | 'title' | 'posterPath' | 'voteAverage' | 'releaseYear'
    >
  ) => Promise<void>;
  recordPlayback: (payload: {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    progressPercent?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    playerProvider?: MegaEmbedPlayer;
  }) => Promise<void>;
  updatePreferences: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getGuestFavoritesKey(profileId: string): string {
  return profileId === 'profile_main' ? LOCAL_FAVS_KEY : `${LOCAL_FAVS_KEY}_${profileId}`;
}

function getGuestHistoryKey(profileId: string): string {
  return profileId === 'profile_main' ? LOCAL_HISTORY_KEY : `${LOCAL_HISTORY_KEY}_${profileId}`;
}

function loadGuestProfiles(): StoredStreamProfile[] {
  const saved = readLocalJson<StoredStreamProfile[]>(LOCAL_PROFILES_KEY, []);
  if (Array.isArray(saved) && saved.length > 0) {
    return saved;
  }
  const defaults = createDefaultProfiles('guest', 'Principal');
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storedProfiles, setStoredProfiles] = useState<StoredStreamProfile[]>(() =>
    loadGuestProfiles()
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    const initial = loadGuestProfiles();
    const savedActive = localStorage.getItem(LOCAL_ACTIVE_PROFILE_KEY);
    if (savedActive && initial.some((p) => p.id === savedActive)) {
      return savedActive;
    }
    return initial[0]?.id ?? 'profile_main';
  });
  const [profileSelectedForSession, setProfileSelectedForSession] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    readLocalJson<FavoriteItem[]>(getGuestFavoritesKey(activeProfileId), [])
  );
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    readLocalJson<HistoryItem[]>(getGuestHistoryKey(activeProfileId), [])
  );
  const { setTheme } = useTheme();

  const profiles: StreamProfile[] = useMemo(
    () =>
      storedProfiles.map((p) => ({
        ...toPublicStreamProfile(p),
        avatarUrl: resolveProfileAvatarUrl(p.avatarId, p.avatarUrl),
      })),
    [storedProfiles]
  );

  const activeProfile: StreamProfile | null = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;
  }, [profiles, activeProfileId]);

  const applyActiveProfileSelection = useCallback(
    (nextProfile: StreamProfile, isGuest: boolean, uid?: string | null) => {
      setActiveProfileId(nextProfile.id);
      localStorage.setItem(LOCAL_ACTIVE_PROFILE_KEY, nextProfile.id);
      if (nextProfile.preferredTheme) {
        setTheme(nextProfile.preferredTheme);
      }
      if (!isGuest && uid) {
        sessionStorage.setItem(SESSION_PROFILE_KEY, uid);
        setProfileSelectedForSession(true);
      }
      if (isGuest) {
        setFavorites(readLocalJson<FavoriteItem[]>(getGuestFavoritesKey(nextProfile.id), []));
        setHistory(readLocalJson<HistoryItem[]>(getGuestHistoryKey(nextProfile.id), []));
      }
    },
    [setTheme]
  );

  const openProfileGate = useCallback(() => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
  }, []);

  const syncUserFromServerAndFirestore = useCallback(
    async (user: FirebaseUser) => {
      try {
        const me = await apiRequest<{ user: UserProfile }>('/api/users/me');
        setProfile(me.user);
        if (me.user.preferredTheme) {
          setTheme(me.user.preferredTheme as ThemeId);
        }

        // Sync user document in Firestore if verified
        if (user.emailVerified) {
          const userRef = doc(db, 'users', user.uid);
          try {
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || me.user.name,
                email: user.email || me.user.email,
                photoUrl: user.photoURL || '',
                plan: 'free',
                role: 'user',
                blocked: false,
                preferredTheme: me.user.preferredTheme,
                preferredLanguage: me.user.preferredLanguage,
                preferredQuality: me.user.preferredQuality,
                parentalControl: me.user.parentalControl,
                notificationsEnabled: me.user.notificationsEnabled,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
          }
        }

        // Load multi-profiles, favorites & history from backend + Firestore
        const [profRes, favRes, histRes] = await Promise.all([
          apiRequest<{ items: StreamProfile[] }>('/api/users/profiles'),
          apiRequest<{ items: FavoriteItem[] }>('/api/users/favorites'),
          apiRequest<{ items: HistoryItem[] }>('/api/users/history'),
        ]);

        let mergedProfiles: StoredStreamProfile[] = profRes.items.map((p) => ({ ...p }));

        if (user.emailVerified) {
          try {
            const profSnap = await getDocs(collection(db, 'users', user.uid, 'profiles'));
            if (!profSnap.empty) {
              const fsProfiles: StoredStreamProfile[] = profSnap.docs.map((d) => {
                const data = d.data();
                return {
                  id: String(data.id || d.id),
                  userId: user.uid,
                  name: String(data.name || 'Perfil'),
                  avatarId: String(data.avatarId || 'avatar_movie_astronaut'),
                  avatarUrl: String(data.avatarUrl || ''),
                  hasPin: Boolean(data.hasPin),
                  pinHash: typeof data.pinHash === 'string' ? data.pinHash : '',
                  isKids: Boolean(data.isKids),
                  preferredTheme: sanitizeProfileTheme(data.preferredTheme, 'cinematografico'),
                  preferredLanguage: String(data.preferredLanguage || 'pt-BR'),
                  preferredQuality: String(data.preferredQuality || '1080p'),
                  autoplayNext: data.autoplayNext !== false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
              });
              if (fsProfiles.length >= mergedProfiles.length) {
                mergedProfiles = fsProfiles;
              }
            } else if (mergedProfiles.length > 0) {
              // Seed initial profile to Firestore
              const first = mergedProfiles[0];
              await setDoc(doc(db, 'users', user.uid, 'profiles', first.id), {
                id: first.id,
                userId: user.uid,
                name: first.name.slice(0, 40),
                avatarId: first.avatarId.slice(0, 64),
                avatarUrl: (first.avatarUrl || '/src/assets/images/avatar_movie_astronaut_1794675753848.jpg').slice(0, 45000),
                hasPin: Boolean(first.hasPin),
                pinHash: '',
                isKids: Boolean(first.isKids),
                preferredTheme: first.preferredTheme,
                preferredLanguage: first.preferredLanguage,
                preferredQuality: first.preferredQuality,
                autoplayNext: Boolean(first.autoplayNext),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch {
            // Keep server profiles if Firestore read/seed is restricted
          }
        }

        if (mergedProfiles.length === 0) {
          mergedProfiles = createDefaultProfiles(user.uid, me.user.name);
        }

        setStoredProfiles(mergedProfiles);
        const savedActive = localStorage.getItem(LOCAL_ACTIVE_PROFILE_KEY);
        const nextActive =
          mergedProfiles.find((p) => p.id === savedActive && !p.hasPin) ??
          mergedProfiles.find((p) => !p.hasPin) ??
          mergedProfiles[0];
        if (nextActive) {
          setActiveProfileId(nextActive.id);
          localStorage.setItem(LOCAL_ACTIVE_PROFILE_KEY, nextActive.id);
          if (nextActive.preferredTheme) {
            setTheme(nextActive.preferredTheme);
          }
        }

        let mergedFavs = favRes.items;
        let mergedHist = histRes.items;

        try {
          const favSnap = await getDocs(collection(db, 'users', user.uid, 'favorites'));
          if (!favSnap.empty) {
            const fsFavs = favSnap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                userId: user.uid,
                tmdbId: Number(data.tmdbId),
                mediaType: (data.mediaType === 'tv' ? 'tv' : 'movie') as MediaType,
                title: String(data.title || ''),
                posterPath: data.posterPath ?? null,
                voteAverage: Number(data.voteAverage ?? 0),
                releaseYear: String(data.releaseYear ?? ''),
                createdAt: new Date().toISOString(),
              };
            });
            if (fsFavs.length > mergedFavs.length) mergedFavs = fsFavs;
          }
        } catch {
          // Ignore if rules deny unverified read
        }

        setFavorites(mergedFavs);
        setHistory(mergedHist);
      } catch (err) {
        console.error('Erro ao sincronizar perfil:', err);
      }
    },
    [setTheme]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const alreadySelected = sessionStorage.getItem(SESSION_PROFILE_KEY) === user.uid;
        setProfileSelectedForSession(alreadySelected);
        await syncUserFromServerAndFirestore(user);
      } else {
        setProfile(null);
        setProfileSelectedForSession(false);
        sessionStorage.removeItem(SESSION_PROFILE_KEY);
        const guestProfiles = loadGuestProfiles();
        setStoredProfiles(guestProfiles);
        const savedActive = localStorage.getItem(LOCAL_ACTIVE_PROFILE_KEY);
        const active =
          guestProfiles.find((p) => p.id === savedActive) ?? guestProfiles[0] ?? null;
        if (active) {
          setActiveProfileId(active.id);
          setFavorites(readLocalJson<FavoriteItem[]>(getGuestFavoritesKey(active.id), []));
          setHistory(readLocalJson<HistoryItem[]>(getGuestHistoryKey(active.id), []));
          if (active.preferredTheme) {
            setTheme(active.preferredTheme);
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [setTheme, syncUserFromServerAndFirestore]);

  const signInWithGoogle = async () => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    const cred = await signInWithPopup(auth, googleProvider);
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    await syncUserFromServerAndFirestore(cred.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    await syncUserFromServerAndFirestore(cred.user);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    await syncUserFromServerAndFirestore(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
    await signOut(auth);
    setProfile(null);
  };

  const verifyProfileAccess = useCallback(
    async (profileId: string, pin: string): Promise<boolean> => {
      const target = storedProfiles.find((p) => p.id === profileId);
      if (!target) return false;
      if (!target.hasPin) return true;

      if (firebaseUser) {
        try {
          const res = await apiRequest<{ verified: boolean }>(
            `/api/users/profiles/${profileId}/verify-pin`,
            {
              method: 'POST',
              body: JSON.stringify({ pin }),
            }
          );
          if (res.verified) return true;
        } catch {
          // Fallback to Firestore pinHash if serverless instance was cold
        }
        if (target.pinHash) {
          return verifyProfilePin(profileId, pin, target.pinHash);
        }
        if (firebaseUser.emailVerified) {
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid, 'profiles', profileId));
            const remoteHash = snap.exists() ? String(snap.data().pinHash ?? '') : '';
            return verifyProfilePin(profileId, pin, remoteHash);
          } catch {
            return false;
          }
        }
        return false;
      }

      return verifyProfilePin(profileId, pin, target.pinHash);
    },
    [firebaseUser, storedProfiles]
  );

  const selectProfile = useCallback(
    async (
      profileId: string,
      pin?: string
    ): Promise<{ ok: boolean; requiresPin?: boolean; error?: string }> => {
      const target = profiles.find((p) => p.id === profileId);
      if (!target) {
        return { ok: false, error: 'Perfil não encontrado.' };
      }

      if (target.hasPin && (target.id !== activeProfileId || (Boolean(firebaseUser) && !profileSelectedForSession))) {
        if (!pin) {
          return { ok: false, requiresPin: true };
        }
        const ok = await verifyProfileAccess(profileId, pin);
        if (!ok) {
          return { ok: false, requiresPin: true, error: 'Senha incorreta. Tente novamente.' };
        }
      }

      applyActiveProfileSelection(target, !firebaseUser, firebaseUser?.uid);
      return { ok: true };
    },
    [
      activeProfileId,
      applyActiveProfileSelection,
      firebaseUser,
      profileSelectedForSession,
      profiles,
      verifyProfileAccess,
    ]
  );

  const createProfile = async (input: ProfileFormInput): Promise<StreamProfile> => {
    if (storedProfiles.length >= MAX_PROFILES_PER_ACCOUNT) {
      throw new Error(`Limite máximo de ${MAX_PROFILES_PER_ACCOUNT} perfis atingido.`);
    }
    const cleanPin = (input.pin ?? '').trim();
    if (cleanPin.length > 0 && !validateProfilePin(cleanPin)) {
      throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
    }

    if (firebaseUser) {
      const created = await apiRequest<StreamProfile>('/api/users/profiles', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const pinHash = cleanPin ? await hashProfilePin(created.id, cleanPin) : '';
      const stored: StoredStreamProfile = { ...created, pinHash };

      if (firebaseUser.emailVerified) {
        const docRef = doc(db, 'users', firebaseUser.uid, 'profiles', created.id);
        try {
          await setDoc(docRef, {
            id: created.id,
            userId: firebaseUser.uid,
            name: created.name.slice(0, 40),
            avatarId: created.avatarId.slice(0, 64),
            avatarUrl: sanitizeAvatarUrl(input.avatarUrl || created.avatarUrl),
            hasPin: created.hasPin,
            pinHash,
            isKids: created.isKids,
            preferredTheme: created.preferredTheme,
            preferredLanguage: created.preferredLanguage,
            preferredQuality: created.preferredQuality,
            autoplayNext: created.autoplayNext,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${firebaseUser.uid}/profiles/${created.id}`
          );
        }
      }

      setStoredProfiles((prev) => [...prev, stored]);
      if (profileSelectedForSession) {
        applyActiveProfileSelection(
          { ...created, avatarUrl: resolveProfileAvatarUrl(created.avatarId, created.avatarUrl) },
          false,
          firebaseUser.uid
        );
      }
      return created;
    }

    // Guest mode local persistence
    const id = `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const pinHash = cleanPin ? await hashProfilePin(id, cleanPin) : '';
    const avatarUrl =
      input.avatarId === 'custom'
        ? sanitizeAvatarUrl(input.avatarUrl)
        : resolveProfileAvatarUrl(input.avatarId, input.avatarUrl);

    const newProfile: StoredStreamProfile = {
      id,
      userId: 'guest',
      name: sanitizeProfileName(input.name, 'Novo Perfil'),
      avatarId: input.avatarId || 'avatar_cartoon_hero',
      avatarUrl,
      hasPin: Boolean(cleanPin),
      pinHash,
      isKids: Boolean(input.isKids),
      preferredTheme: sanitizeProfileTheme(input.preferredTheme, 'cinematografico'),
      preferredLanguage: input.preferredLanguage || 'pt-BR',
      preferredQuality: input.preferredQuality || '1080p',
      autoplayNext: Boolean(input.autoplayNext),
      createdAt: now,
      updatedAt: now,
    };

    const next = [...storedProfiles, newProfile];
    setStoredProfiles(next);
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(next));
    const pub = {
      ...toPublicStreamProfile(newProfile),
      avatarUrl: resolveProfileAvatarUrl(newProfile.avatarId, newProfile.avatarUrl),
    };
    applyActiveProfileSelection(pub, true);
    return pub;
  };

  const updateProfileItem = async (
    profileId: string,
    input: ProfileFormInput
  ): Promise<StreamProfile> => {
    const existing = storedProfiles.find((p) => p.id === profileId);
    if (!existing) {
      throw new Error('Perfil não encontrado.');
    }

    const cleanPin = (input.pin ?? '').trim();
    if (cleanPin.length > 0 && !validateProfilePin(cleanPin)) {
      throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
    }

    if (firebaseUser) {
      const updated = await apiRequest<StreamProfile>(`/api/users/profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });

      let nextPinHash = existing.pinHash ?? '';
      if (input.removePin) {
        nextPinHash = '';
      } else if (cleanPin.length > 0) {
        nextPinHash = await hashProfilePin(profileId, cleanPin);
      }

      if (firebaseUser.emailVerified) {
        const docRef = doc(db, 'users', firebaseUser.uid, 'profiles', profileId);
        try {
          await updateDoc(docRef, {
            name: updated.name.slice(0, 40),
            avatarId: updated.avatarId.slice(0, 64),
            avatarUrl: sanitizeAvatarUrl(input.avatarUrl || updated.avatarUrl),
            hasPin: updated.hasPin,
            pinHash: nextPinHash,
            isKids: updated.isKids,
            preferredTheme: updated.preferredTheme,
            preferredLanguage: updated.preferredLanguage,
            preferredQuality: updated.preferredQuality,
            autoplayNext: updated.autoplayNext,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `users/${firebaseUser.uid}/profiles/${profileId}`
          );
        }
      }

      const nextStored: StoredStreamProfile = { ...updated, pinHash: nextPinHash };
      setStoredProfiles((prev) => prev.map((p) => (p.id === profileId ? nextStored : p)));
      if (activeProfileId === profileId && updated.preferredTheme) {
        setTheme(updated.preferredTheme);
      }
      return updated;
    }

    // Guest mode update
    if (existing.hasPin && (cleanPin.length > 0 || input.removePin)) {
      const verified = await verifyProfilePin(profileId, input.currentPin ?? '', existing.pinHash);
      if (!verified) {
        throw new Error('Senha atual do perfil incorreta.');
      }
    }

    let nextHasPin = existing.hasPin;
    let nextPinHash = existing.pinHash ?? '';
    if (input.removePin) {
      nextHasPin = false;
      nextPinHash = '';
    } else if (cleanPin.length > 0) {
      nextHasPin = true;
      nextPinHash = await hashProfilePin(profileId, cleanPin);
    }

    const avatarUrl =
      input.avatarId === 'custom'
        ? sanitizeAvatarUrl(input.avatarUrl)
        : resolveProfileAvatarUrl(input.avatarId, input.avatarUrl);

    const nextStored: StoredStreamProfile = {
      ...existing,
      name: sanitizeProfileName(input.name, existing.name),
      avatarId: input.avatarId || existing.avatarId,
      avatarUrl,
      hasPin: nextHasPin,
      pinHash: nextPinHash,
      isKids: Boolean(input.isKids),
      preferredTheme: sanitizeProfileTheme(input.preferredTheme, existing.preferredTheme),
      preferredLanguage: input.preferredLanguage || existing.preferredLanguage,
      preferredQuality: input.preferredQuality || existing.preferredQuality,
      autoplayNext: Boolean(input.autoplayNext),
      updatedAt: new Date().toISOString(),
    };

    const nextList = storedProfiles.map((p) => (p.id === profileId ? nextStored : p));
    setStoredProfiles(nextList);
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(nextList));
    if (activeProfileId === profileId) {
      setTheme(nextStored.preferredTheme);
    }
    return {
      ...toPublicStreamProfile(nextStored),
      avatarUrl: resolveProfileAvatarUrl(nextStored.avatarId, nextStored.avatarUrl),
    };
  };

  const deleteProfileItem = async (profileId: string, currentPin?: string): Promise<void> => {
    if (storedProfiles.length <= 1) {
      throw new Error('É necessário manter pelo menos um perfil ativo.');
    }
    const target = storedProfiles.find((p) => p.id === profileId);
    if (!target) return;

    if (firebaseUser) {
      await apiRequest(`/api/users/profiles/${profileId}`, {
        method: 'DELETE',
        body: JSON.stringify({ currentPin }),
      });
      if (firebaseUser.emailVerified) {
        try {
          await deleteDoc(doc(db, 'users', firebaseUser.uid, 'profiles', profileId));
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${firebaseUser.uid}/profiles/${profileId}`
          );
        }
      }
      const next = storedProfiles.filter((p) => p.id !== profileId);
      setStoredProfiles(next);
      if (activeProfileId === profileId && next[0]) {
        applyActiveProfileSelection(
          { ...toPublicStreamProfile(next[0]), avatarUrl: resolveProfileAvatarUrl(next[0].avatarId, next[0].avatarUrl) },
          false
        );
      }
      return;
    }

    if (target.hasPin) {
      const ok = await verifyProfilePin(profileId, currentPin ?? '', target.pinHash);
      if (!ok) {
        throw new Error('Informe a senha atual do perfil para excluí-lo.');
      }
    }

    const next = storedProfiles.filter((p) => p.id !== profileId);
    setStoredProfiles(next);
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(next));
    localStorage.removeItem(getGuestFavoritesKey(profileId));
    localStorage.removeItem(getGuestHistoryKey(profileId));
    if (activeProfileId === profileId && next[0]) {
      applyActiveProfileSelection(
        { ...toPublicStreamProfile(next[0]), avatarUrl: resolveProfileAvatarUrl(next[0].avatarId, next[0].avatarUrl) },
        true
      );
    }
  };

  const isFavorite = useCallback(
    (tmdbId: number, mediaType: MediaType) =>
      favorites.some((f) => f.tmdbId === tmdbId && f.mediaType === mediaType),
    [favorites]
  );

  const toggleFavorite = async (
    item: Pick<
      MediaItem,
      'tmdbId' | 'mediaType' | 'title' | 'posterPath' | 'voteAverage' | 'releaseYear'
    >
  ) => {
    const exists = isFavorite(item.tmdbId, item.mediaType);
    const favId = `${item.mediaType}_${item.tmdbId}`;

    if (firebaseUser) {
      if (exists) {
        await apiRequest(`/api/users/favorites/${item.tmdbId}?type=${item.mediaType}`, {
          method: 'DELETE',
        });
        setFavorites((prev) =>
          prev.filter((f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType))
        );
        if (firebaseUser.emailVerified) {
          try {
            await deleteDoc(doc(db, 'users', firebaseUser.uid, 'favorites', favId));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `users/${firebaseUser.uid}/favorites/${favId}`);
          }
        }
      } else {
        const created = await apiRequest<FavoriteItem>('/api/users/favorites', {
          method: 'POST',
          body: JSON.stringify(item),
        });
        setFavorites((prev) => [created, ...prev]);
        if (firebaseUser.emailVerified) {
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid, 'favorites', favId), {
              userId: firebaseUser.uid,
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title.slice(0, 200),
              posterPath: item.posterPath ?? '',
              voteAverage: item.voteAverage ?? 0,
              releaseYear: item.releaseYear ?? '',
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}/favorites/${favId}`);
          }
        }
      }
      return;
    }

    // Guest local persistence scoped by active profile
    const favKey = getGuestFavoritesKey(activeProfileId);
    if (exists) {
      const next = favorites.filter(
        (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
      );
      setFavorites(next);
      localStorage.setItem(favKey, JSON.stringify(next));
    } else {
      const nextItem: FavoriteItem = {
        id: favId,
        userId: activeProfileId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.posterPath,
        voteAverage: item.voteAverage,
        releaseYear: item.releaseYear,
        createdAt: new Date().toISOString(),
      };
      const next = [nextItem, ...favorites];
      setFavorites(next);
      localStorage.setItem(favKey, JSON.stringify(next));
    }
  };

  const recordPlayback = async (payload: {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    progressPercent?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    playerProvider?: MegaEmbedPlayer;
  }) => {
    const histId = `${payload.mediaType}_${payload.tmdbId}`;

    if (firebaseUser) {
      try {
        const saved = await apiRequest<HistoryItem>('/api/users/history', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setHistory((prev) => [
          saved,
          ...prev.filter((h) => !(h.tmdbId === saved.tmdbId && h.mediaType === saved.mediaType)),
        ]);
        if (firebaseUser.emailVerified) {
          await setDoc(doc(db, 'users', firebaseUser.uid, 'history', histId), {
            userId: firebaseUser.uid,
            tmdbId: payload.tmdbId,
            mediaType: payload.mediaType,
            title: payload.title.slice(0, 200),
            posterPath: payload.posterPath ?? '',
            backdropPath: payload.backdropPath ?? '',
            progressPercent: payload.progressPercent ?? 15,
            seasonNumber: payload.seasonNumber ?? 0,
            episodeNumber: payload.episodeNumber ?? 0,
            playerProvider: payload.playerProvider ?? 'vidstack',
            watchedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-blocking playback record
      }
      return;
    }

    const histKey = getGuestHistoryKey(activeProfileId);
    const entry: HistoryItem = {
      id: histId,
      userId: activeProfileId,
      tmdbId: payload.tmdbId,
      mediaType: payload.mediaType,
      title: payload.title,
      posterPath: payload.posterPath ?? null,
      backdropPath: payload.backdropPath ?? null,
      progressPercent: payload.progressPercent ?? 15,
      seasonNumber: payload.seasonNumber,
      episodeNumber: payload.episodeNumber,
      playerProvider: payload.playerProvider,
      watchedAt: new Date().toISOString(),
    };
    const next = [
      entry,
      ...history.filter((h) => !(h.tmdbId === entry.tmdbId && h.mediaType === entry.mediaType)),
    ].slice(0, 50);
    setHistory(next);
    localStorage.setItem(histKey, JSON.stringify(next));
  };

  const updatePreferences = async (updates: Partial<UserProfile>) => {
    if (updates.preferredTheme) {
      setTheme(updates.preferredTheme);
    }
    if (!firebaseUser) return;
    const res = await apiRequest<{ user: UserProfile }>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setProfile(res.user);
  };

  const showProfileGate = shouldShowProfileGate({
    isAuthenticated: Boolean(firebaseUser),
    isAuthLoading: loading,
    profileSelectedForSession,
  });

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        profiles,
        activeProfile,
        loading,
        showProfileGate,
        profileSelectedForSession,
        favorites,
        history,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        openProfileGate,
        selectProfile,
        createProfile,
        updateProfileItem,
        deleteProfileItem,
        verifyProfileAccess,
        isFavorite,
        toggleFavorite,
        recordPlayback,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
