import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type {
  LibraryEntry,
  ReadingProgressEntry,
  UserProfile,
  WatchProgressEntry,
} from '../types/framex';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  library: LibraryEntry[];
  watchProgress: WatchProgressEntry[];
  readingProgress: ReadingProgressEntry[];
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  toggleLibraryItem: (entry: Omit<LibraryEntry, 'id' | 'created_at'>) => Promise<boolean>;
  isInLibrary: (itemId: string, listType: 'watchlist' | 'favorite', mediaType?: string) => boolean;
  saveWatchProgress: (entry: Omit<WatchProgressEntry, 'updated_at'>) => Promise<void>;
  getWatchProgress: (contentId: string, season?: number, episode?: number) => WatchProgressEntry | undefined;
  saveReadingProgress: (entry: Omit<ReadingProgressEntry, 'updated_at'>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_LIB_KEY = 'lupin_guest_library_v1';
const GUEST_WATCH_KEY = 'lupin_guest_watch_v1';
const GUEST_READ_KEY = 'lupin_guest_read_v1';

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => readLocal(GUEST_LIB_KEY, []));
  const [watchProgress, setWatchProgress] = useState<WatchProgressEntry[]>(() =>
    readLocal(GUEST_WATCH_KEY, [])
  );
  const [readingProgress, setReadingProgress] = useState<ReadingProgressEntry[]>(() =>
    readLocal(GUEST_READ_KEY, [])
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      const data = await apiFetch<{
        items: LibraryEntry[];
        progress: WatchProgressEntry[];
        reading: ReadingProgressEntry[];
      }>('/api/local/library');
      setLibrary(data.items || []);
      setWatchProgress(data.progress || []);
      setReadingProgress(data.reading || []);
    } catch {
      // Keep local state if offline
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{ user: UserProfile | null }>('/api/local/auth/me');
        if (!active) return;
        setUser(res.user);
        if (res.user) {
          await loadLibrary();
        }
      } catch {
        // Guest mode fallback
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadLibrary]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ user: UserProfile }>('/api/local/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(res.user);
      await loadLibrary();
      setAuthModalOpen(false);
    },
    [loadLibrary]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await apiFetch<{ user: UserProfile }>('/api/local/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      setUser(res.user);
      await loadLibrary();
      setAuthModalOpen(false);
    },
    [loadLibrary]
  );

  const logout = useCallback(async () => {
    await apiFetch('/api/local/auth/logout', { method: 'POST' });
    setUser(null);
    setLibrary(readLocal(GUEST_LIB_KEY, []));
    setWatchProgress(readLocal(GUEST_WATCH_KEY, []));
    setReadingProgress(readLocal(GUEST_READ_KEY, []));
  }, []);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const res = await apiFetch<{ user: UserProfile }>('/api/local/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setUser(res.user);
  }, []);

  const isInLibrary = useCallback(
    (itemId: string, listType: 'watchlist' | 'favorite', mediaType?: string) =>
      library.some(
        (x) =>
          x.item_id === itemId &&
          x.list_type === listType &&
          (!mediaType || x.media_type === mediaType)
      ),
    [library]
  );

  const toggleLibraryItem = useCallback(
    async (entry: Omit<LibraryEntry, 'id' | 'created_at'>): Promise<boolean> => {
      if (user) {
        const res = await apiFetch<{ active: boolean }>('/api/local/library/toggle', {
          method: 'POST',
          body: JSON.stringify(entry),
        });
        await loadLibrary();
        return res.active;
      }

      // Guest localStorage persistence
      let active = false;
      setLibrary((prev) => {
        const exists = prev.some(
          (x) =>
            x.item_id === entry.item_id &&
            x.list_type === entry.list_type &&
            x.media_type === entry.media_type
        );
        const next = exists
          ? prev.filter(
              (x) =>
                !(
                  x.item_id === entry.item_id &&
                  x.list_type === entry.list_type &&
                  x.media_type === entry.media_type
                )
            )
          : [{ ...entry, created_at: new Date().toISOString() }, ...prev];
        active = !exists;
        try {
          localStorage.setItem(GUEST_LIB_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      return active;
    },
    [user, loadLibrary]
  );

  const saveWatchProgress = useCallback(
    async (entry: Omit<WatchProgressEntry, 'updated_at'>) => {
      const now = new Date().toISOString();
      setWatchProgress((prev) => {
        const filtered = prev.filter(
          (p) =>
            !(
              p.content_id === entry.content_id &&
              p.media_type === entry.media_type &&
              p.season === entry.season &&
              p.episode === entry.episode
            )
        );
        const next = [{ ...entry, updated_at: now }, ...filtered].slice(0, 40);
        if (!user) {
          try {
            localStorage.setItem(GUEST_WATCH_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return next;
      });

      if (user) {
        try {
          await apiFetch('/api/local/progress/watch', {
            method: 'POST',
            body: JSON.stringify(entry),
          });
        } catch {
          // ignore silent background save errors
        }
      }
    },
    [user]
  );

  const getWatchProgress = useCallback(
    (contentId: string, season = 0, episode = 0) =>
      watchProgress.find(
        (p) => p.content_id === contentId && p.season === season && p.episode === episode
      ),
    [watchProgress]
  );

  const saveReadingProgress = useCallback(
    async (entry: Omit<ReadingProgressEntry, 'updated_at'>) => {
      const now = new Date().toISOString();
      setReadingProgress((prev) => {
        const filtered = prev.filter((r) => r.novel_id !== entry.novel_id);
        const next = [{ ...entry, updated_at: now }, ...filtered].slice(0, 30);
        if (!user) {
          try {
            localStorage.setItem(GUEST_READ_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return next;
      });

      if (user) {
        try {
          await apiFetch('/api/local/progress/reading', {
            method: 'POST',
            body: JSON.stringify(entry),
          });
        } catch {
          // ignore
        }
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        library,
        watchProgress,
        readingProgress,
        authModalOpen,
        setAuthModalOpen,
        login,
        register,
        logout,
        updateProfile,
        toggleLibraryItem,
        isInLibrary,
        saveWatchProgress,
        getWatchProgress,
        saveReadingProgress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
