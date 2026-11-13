import { useState } from 'react';
import { Bookmark, Clock, Heart, LogIn, LogOut, Save, Settings, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ActivePlaybackTarget, MediaItem } from '../types/framex';
import { MediaCard } from '../components/MediaCard';

interface LibraryPageProps {
  onSelectTitle: (item: MediaItem) => void;
  onPlayTarget: (target: ActivePlaybackTarget) => void;
}

export function LibraryPage({ onSelectTitle, onPlayTarget }: LibraryPageProps) {
  const {
    user,
    library,
    watchProgress,
    readingProgress,
    setAuthModalOpen,
    logout,
    updateProfile,
  } = useAuth();

  const [tab, setTab] = useState<'watchlist' | 'favorites' | 'history' | 'reading' | 'settings'>('watchlist');
  const [quality, setQuality] = useState(user?.preferred_quality || '1080');
  const [subLang, setSubLang] = useState(user?.preferred_subtitle_lang || 'en');
  const [audioLang, setAudioLang] = useState(user?.preferred_audio_lang || 'en');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const watchlistItems = library.filter((x) => x.list_type === 'watchlist');
  const favoriteMovies = library.filter((x) => x.list_type === 'favorite' && x.media_type !== 'series');
  const favoriteSeries = library.filter((x) => x.list_type === 'favorite' && x.media_type === 'series');

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    await updateProfile({
      name: displayName || user?.name,
      preferred_quality: quality,
      preferred_subtitle_lang: subLang,
      preferred_audio_lang: audioLang,
    });
    setSavedMsg('Preferences saved to your account.');
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <section className="glass-surface-elevated rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            {user ? `${user.name}'s Personal Library` : 'Personal Library'}
          </h1>
          <p className="text-sm text-rose-100/70">
            {user
              ? `${user.email} · Synced across sessions`
              : 'Viewing local guest library. Sign in to persist across devices.'}
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="glass-btn h-11 px-4 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 self-start cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="glass-btn-primary h-11 px-5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 self-start cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Register</span>
          </button>
        )}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'watchlist', label: `Watchlist (${watchlistItems.length})`, icon: Bookmark },
          { id: 'favorites', label: `Favorites (${favoriteMovies.length + favoriteSeries.length})`, icon: Heart },
          { id: 'history', label: `Watch History (${watchProgress.length})`, icon: Clock },
          { id: 'reading', label: `Reading (${readingProgress.length})`, icon: BookOpen },
          { id: 'settings', label: 'Preferences', icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                tab === t.id ? 'glass-btn-primary text-white' : 'glass-btn text-rose-100/75'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'watchlist' && (
        watchlistItems.length === 0 ? (
          <div className="glass-surface rounded-3xl p-12 text-center text-sm text-rose-100/60">
            Your watchlist is empty. Click the bookmark button on any movie or series to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {watchlistItems.map((item) => (
              <MediaCard
                key={`${item.item_id}-${item.media_type}`}
                item={{
                  id: item.item_id,
                  subjectId: item.item_id,
                  slug: item.slug,
                  title: item.title,
                  poster: item.poster,
                  year: item.year,
                  type: item.media_type === 'series' ? 'series' : 'movie',
                  source: item.provider,
                  genres: [],
                }}
                onSelect={onSelectTitle}
              />
            ))}
          </div>
        )
      )}

      {tab === 'favorites' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-white">Favorite Movies</h2>
            {favoriteMovies.length === 0 ? (
              <p className="text-sm text-rose-100/60">No favorite movies added yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {favoriteMovies.map((item) => (
                  <MediaCard
                    key={`${item.item_id}-${item.media_type}`}
                    item={{
                      id: item.item_id,
                      subjectId: item.item_id,
                      slug: item.slug,
                      title: item.title,
                      poster: item.poster,
                      year: item.year,
                      type: 'movie',
                      source: item.provider,
                      genres: [],
                    }}
                    onSelect={onSelectTitle}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-white">Favorite Series</h2>
            {favoriteSeries.length === 0 ? (
              <p className="text-sm text-rose-100/60">No favorite series added yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {favoriteSeries.map((item) => (
                  <MediaCard
                    key={`${item.item_id}-${item.media_type}`}
                    item={{
                      id: item.item_id,
                      subjectId: item.item_id,
                      slug: item.slug,
                      title: item.title,
                      poster: item.poster,
                      year: item.year,
                      type: 'series',
                      source: item.provider,
                      genres: [],
                    }}
                    onSelect={onSelectTitle}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'history' && (
        watchProgress.length === 0 ? (
          <div className="glass-surface rounded-3xl p-12 text-center text-sm text-rose-100/60">
            No watch history recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {watchProgress.map((w) => {
              const pct =
                w.duration_seconds > 0
                  ? Math.round((w.position_seconds / w.duration_seconds) * 100)
                  : 0;
              return (
                <MediaCard
                  key={`${w.content_id}-${w.season}-${w.episode}`}
                  item={{
                    id: w.content_id,
                    subjectId: w.content_id,
                    slug: w.slug,
                    title: w.title,
                    poster: w.poster,
                    type: w.media_type === 'series' ? 'series' : 'movie',
                    source: w.provider,
                    genres: [],
                  }}
                  progressPercent={pct}
                  subtitleOverride={
                    w.season > 0 ? `S${w.season} E${w.episode} · ${pct}%` : `${pct}% watched`
                  }
                  onSelect={onSelectTitle}
                  onQuickPlay={() =>
                    onPlayTarget({
                      mode: w.provider === 'animex' ? 'hls' : w.provider === 'gotaku' ? 'embed' : 'direct',
                      title: w.title,
                      poster: w.poster,
                      provider: w.provider as ActivePlaybackTarget['provider'],
                      contentId: w.content_id,
                      slug: w.slug,
                      mediaType: w.media_type as ActivePlaybackTarget['mediaType'],
                      season: w.season || undefined,
                      episode: w.episode || undefined,
                    })
                  }
                />
              );
            })}
          </div>
        )
      )}

      {tab === 'reading' && (
        readingProgress.length === 0 ? (
          <div className="glass-surface rounded-3xl p-12 text-center text-sm text-rose-100/60">
            No novel reading history yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {readingProgress.map((r) => (
              <div key={r.novel_id} className="glass-surface rounded-2xl p-4 space-y-1">
                <h3 className="font-display text-sm font-semibold text-white truncate">
                  {r.novel_title}
                </h3>
                <p className="text-xs text-rose-200/70 truncate">{r.chapter_title}</p>
                <p className="font-mono text-[11px] text-rose-100/55">
                  Progress: {Math.round(r.progress_percent)}%
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'settings' && (
        <section className="glass-surface rounded-3xl p-6 max-w-xl space-y-5">
          <h2 className="font-display text-xl font-semibold text-white">
            Playback & Account Preferences
          </h2>
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-rose-100/70">
                Sign in or create an account to save your default resolution, subtitle language, and audio preferences.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="glass-btn-primary h-10 px-5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              >
                Sign In / Create Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleSavePrefs} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-rose-100/80 block">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-black/45 border border-rose-200/15 text-sm text-white"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-rose-100/80 block">Quality</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-black/45 border border-rose-200/15 text-sm text-white"
                  >
                    <option value="1080" className="bg-[#14060b]">1080p HD</option>
                    <option value="720" className="bg-[#14060b]">720p HD</option>
                    <option value="480" className="bg-[#14060b]">480p SD</option>
                    <option value="360" className="bg-[#14060b]">360p</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-rose-100/80 block">Subtitles</label>
                  <input
                    type="text"
                    value={subLang}
                    onChange={(e) => setSubLang(e.target.value)}
                    placeholder="en"
                    className="w-full h-11 px-3 rounded-xl bg-black/45 border border-rose-200/15 text-sm text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-rose-100/80 block">Audio</label>
                  <input
                    type="text"
                    value={audioLang}
                    onChange={(e) => setAudioLang(e.target.value)}
                    placeholder="en"
                    className="w-full h-11 px-3 rounded-xl bg-black/45 border border-rose-200/15 text-sm text-white"
                  />
                </div>
              </div>

              {savedMsg && <p className="text-xs text-emerald-300">{savedMsg}</p>}

              <button
                type="submit"
                className="glass-btn-primary h-11 px-5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
