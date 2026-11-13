import { useState } from 'react';
import { Bookmark, Check, Film, Play } from 'lucide-react';
import type { MediaItem } from '../types/framex';
import { useAuth } from '../context/AuthContext';

interface MediaCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
  progressPercent?: number;
  subtitleOverride?: string;
}

export function MediaCard({
  item,
  onSelect,
  onQuickPlay,
  progressPercent,
  subtitleOverride,
}: MediaCardProps) {
  const { isInLibrary, toggleLibraryItem } = useAuth();
  const [imgError, setImgError] = useState(false);

  const saved = isInLibrary(item.id, 'watchlist', item.type);

  const handleToggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLibraryItem({
      list_type: 'watchlist',
      media_type: item.type || 'movie',
      item_id: item.id,
      slug: item.slug,
      provider: item.source || 'moviebox',
      title: item.title,
      poster: item.poster || null,
      year: item.year ? String(item.year) : null,
    });
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(item);
    } else {
      onSelect(item);
    }
  };

  const metaParts: string[] = [];
  if (item.year) metaParts.push(String(item.year));
  if (item.type) metaParts.push(item.type === 'series' ? 'Series' : 'Movie');
  if (item.rating) metaParts.push(`★ ${item.rating}`);
  else if (item.source) metaParts.push(item.source === 'showbox' ? 'Showbox' : 'MovieBox');

  return (
    <article
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${item.title}`}
      className="group relative flex flex-col glass-surface rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#17080d]">
        {item.poster && !imgError ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#2d0c18] via-[#18070d] to-[#0c0407]">
            <Film className="w-8 h-8 text-rose-300/40 mb-2" />
            <span className="font-display text-xs font-medium text-rose-100/70 line-clamp-3">
              {item.title}
            </span>
          </div>
        )}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080305] via-transparent to-black/20 opacity-80 group-hover:opacity-95 transition-opacity" />

        {/* Hover Actions */}
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handlePlay}
            aria-label={`Play ${item.title}`}
            className="glass-btn-primary h-9 px-3 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </button>
          <button
            type="button"
            onClick={handleToggleWatchlist}
            aria-label={saved ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`}
            className={`h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
              saved
                ? 'bg-rose-600 text-white border border-rose-300/30'
                : 'glass-btn text-white'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>

        {/* Continue Watching Progress Bar */}
        {typeof progressPercent === 'number' && progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-300"
              style={{ width: `${Math.min(100, Math.max(4, progressPercent))}%` }}
            />
          </div>
        )}
      </div>

      {/* Zero-Pill Clean Typography Details */}
      <div className="p-3 flex flex-col gap-1">
        <h3 className="font-display text-sm font-semibold text-white truncate">
          {item.title}
        </h3>
        <p className="text-xs text-rose-100/60 truncate">
          {subtitleOverride || metaParts.join(' · ') || 'Streaming'}
        </p>
      </div>
    </article>
  );
}
