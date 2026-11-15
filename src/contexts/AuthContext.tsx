import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  canDeleteProfile,
  createDefaultProfiles,
  deduplicateProfilesById,
  getAvatarPresetById,
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
import {
  buildFavoriteRecord,
  buildHistoryRecord,
  mergeFavoriteLists,
  mergeHistoryLists,
} from '../../shared/userLibraryUtils';
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
import { useSiteConfig } from './SiteConfigContext';
import { useTheme } from './ThemeContext';

const LOCAL_FAVS_KEY = 'megastream_guest_favorites';
const LOCAL_HISTORY_KEY = 'megastream_guest_history';
const USER_FAVS_PREFIX = 'megastream_user_favs_v1_';
const USER_HISTORY_PREFIX = 'megastream_user_hist_v1_';
const USER_PROFILES_PREFIX = 'megastream_user_profiles_v1_';
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
  removeFromHistory: (tmdbId: number, mediaType: MediaType) => Promise<void>;
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

function writeLocalJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getGuestFavoritesKey(profileId: string): string {
  return profileId === 'profile_main' ? LOCAL_FAVS_KEY : `${LOCAL_FAVS_KEY}_${profileId}`;
}

function getGuestHistoryKey(profileId: string): string {
  return profileId === 'profile_main' ? LOCAL_HISTORY_KEY : `${LOCAL_HISTORY_KEY}_${profileId}`;
}

function getUserFavoritesKey(uid: string): string {
  return `${USER_FAVS_PREFIX}${uid}`;
}

function getUserHistoryKey(uid: string): string {
  return `${USER_HISTORY_PREFIX}${uid}`;
}

function getUserProfilesKey(uid: string): string {
  return `${USER_PROFILES_PREFIX}${uid}`;
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
  const { runtimeSettings } = useSiteConfig();
  const syncInFlightRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);

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
        setTheme(nextProfile.preferredTheme, storedProfiles.length > 1);
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
    [setTheme, storedProfiles.length]
  );

  const openProfileGate = useCallback(() => {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfileSelectedForSession(false);
  }, []);

  const syncUserFromServerAndFirestore = useCallback(
    async (user: FirebaseUser) => {
      if (syncInFlightRef.current?.uid === user.uid) {
        return syncInFlightRef.current.promise;
      }

      const run = (async () => {
        // Hydrate user caches immediately so reloading never flashes empty
        const cachedProfiles = readLocalJson<StoredStreamProfile[]>(
          getUserProfilesKey(user.uid),
          []
        );
        const cachedFavs = readLocalJson<FavoriteItem[]>(getUserFavoritesKey(user.uid), []);
        const cachedHist = readLocalJson<HistoryItem[]>(getUserHistoryKey(user.uid), []);
        if (cachedProfiles.length > 0) setStoredProfiles(deduplicateProfilesById(cachedProfiles));
        if (cachedFavs.length > 0) setFavorites(cachedFavs);
        if (cachedHist.length > 0) setHistory(cachedHist);

        try {
          const me = await apiRequest<{ user: UserProfile }>('/api/users/me');
          setProfile(me.user);
          if (me.user.preferredTheme && me.user.preferredTheme !== 'cinematografico') {
            setTheme(me.user.preferredTheme as ThemeId, false);
          }

          // Sync user document in Firestore (works for both Google & Email/Password accounts)
          const userRef = doc(db, 'users', user.uid);
          try {
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              await setDoc(userRef, {
                uid: user.uid,
                name: (user.displayName || me.user.name || 'Usuário').slice(0, 120),
                email: (user.email || me.user.email || 'user@megastream.app').slice(0, 180),
                photoUrl: (user.photoURL || '').slice(0, 500),
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
            console.error('Erro ao sincronizar documento do usuário no Firestore:', err);
          }

          // Load multi-profiles, favorites & history from backend + Firestore in parallel
          const [profRes, favRes, histRes, fsProfResult, fsFavResult, fsHistResult] =
            await Promise.all([
              apiRequest<{ items: StreamProfile[] }>('/api/users/profiles').catch(() => ({
                items: [],
              })),
              apiRequest<{ items: FavoriteItem[] }>('/api/users/favorites').catch(() => ({
                items: [],
              })),
              apiRequest<{ items: HistoryItem[] }>('/api/users/history').catch(() => ({
                items: [],
              })),
              getDocs(
                query(collection(db, 'users', user.uid, 'profiles'), where('userId', '==', user.uid))
              ).catch((err) => {
                console.error('Erro ao carregar perfis do Firestore:', err);
                return null;
              }),
              getDocs(
                query(
                  collection(db, 'users', user.uid, 'favorites'),
                  where('userId', '==', user.uid)
                )
              ).catch((err) => {
                console.error('Erro ao carregar favoritos do Firestore:', err);
                return null;
              }),
              getDocs(
                query(collection(db, 'users', user.uid, 'history'), where('userId', '==', user.uid))
              ).catch((err) => {
                console.error('Erro ao carregar histórico do Firestore:', err);
                return null;
              }),
            ]);

          let mergedProfiles: StoredStreamProfile[] = deduplicateProfilesById(
            profRes.items.map((p) => ({ ...p }))
          );

          if (fsProfResult && !fsProfResult.empty) {
            // Firestore is canonical whenever docs exist (use real doc.id so deleteDoc always targets it)
            const fsProfiles: StoredStreamProfile[] = fsProfResult.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
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
            mergedProfiles = deduplicateProfilesById(fsProfiles);
          } else if (fsProfResult && fsProfResult.empty) {
            const seedSource =
              cachedProfiles.length > 0
                ? deduplicateProfilesById(cachedProfiles)
                : mergedProfiles.length > 0
                  ? mergedProfiles
                  : createDefaultProfiles(user.uid, me.user.name);
            mergedProfiles = seedSource;
            const first = seedSource[0];
            if (first) {
              await setDoc(doc(db, 'users', user.uid, 'profiles', first.id), {
                id: first.id,
                userId: user.uid,
                name: first.name.slice(0, 40),
                avatarId: first.avatarId.slice(0, 64),
                avatarUrl: (
                  first.avatarUrl || '/src/assets/images/avatar_movie_astronaut_1794675753848.jpg'
                ).slice(0, 45000),
                hasPin: Boolean(first.hasPin),
                pinHash: typeof first.pinHash === 'string' ? first.pinHash : '',
                isKids: Boolean(first.isKids),
                preferredTheme: first.preferredTheme,
                preferredLanguage: first.preferredLanguage,
                preferredQuality: first.preferredQuality,
                autoplayNext: Boolean(first.autoplayNext),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).catch(() => null);
            }
          }

          if (mergedProfiles.length === 0) {
            mergedProfiles =
              cachedProfiles.length > 0
                ? deduplicateProfilesById(cachedProfiles)
                : createDefaultProfiles(user.uid, me.user.name);
          }

          setStoredProfiles(mergedProfiles);
          writeLocalJson(getUserProfilesKey(user.uid), mergedProfiles);
          const savedActive = localStorage.getItem(LOCAL_ACTIVE_PROFILE_KEY);
          const nextActive =
            mergedProfiles.find((p) => p.id === savedActive && !p.hasPin) ??
            mergedProfiles.find((p) => !p.hasPin) ??
            mergedProfiles[0];
          if (nextActive) {
            setActiveProfileId(nextActive.id);
            localStorage.setItem(LOCAL_ACTIVE_PROFILE_KEY, nextActive.id);
            if (nextActive.preferredTheme && mergedProfiles.length > 1) {
              setTheme(nextActive.preferredTheme, false);
            }
          }

          // Favorites: Firestore is canonical cloud store; merge local/API when Firestore had no docs yet
          const fsFavs = fsFavResult
            ? fsFavResult.docs.map((d) => {
                const data = d.data();
                return buildFavoriteRecord(user.uid, {
                  tmdbId: Number(data.tmdbId),
                  mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
                  title: String(data.title || 'Título'),
                  posterPath:
                    typeof data.posterPath === 'string' && data.posterPath
                      ? data.posterPath
                      : null,
                  voteAverage: Number(data.voteAverage ?? 0),
                  releaseYear: String(data.releaseYear ?? ''),
                  createdAt: data.createdAt,
                });
              })
            : null;

          let mergedFavs: FavoriteItem[];
          if (fsFavs !== null) {
            mergedFavs =
              fsFavs.length > 0
                ? mergeFavoriteLists(fsFavs, [])
                : mergeFavoriteLists(favRes.items, cachedFavs);
          } else {
            mergedFavs = mergeFavoriteLists(favRes.items, cachedFavs);
          }

          // History: Firestore is canonical cloud store; fallback cleanly to API + user cache
          const fsHist = fsHistResult
            ? fsHistResult.docs.map((d) => {
                const data = d.data();
                return buildHistoryRecord(user.uid, {
                  tmdbId: Number(data.tmdbId),
                  mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
                  title: String(data.title || 'Título'),
                  posterPath:
                    typeof data.posterPath === 'string' && data.posterPath
                      ? data.posterPath
                      : null,
                  backdropPath:
                    typeof data.backdropPath === 'string' && data.backdropPath
                      ? data.backdropPath
                      : null,
                  progressPercent: Number(data.progressPercent ?? 15),
                  seasonNumber: Number(data.seasonNumber ?? 0) || undefined,
                  episodeNumber: Number(data.episodeNumber ?? 0) || undefined,
                  playerProvider: data.playerProvider as MegaEmbedPlayer | undefined,
                  watchedAt: data.watchedAt,
                });
              })
            : null;

          let mergedHist: HistoryItem[];
          if (fsHist !== null) {
            mergedHist =
              fsHist.length > 0
                ? mergeHistoryLists(fsHist, [])
                : mergeHistoryLists(histRes.items, cachedHist);
          } else {
            mergedHist = mergeHistoryLists(histRes.items, cachedHist);
          }

          setFavorites(mergedFavs);
          setHistory(mergedHist);
          writeLocalJson(getUserFavoritesKey(user.uid), mergedFavs);
          writeLocalJson(getUserHistoryKey(user.uid), mergedHist);
        } catch (err) {
          console.error('Erro ao sincronizar perfil:', err);
        }
      })();

      syncInFlightRef.current = { uid: user.uid, promise: run };
      try {
        await run;
      } finally {
        if (syncInFlightRef.current?.promise === run) {
          syncInFlightRef.current = null;
        }
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
          if (active.preferredTheme && guestProfiles.length > 1) {
            setTheme(active.preferredTheme, false);
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [setTheme, syncUserFromServerAndFirestore]);

  // Real-time Firestore sync for Profiles, Favorites & Continue Watching when authenticated
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;

    const profQuery = query(
      collection(db, 'users', uid, 'profiles'),
      where('userId', '==', uid)
    );
    const favQuery = query(
      collection(db, 'users', uid, 'favorites'),
      where('userId', '==', uid)
    );
    const histQuery = query(
      collection(db, 'users', uid, 'history'),
      where('userId', '==', uid)
    );

    const unsubProf = onSnapshot(
      profQuery,
      (snap) => {
        if (snap.metadata.fromCache && snap.empty) return;
        if (snap.empty) return;
        const items = deduplicateProfilesById(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: uid,
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
          })
        );
        setStoredProfiles(items);
        writeLocalJson(getUserProfilesKey(uid), items);
      },
      (err) => {
        console.error('Erro no listener de perfis:', err);
      }
    );

    const unsubFav = onSnapshot(
      favQuery,
      (snap) => {
        if (snap.metadata.fromCache && snap.empty) return;
        const items = mergeFavoriteLists(
          snap.docs.map((d) => {
            const data = d.data();
            return buildFavoriteRecord(uid, {
              tmdbId: Number(data.tmdbId),
              mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
              title: String(data.title || 'Título'),
              posterPath:
                typeof data.posterPath === 'string' && data.posterPath ? data.posterPath : null,
              voteAverage: Number(data.voteAverage ?? 0),
              releaseYear: String(data.releaseYear ?? ''),
              createdAt: data.createdAt,
            });
          })
        );
        setFavorites(items);
        writeLocalJson(getUserFavoritesKey(uid), items);
      },
      (err) => {
        console.error('Erro no listener de favoritos:', err);
      }
    );

    const unsubHist = onSnapshot(
      histQuery,
      (snap) => {
        if (snap.metadata.fromCache && snap.empty) return;
        const items = mergeHistoryLists(
          snap.docs.map((d) => {
            const data = d.data();
            return buildHistoryRecord(uid, {
              tmdbId: Number(data.tmdbId),
              mediaType: data.mediaType === 'tv' ? 'tv' : 'movie',
              title: String(data.title || 'Título'),
              posterPath:
                typeof data.posterPath === 'string' && data.posterPath ? data.posterPath : null,
              backdropPath:
                typeof data.backdropPath === 'string' && data.backdropPath
                  ? data.backdropPath
                  : null,
              progressPercent: Number(data.progressPercent ?? 15),
              seasonNumber: Number(data.seasonNumber ?? 0) || undefined,
              episodeNumber: Number(data.episodeNumber ?? 0) || undefined,
              playerProvider: data.playerProvider as MegaEmbedPlayer | undefined,
              watchedAt: data.watchedAt,
            });
          })
        );
        setHistory(items);
        writeLocalJson(getUserHistoryKey(uid), items);
      },
      (err) => {
        console.error('Erro no listener de histórico:', err);
      }
    );

    return () => {
      unsubProf();
      unsubFav();
      unsubHist();
    };
  }, [firebaseUser]);

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

      if (target.pinHash) {
        const localOk = await verifyProfilePin(profileId, pin, target.pinHash);
        if (localOk) return true;
      }

      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid, 'profiles', profileId));
          const remoteHash = snap.exists() ? String(snap.data().pinHash ?? '') : '';
          if (remoteHash && (await verifyProfilePin(profileId, pin, remoteHash))) {
            return true;
          }
        } catch {
          // Fall back to API verification if Firestore read fails
        }
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
          // Ignore cold-start failure
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

      if (
        target.hasPin &&
        (target.id !== activeProfileId || (Boolean(firebaseUser) && !profileSelectedForSession))
      ) {
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
    const maxProfiles = Math.max(
      1,
      Math.min(8, runtimeSettings.maxProfilesPerAccount || MAX_PROFILES_PER_ACCOUNT)
    );
    if (storedProfiles.length >= maxProfiles) {
      throw new Error(`Limite máximo de ${maxProfiles} perfis atingido.`);
    }
    const cleanPin = (input.pin ?? '').trim();
    if (cleanPin.length > 0 && !validateProfilePin(cleanPin)) {
      throw new Error('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
    }

    const id = `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const pinHash = cleanPin ? await hashProfilePin(id, cleanPin) : '';
    const preset = getAvatarPresetById(input.avatarId);
    const avatarId = preset ? preset.id : 'custom';
    const avatarUrl = preset
      ? preset.fallbackPath
      : sanitizeAvatarUrl(input.avatarUrl);

    if (firebaseUser) {
      const uid = firebaseUser.uid;
      const stored: StoredStreamProfile = {
        id,
        userId: uid,
        name: sanitizeProfileName(input.name, 'Novo Perfil'),
        avatarId,
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

      const nextList = deduplicateProfilesById([...storedProfiles, stored]);
      setStoredProfiles(nextList);
      writeLocalJson(getUserProfilesKey(uid), nextList);

      const docRef = doc(db, 'users', uid, 'profiles', id);
      try {
        await setDoc(docRef, {
          id,
          userId: uid,
          name: stored.name.slice(0, 40),
          avatarId: stored.avatarId.slice(0, 64),
          avatarUrl: stored.avatarUrl.slice(0, 45000),
          hasPin: stored.hasPin,
          pinHash,
          isKids: stored.isKids,
          preferredTheme: stored.preferredTheme,
          preferredLanguage: stored.preferredLanguage.slice(0, 16),
          preferredQuality: stored.preferredQuality.slice(0, 16),
          autoplayNext: stored.autoplayNext,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        setStoredProfiles(storedProfiles);
        writeLocalJson(getUserProfilesKey(uid), storedProfiles);
        handleFirestoreError(err, OperationType.CREATE, `users/${uid}/profiles/${id}`);
      }

      apiRequest<StreamProfile>('/api/users/profiles', {
        method: 'POST',
        body: JSON.stringify({ ...input, id }),
      }).catch(() => null);

      const pub: StreamProfile = {
        ...toPublicStreamProfile(stored),
        avatarUrl: resolveProfileAvatarUrl(stored.avatarId, stored.avatarUrl),
      };
      if (profileSelectedForSession) {
        applyActiveProfileSelection(pub, false, uid);
      }
      return pub;
    }

    // Guest mode local persistence
    const newProfile: StoredStreamProfile = {
      id,
      userId: 'guest',
      name: sanitizeProfileName(input.name, 'Novo Perfil'),
      avatarId,
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

    const next = deduplicateProfilesById([...storedProfiles, newProfile]);
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

    if (existing.hasPin && (cleanPin.length > 0 || input.removePin)) {
      const verified = await verifyProfileAccess(profileId, input.currentPin ?? '');
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

    const preset = getAvatarPresetById(input.avatarId);
    const avatarId = input.avatarId ? (preset ? preset.id : 'custom') : existing.avatarId;
    const avatarUrl = preset
      ? preset.fallbackPath
      : sanitizeAvatarUrl(input.avatarUrl ?? existing.avatarUrl);

    const nextStored: StoredStreamProfile = {
      ...existing,
      name: sanitizeProfileName(input.name, existing.name),
      avatarId,
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

    if (firebaseUser) {
      const uid = firebaseUser.uid;
      const nextList = storedProfiles.map((p) => (p.id === profileId ? nextStored : p));
      setStoredProfiles(nextList);
      writeLocalJson(getUserProfilesKey(uid), nextList);

      const docRef = doc(db, 'users', uid, 'profiles', profileId);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          await updateDoc(docRef, {
            name: nextStored.name.slice(0, 40),
            avatarId: nextStored.avatarId.slice(0, 64),
            avatarUrl: nextStored.avatarUrl.slice(0, 45000),
            hasPin: nextStored.hasPin,
            pinHash: nextPinHash,
            isKids: nextStored.isKids,
            preferredTheme: nextStored.preferredTheme,
            preferredLanguage: nextStored.preferredLanguage.slice(0, 16),
            preferredQuality: nextStored.preferredQuality.slice(0, 16),
            autoplayNext: nextStored.autoplayNext,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(docRef, {
            id: profileId,
            userId: uid,
            name: nextStored.name.slice(0, 40),
            avatarId: nextStored.avatarId.slice(0, 64),
            avatarUrl: nextStored.avatarUrl.slice(0, 45000),
            hasPin: nextStored.hasPin,
            pinHash: nextPinHash,
            isKids: nextStored.isKids,
            preferredTheme: nextStored.preferredTheme,
            preferredLanguage: nextStored.preferredLanguage.slice(0, 16),
            preferredQuality: nextStored.preferredQuality.slice(0, 16),
            autoplayNext: nextStored.autoplayNext,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        setStoredProfiles(storedProfiles);
        writeLocalJson(getUserProfilesKey(uid), storedProfiles);
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/profiles/${profileId}`);
      }

      apiRequest<StreamProfile>(`/api/users/profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).catch(() => null);

      if (activeProfileId === profileId && nextStored.preferredTheme) {
        setTheme(nextStored.preferredTheme);
      }
      return {
        ...toPublicStreamProfile(nextStored),
        avatarUrl: resolveProfileAvatarUrl(nextStored.avatarId, nextStored.avatarUrl),
      };
    }

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
    const check = canDeleteProfile(storedProfiles, profileId);
    if (!check.allowed) {
      throw new Error(check.reason || 'Não foi possível excluir este perfil.');
    }
    const target = storedProfiles.find((p) => p.id === profileId);
    if (!target) {
      throw new Error('Perfil não encontrado.');
    }

    if (target.hasPin) {
      const ok = await verifyProfileAccess(profileId, currentPin ?? '');
      if (!ok) {
        throw new Error('Informe a senha atual do perfil para excluí-lo.');
      }
    }

    if (firebaseUser) {
      const uid = firebaseUser.uid;
      const next = storedProfiles.filter((p) => p.id !== profileId);
      setStoredProfiles(next);
      writeLocalJson(getUserProfilesKey(uid), next);

      if (activeProfileId === profileId && next[0]) {
        applyActiveProfileSelection(
          {
            ...toPublicStreamProfile(next[0]),
            avatarUrl: resolveProfileAvatarUrl(next[0].avatarId, next[0].avatarUrl),
          },
          false,
          uid
        );
      }

      try {
        await deleteDoc(doc(db, 'users', uid, 'profiles', profileId));
      } catch (err) {
        setStoredProfiles(storedProfiles);
        writeLocalJson(getUserProfilesKey(uid), storedProfiles);
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/profiles/${profileId}`);
      }

      apiRequest(`/api/users/profiles/${profileId}`, {
        method: 'DELETE',
        body: JSON.stringify({ currentPin }),
      }).catch(() => null);
      return;
    }

    const next = storedProfiles.filter((p) => p.id !== profileId);
    setStoredProfiles(next);
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(next));
    localStorage.removeItem(getGuestFavoritesKey(profileId));
    localStorage.removeItem(getGuestHistoryKey(profileId));
    if (activeProfileId === profileId && next[0]) {
      applyActiveProfileSelection(
        {
          ...toPublicStreamProfile(next[0]),
          avatarUrl: resolveProfileAvatarUrl(next[0].avatarId, next[0].avatarUrl),
        },
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
      const uid = firebaseUser.uid;
      const favRef = doc(db, 'users', uid, 'favorites', favId);

      if (exists) {
        setFavorites((prev) => {
          const next = prev.filter(
            (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
          );
          writeLocalJson(getUserFavoritesKey(uid), next);
          return next;
        });
        apiRequest(`/api/users/favorites/${item.tmdbId}?type=${item.mediaType}`, {
          method: 'DELETE',
        }).catch(() => null);
        try {
          await deleteDoc(favRef);
        } catch (err) {
          console.error('Erro ao remover favorito no Firestore:', err);
        }
      } else {
        const record = buildFavoriteRecord(uid, item);
        setFavorites((prev) => {
          const next = mergeFavoriteLists([record], prev);
          writeLocalJson(getUserFavoritesKey(uid), next);
          return next;
        });
        apiRequest<FavoriteItem>('/api/users/favorites', {
          method: 'POST',
          body: JSON.stringify(item),
        }).catch(() => null);
        try {
          const existingSnap = await getDoc(favRef);
          await setDoc(favRef, {
            userId: uid,
            tmdbId: record.tmdbId,
            mediaType: record.mediaType,
            title: record.title.slice(0, 200),
            posterPath: (record.posterPath ?? '').slice(0, 400),
            voteAverage: record.voteAverage,
            releaseYear: (record.releaseYear ?? '').slice(0, 10),
            createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
          });
        } catch (err) {
          console.error('Erro ao salvar favorito no Firestore:', err);
        }
      }
      return;
    }

    // Guest local persistence scoped by active profile
    if (!exists && !runtimeSettings.allowGuestFavorites) {
      return;
    }
    const favKey = getGuestFavoritesKey(activeProfileId);
    if (exists) {
      const next = favorites.filter(
        (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
      );
      setFavorites(next);
      writeLocalJson(favKey, next);
    } else {
      const nextItem = buildFavoriteRecord(activeProfileId, item);
      const next = mergeFavoriteLists([nextItem], favorites);
      setFavorites(next);
      writeLocalJson(favKey, next);
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
      const uid = firebaseUser.uid;
      const entry = buildHistoryRecord(uid, payload);

      setHistory((prev) => {
        const next = mergeHistoryLists([entry], prev);
        writeLocalJson(getUserHistoryKey(uid), next);
        return next;
      });

      apiRequest<HistoryItem>('/api/users/history', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch(() => null);

      try {
        await setDoc(doc(db, 'users', uid, 'history', histId), {
          userId: uid,
          tmdbId: entry.tmdbId,
          mediaType: entry.mediaType,
          title: entry.title.slice(0, 200),
          posterPath: (entry.posterPath ?? '').slice(0, 400),
          backdropPath: (entry.backdropPath ?? '').slice(0, 400),
          progressPercent: entry.progressPercent,
          seasonNumber: entry.seasonNumber ?? 0,
          episodeNumber: entry.episodeNumber ?? 0,
          playerProvider: (entry.playerProvider ?? 'vidstack').slice(0, 32),
          watchedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Erro ao salvar histórico no Firestore:', err);
      }
      return;
    }

    const histKey = getGuestHistoryKey(activeProfileId);
    const entry = buildHistoryRecord(activeProfileId, payload);
    const next = mergeHistoryLists([entry], history);
    setHistory(next);
    writeLocalJson(histKey, next);
  };

  const removeFromHistory = async (tmdbId: number, mediaType: MediaType) => {
    const histId = `${mediaType}_${tmdbId}`;
    if (firebaseUser) {
      const uid = firebaseUser.uid;
      setHistory((prev) => {
        const next = prev.filter((h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType));
        writeLocalJson(getUserHistoryKey(uid), next);
        return next;
      });
      apiRequest(`/api/users/history/${tmdbId}?type=${mediaType}`, {
        method: 'DELETE',
      }).catch(() => null);
      try {
        await deleteDoc(doc(db, 'users', uid, 'history', histId));
      } catch (err) {
        console.error('Erro ao remover item do histórico no Firestore:', err);
      }
      return;
    }

    const histKey = getGuestHistoryKey(activeProfileId);
    const next = history.filter((h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType));
    setHistory(next);
    writeLocalJson(histKey, next);
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
        removeFromHistory,
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
