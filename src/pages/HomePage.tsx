import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Info,
  Play,
  Radio,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { extractArray, FALLBACK_ART, normalizeMediaItem } from '../lib/mediaUtils';
import { useAuth } from '../context/AuthContext';
import type { AppRoute } from '../components/Navbar';
import type { ActivePlaybackTarget, MediaItem } from '../types/framex';
import { MediaCarousel } from '../components/MediaCarousel';
import { MediaCard } from '../components/MediaCard';
import { DomainNoticeBanner } from '../components/DomainNoticeBanner';

interface HomePageProps {
  onSelectTitle: (item: MediaItem) => void;
  onPlayTarget: (target: ActivePlaybackTarget) => void;
  onNavigate: (route: AppRoute) => void;
}

export function HomePage({ onSelectTitle, onPlayTarget, onNavigate }: HomePageProps) {
  const { watchProgress } = useAuth();

  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [latestMovies, setLatestMovies] = useState<MediaItem[]>([]);
  const [upcoming, setUpcoming] = useState<MediaItem[]>([]);
  const [actionGenre, setActionGenre] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<Array<{ name: string; slug: string }>>([]);
  const [activeGenre, setActiveGenre] = useState<string>('action');
  const [heroIdx, setHeroIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tr, pm, ps, lm, up, gn] = await Promise.all([
        apiFetch('/api/fx/movies/trending?provider=v1&page=1'),
        apiFetch('/api/fx/movies/popular?provider=v1&page=1'),
        apiFetch('/api/fx/series/popular?provider=v1&page=1'),
        apiFetch('/api/fx/movies/latest?provider=v1&page=1'),
        apiFetch('/api/fx/movies/upcoming?provider=v1'),
        apiFetch('/api/fx/genres?provider=v1').catch(() => null),
      ]);

      setTrending(extractArray(tr).map((r) => normalizeMediaItem(r, 'moviebox')));
      setPopularMovies(extractArray(pm).map((r) => normalizeMediaItem(r, 'moviebox')));
      setPopularSeries(extractArray(ps).map((r) => normalizeMediaItem(r, 'moviebox')));
      setLatestMovies(extractArray(lm).map((r) => normalizeMediaItem(r, 'moviebox')));
      setUpcoming(extractArray(up).map((r) => normalizeMediaItem(r, 'moviebox')));

      const gList = extractArray(gn)
        .map((g) => ({
          name: String(g.name || g.title || g.slug || ''),
          slug: String(g.slug || g.id || g.name || '').toLowerCase(),
        }))
        .filter((g) => g.name && g.slug);
      setGenres(gList.slice(0, 10));
      if (gList[0]?.slug) {
        setActiveGenre(gList[0].slug);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (!activeGenre) return;
    let active = true;
    apiFetch(`/api/fx/genres/${encodeURIComponent(activeGenre)}?provider=v1&page=1`)
      .then((res) => {
        if (!active) return;
        setActionGenre(extractArray(res).map((r) => normalizeMediaItem(r, 'moviebox')));
      })
      .catch(() => {
        if (active) setActionGenre([]);
      });
    return () => {
      active = false;
    };
  }, [activeGenre]);

  const featuredPool = trending.slice(0, 5);
  const heroItem = featuredPool[heroIdx] || null;

  useEffect(() => {
    if (featuredPool.length <= 1) return;
    const t = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % featuredPool.length);
    }, 7500);
    return () => window.clearInterval(t);
  }, [featuredPool.length]);

  const resumeItems = watchProgress.filter(
    (w) => w.position_seconds > 5 && (!w.duration_seconds || w.position_seconds < w.duration_seconds - 15)
  );

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Cinematic Featured Hero */}
      <section className="relative rounded-3xl overflow-hidden glass-surface-elevated min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] flex items-end">
        <img
          src={heroItem?.backdrop || heroItem?.poster || FALLBACK_ART.cinemaHero}
          alt={heroItem?.title || 'LUPIN MOVIES Featured Cinema'}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080305] via-[#080305]/65 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080305]/95 via-[#18070d]/55 to-transparent" />

        <div className="relative z-10 w-full p-6 sm:p-10 lg:p-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3.5">
            <p className="text-xs sm:text-sm font-medium text-amber-200/90 tracking-wide">
              {heroItem
                ? [
                    'Featured Premiere',
                    heroItem.year ? String(heroItem.year) : null,
                    heroItem.type === 'series' ? 'TV Series' : 'Movie',
                    heroItem.rating ? `★ ${heroItem.rating}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'LUPIN MOVIES · Curated Cinema & Live Entertainment'}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-[1.08] text-balance">
              {heroItem ? heroItem.title : 'Cinema, Anime, Live Broadcasts & Stories'}
            </h1>
            <p className="text-sm sm:text-base text-rose-100/75 line-clamp-3 max-w-xl leading-relaxed">
              {heroItem?.description ||
                'Stream trending films, multi-season series, subbed and dubbed anime, live international television, football analytics, and serialized fiction from one obsidian-burgundy interface.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {heroItem ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectTitle(heroItem)}
                    className="glass-btn-primary h-11 px-6 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTitle(heroItem)}
                    className="glass-btn h-11 px-5 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Info className="w-4 h-4" />
                    <span>Details</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('discover')}
                  className="glass-btn-primary h-11 px-6 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explore Catalog</span>
                </button>
              )}
            </div>
          </div>

          {/* Hero Carousel Controls */}
          {featuredPool.length > 1 && (
            <div className="flex items-center gap-2 self-start md:self-end shrink-0">
              <button
                type="button"
                onClick={() =>
                  setHeroIdx((i) => (i - 1 + featuredPool.length) % featuredPool.length)
                }
                aria-label="Previous featured title"
                className="glass-btn w-10 h-10 rounded-xl flex items-center justify-center text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                {featuredPool.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setHeroIdx(i)}
                    aria-label={`Select featured slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === heroIdx ? 'w-7 bg-rose-500' : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setHeroIdx((i) => (i + 1) % featuredPool.length)}
                aria-label="Next featured title"
                className="glass-btn w-10 h-10 rounded-xl flex items-center justify-center text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {Boolean(error) && <DomainNoticeBanner error={error} onRetry={() => void loadHome()} />}

      {/* Continue Watching */}
      {resumeItems.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-white">
            Continue Watching
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {resumeItems.slice(0, 6).map((w) => {
              const pct =
                w.duration_seconds > 0
                  ? Math.round((w.position_seconds / w.duration_seconds) * 100)
                  : 20;
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
                  onSelect={(item) => onSelectTitle(item)}
                  onQuickPlay={() =>
                    onPlayTarget({
                      mode: w.provider === 'animex' ? 'hls' : w.provider === 'gotaku' ? 'embed' : 'direct',
                      title: w.title,
                      subtitle: w.season > 0 ? `Season ${w.season} · Episode ${w.episode}` : undefined,
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
        </section>
      )}

      {/* Primary Discovery Carousels */}
      <MediaCarousel
        title="Trending Now"
        subtitle="Most watched titles across LUPIN MOVIES"
        items={trending}
        loading={loading}
        onSelect={onSelectTitle}
        actionLabel="See all"
        onAction={() => onNavigate('discover')}
      />

      <MediaCarousel
        title="Popular Movies"
        items={popularMovies}
        loading={loading}
        onSelect={onSelectTitle}
      />

      <MediaCarousel
        title="Popular TV Series"
        items={popularSeries}
        loading={loading}
        onSelect={onSelectTitle}
      />

      {/* Quick Portals: Anime, Live & Sports, Novels */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('anime')}
          className="group relative h-44 rounded-2xl overflow-hidden glass-surface text-left p-6 flex flex-col justify-end cursor-pointer"
        >
          <img
            src={FALLBACK_ART.animeShowcase}
            alt="Anime Center"
            className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080305] via-[#080305]/60 to-transparent" />
          <div className="relative z-10 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-300">
              <Sparkles className="w-3.5 h-3.5" />
              Gotaku & AnimeX
            </span>
            <h3 className="font-display text-xl font-bold text-white">Anime Center</h3>
            <p className="text-xs text-rose-100/70">Sub, Dub & Multi-Server Playback</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('live')}
          className="group relative h-44 rounded-2xl overflow-hidden glass-surface text-left p-6 flex flex-col justify-end cursor-pointer"
        >
          <img
            src={FALLBACK_ART.sportsArena}
            alt="Live TV and Sports"
            className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080305] via-[#080305]/60 to-transparent" />
          <div className="relative z-10 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200">
              <Radio className="w-3.5 h-3.5" />
              TVGarden · GoalNivo · Wrestling
            </span>
            <h3 className="font-display text-xl font-bold text-white">Live TV & Sports</h3>
            <p className="text-xs text-rose-100/70">Global Channels, Live Matches & Replays</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('novels')}
          className="group relative h-44 rounded-2xl overflow-hidden glass-surface text-left p-6 flex flex-col justify-end cursor-pointer"
        >
          <img
            src={FALLBACK_ART.novelCover}
            alt="Novel Library"
            className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080305] via-[#080305]/60 to-transparent" />
          <div className="relative z-10 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-300">
              <BookOpen className="w-3.5 h-3.5" />
              NovelHub & NovelStore
            </span>
            <h3 className="font-display text-xl font-bold text-white">Novel Library</h3>
            <p className="text-xs text-rose-100/70">Chapters, Rankings & Reading Sync</p>
          </div>
        </button>
      </section>

      <MediaCarousel
        title="Latest Releases"
        items={latestMovies}
        loading={loading}
        onSelect={onSelectTitle}
      />

      {upcoming.length > 0 && (
        <MediaCarousel
          title="Upcoming Releases"
          items={upcoming}
          loading={loading}
          onSelect={onSelectTitle}
        />
      )}

      {/* Genre Collection Explorer */}
      {genres.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-white">
              Browse by Genre
            </h2>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {genres.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => setActiveGenre(g.slug)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    activeGenre === g.slug
                      ? 'glass-btn-primary text-white'
                      : 'glass-btn text-rose-100/75'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <MediaCarousel
            title=""
            items={actionGenre}
            loading={false}
            onSelect={onSelectTitle}
          />
        </section>
      )}
    </div>
  );
}
