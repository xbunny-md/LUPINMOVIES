import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '../types/framex';
import { MediaCard } from './MediaCard';

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  loading?: boolean;
  onSelect: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function MediaCarousel({
  title,
  subtitle,
  items,
  loading = false,
  onSelect,
  onQuickPlay,
  actionLabel,
  onAction,
}: MediaCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.78, behavior: 'smooth' });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="space-y-3.5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-white truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-rose-100/60 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="text-xs sm:text-sm font-medium text-rose-300 hover:text-white transition-colors px-2 py-1 whitespace-nowrap cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} left`}
              className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-rose-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} right`}
              className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-rose-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory"
      >
        {loading
          ? Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className="w-[148px] sm:w-[172px] lg:w-[188px] shrink-0 snap-start glass-surface rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-[2/3] bg-rose-950/40" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 bg-rose-900/40 rounded w-4/5" />
                  <div className="h-3 bg-rose-900/30 rounded w-1/2" />
                </div>
              </div>
            ))
          : items.map((item) => (
              <div
                key={`${item.source}-${item.id}-${item.slug}`}
                className="w-[148px] sm:w-[172px] lg:w-[188px] shrink-0 snap-start"
              >
                <MediaCard item={item} onSelect={onSelect} onQuickPlay={onQuickPlay} />
              </div>
            ))}
      </div>
    </section>
  );
}
