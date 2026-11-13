import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
} from 'firebase/firestore';
import type {
  FavoriteItem,
  HistoryItem,
  MediaItem,
  MediaType,
  MegaEmbedPlayer,
  ThemeId,
  UserProfile,
} from '../../shared/types';
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

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  favorites: FavoriteItem[];
  history: HistoryItem[];
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isFavorite: (tmdbId: number, mediaType: MediaType) => boolean;
  toggleFavorite: (item: Pick<MediaItem, 'tmdbId' | 'mediaType' | 'title' | 'posterPath' | 'voteAverage' | 'releaseYear'>) => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    readLocalJson<FavoriteItem[]>(LOCAL_FAVS_KEY, [])
  );
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    readLocalJson<HistoryItem[]>(LOCAL_HISTORY_KEY, [])
  );
  const { setTheme } = useTheme();

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

        // Load favorites & history from backend + Firestore
        const [favRes, histRes] = await Promise.all([
          apiRequest<{ items: FavoriteItem[] }>('/api/users/favorites'),
          apiRequest<{ items: HistoryItem[] }>('/api/users/history'),
        ]);

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
        await syncUserFromServerAndFirestore(user);
      } else {
        setProfile(null);
        setFavorites(readLocalJson<FavoriteItem[]>(LOCAL_FAVS_KEY, []));
        setHistory(readLocalJson<HistoryItem[]>(LOCAL_HISTORY_KEY, []));
      }
      setLoading(false);
    });
    return () => unsub();
  }, [syncUserFromServerAndFirestore]);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserFromServerAndFirestore(cred.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await syncUserFromServerAndFirestore(cred.user);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await syncUserFromServerAndFirestore(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
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

    // Guest local persistence
    if (exists) {
      const next = favorites.filter(
        (f) => !(f.tmdbId === item.tmdbId && f.mediaType === item.mediaType)
      );
      setFavorites(next);
      localStorage.setItem(LOCAL_FAVS_KEY, JSON.stringify(next));
    } else {
      const nextItem: FavoriteItem = {
        id: favId,
        userId: 'guest',
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
      localStorage.setItem(LOCAL_FAVS_KEY, JSON.stringify(next));
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

    const entry: HistoryItem = {
      id: histId,
      userId: 'guest',
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
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
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

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        favorites,
        history,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
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
