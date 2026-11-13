import { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  Download,
  Heart,
  Info,
  Loader2,
  Play,
  X,
} from 'lucide-react';
import { apiFetch, buildQuery } from '../lib/api';
import { FALLBACK_ART, normalizeMediaDetail } from '../lib/mediaUtils';
import { useAuth } from '../context/AuthContext';
import type { ActivePlaybackTarget, MediaDetail, MediaItem } from '../types/framex';
import { MediaCard } from './MediaCard';

interface TitleDetailModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onPlay: (target: ActivePlaybackTarget) => void;
  onSelectRelated: (item: MediaItem) => void;
}

export function TitleDetailModal({
  item,
  onClose,
  onPlay,
  onSelectRelated,
}: TitleDetailModalProps) {
  const { isInLibrary, toggleLibraryItem, getWatchProgress } = useAuth();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [resolvedSubjectId, setResolvedSubjectId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    let active = true;
    setLoading(true);
    setActionNotice(null);
    setDetail(normalizeMediaDetail(item.raw || item, item));

    const prefixParam = item.source === 'showbox' ? 'v2' : 'v1';

    (async () => {
      try {
        const res = await apiFetch(
          `/api/fx/movies/${encodeURIComponent(item.slug)}${buildQuery({
            provider: prefixParam,
            type: item.type,
          })}`
        );
        if (!active) return;
        const norm = normalizeMediaDetail(res, item);
        setDetail(norm);

        if (norm.seasons && norm.seasons.length > 0) {
          setSelectedSeason(norm.seasons[0].season);
          setSelectedEpisode(norm.seasons[0].episodes[0]?.episode || 1);
        }

        // Resolve MovieBox numeric subjectId if needed
        if (norm.source !== 'showbox') {
          if (/^\d+$/.test(norm.subjectId || '')) {
            setResolvedSubjectId(norm.subjectId!);
          } else if (norm.detailPath || norm.slug) {
            try {
              const idRes = await apiFetch<{ subjectId?: string; id?: string }>(
                `/api/fx/ids/lookup${buildQuery({ detailPath: norm.detailPath || norm.slug })}`
              );
              if (active && (idRes?.subjectId || idRes?.id)) {
                setResolvedSubjectId(String(idRes.subjectId || idRes.id));
              }
            } catch {
              setResolvedSubjectId(norm.id);
            }
          }
        }
      } catch {
        // Retain base item info if detail fetch fails
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [item]);

  if (!item || !detail) return null;

  const isShowbox = detail.source === 'showbox';
  const playId = resolvedSubjectId || detail.subjectId || detail.id;
  const inWatchlist = isInLibrary(detail.id, 'watchlist', detail.type);
  const inFavorites = isInLibrary(detail.id, 'favorite', detail.type);

  const currentSeasonObj = detail.seasons?.find((s) => s.season === selectedSeason);
  const savedProgress = getWatchProgress(
    playId,
    detail.type === 'series' ? selectedSeason : 0,
    detail.type === 'series' ? selectedEpisode : 0
  );

  const launchPlay = async (se?: number, ep?: number) => {
    setActionNotice(null);
    if (isShowbox) {
      // Showbox does not support /v1/stream-url; check /v1/proxy/sources/{slug} honestly
      try {
        const sources = await apiFetch<{
          sources?: Array<{ url?: string; type?: string }>;
          url?: string;
        }>(
          `/api/fx/proxy/sources/${encodeURIComponent(detail.slug)}${buildQuery({
            type: detail.type,
            imdb: detail.imdbId || undefined,
            season: se,
            episode: ep,
          })}`
        );
        const firstUrl = sources?.url || sources?.sources?.[0]?.url;
        if (!firstUrl) {
          setActionNotice(
            'This Showbox discovery title does not currently have a playable proxy stream source.'
          );
          return;
        }
        onPlay({
          mode: firstUrl.includes('.m3u8') ? 'hls' : 'direct',
          title: detail.title,
          subtitle: se && ep ? `Season ${se} · Episode ${ep}` : undefined,
          poster: detail.poster,
          provider: 'proxy',
          contentId: playId,
          slug: detail.slug,
          mediaType: detail.type === 'series' ? 'series' : 'movie',
          season: se,
          episode: ep,
          initialUrl: firstUrl,
        });
      } catch {
        setActionNotice(
          'Playback routes support MovieBox titles directly; no active proxy stream was found for this Showbox title.'
        );
      }
      return;
    }

    const totalEps = currentSeasonObj?.episodes.length || 0;
    const hasNext = Boolean(detail.type === 'series' && ep && totalEps > ep);

    onPlay({
      mode: 'direct',
      title: detail.title,
      subtitle: se && ep ? `Season ${se} · Episode ${ep}` : detail.year ? String(detail.year) : undefined,
      poster: detail.poster,
      provider: 'moviebox',
      contentId: playId,
      slug: detail.slug,
      detailPath: detail.detailPath || detail.slug,
      mediaType: detail.type === 'series' ? 'series' : 'movie',
      season: se,
      episode: ep,
      hasNextEpisode: hasNext,
      onNextEpisode: hasNext ? () => launchPlay(se, (ep || 1) + 1) : undefined,
    });
  };

  const handleDownload = async () => {
    if (isShowbox) {
      setActionNotice('Direct downloads are available for MovieBox titles.');
      return;
    }
    try {
      const res = await apiFetch<{ url?: string }>(
        `/api/fx/stream-url${buildQuery({
          subjectId: playId,
          resolution: '1080',
          se: detail.type === 'series' ? selectedSeason : undefined,
          ep: detail.type === 'series' ? selectedEpisode : undefined,
          download: 1,
        })}`
      );
      if (res?.url) {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = `${detail.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Download unavailable.');
    }
  };

  const metaLine = [
    detail.year ? String(detail.year) : null,
    detail.type === 'series' ? 'TV Series' : 'Feature Film',
    detail.duration ? String(detail.duration) : null,
    detail.rating ? `★ ${detail.rating}` : null,
    detail.source === 'showbox' ? 'Showbox' : 'MovieBox',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={detail.title}
    >
      <div className="glass-surface-elevated w-full max-w-5xl rounded-3xl overflow-hidden my-auto relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="glass-btn absolute top-4 right-4 z-20 w-11 h-11 rounded-xl flex items-center justify-center text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cinematic Backdrop */}
        <div className="relative h-56 sm:h-80 w-full overflow-hidden bg-[#16060b]">
          <img
            src={detail.backdrop || detail.poster || FALLBACK_ART.cinemaHero}
            alt={detail.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12060a] via-[#12060a]/55 to-transparent" />
        </div>

        {/* Main Content */}
        <div className="px-5 sm:px-8 pb-8 -mt-24 sm:-mt-32 relative z-10 space-y-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <img
              src={detail.poster || FALLBACK_ART.cinemaHero}
              alt={detail.title}
              referrerPolicy="no-referrer"
              className="w-32 sm:w-44 aspect-[2/3] object-cover rounded-2xl border border-rose-200/15 shadow-2xl shrink-0 bg-[#1a080e]"
            />

            <div className="flex-1 min-w-0 space-y-4 pt-2 sm:pt-12">
              <div>
                <p className="text-xs sm:text-sm text-rose-200/75 mb-1.5">{metaLine}</p>
                <h2 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
                  {detail.title}
                </h2>
                {detail.genres.length > 0 && (
                  <p className="text-xs sm:text-sm text-rose-100/60 mt-1.5">
                    {detail.genres.join(' · ')}
                  </p>
                )}
              </div>

              {detail.description && (
                <p className="text-sm sm:text-base text-rose-50/80 leading-relaxed max-w-2xl">
                  {detail.description}
                </p>
              )}

              {/* Action Bar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    void launchPlay(
                      detail.type === 'series' ? selectedSeason : undefined,
                      detail.type === 'series' ? selectedEpisode : undefined
                    )
                  }
                  className="glass-btn-primary h-11 px-6 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {savedProgress && savedProgress.position_seconds > 10
                      ? 'Resume Playback'
                      : detail.type === 'series'
                        ? `Play S${selectedSeason} E${selectedEpisode}`
                        : 'Play Now'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void toggleLibraryItem({
                      list_type: 'watchlist',
                      media_type: detail.type,
                      item_id: detail.id,
                      slug: detail.slug,
                      provider: detail.source,
                      title: detail.title,
                      poster: detail.poster || null,
                      year: detail.year ? String(detail.year) : null,
                    })
                  }
                  className={`glass-btn h-11 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    inWatchlist ? 'text-amber-300 border-amber-300/35' : 'text-white'
                  }`}
                >
                  {inWatchlist ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void toggleLibraryItem({
                      list_type: 'favorite',
                      media_type: detail.type,
                      item_id: detail.id,
                      slug: detail.slug,
                      provider: detail.source,
                      title: detail.title,
                      poster: detail.poster || null,
                      year: detail.year ? String(detail.year) : null,
                    })
                  }
                  aria-label="Favorite"
                  className={`glass-btn h-11 w-11 rounded-xl flex items-center justify-center cursor-pointer ${
                    inFavorites ? 'text-rose-400 border-rose-400/40' : 'text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${inFavorites ? 'fill-current' : ''}`} />
                </button>

                {!isShowbox && (
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    aria-label="Download title"
                    className="glass-btn h-11 px-4 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                )}

                {loading && <Loader2 className="w-4 h-4 animate-spin text-rose-300 ml-1" />}
              </div>

              {actionNotice && (
                <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/40 border border-amber-400/25 rounded-xl px-3.5 py-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionNotice}</span>
                </div>
              )}
            </div>
          </div>

          {/* Series Seasons & Episodes */}
          {detail.type === 'series' && detail.seasons && detail.seasons.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-rose-200/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-white">Episodes</h3>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {detail.seasons.map((s) => (
                    <button
                      key={s.season}
                      type="button"
                      onClick={() => {
                        setSelectedSeason(s.season);
                        setSelectedEpisode(s.episodes[0]?.episode || 1);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        selectedSeason === s.season
                          ? 'glass-btn-primary text-white'
                          : 'glass-btn text-rose-100/75'
                      }`}
                    >
                      Season {s.season}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {(currentSeasonObj?.episodes || []).map((ep) => {
                  const isSelected = ep.episode === selectedEpisode;
                  return (
                    <button
                      key={`${selectedSeason}-${ep.episode}`}
                      type="button"
                      onClick={() => {
                        setSelectedEpisode(ep.episode);
                        void launchPlay(selectedSeason, ep.episode);
                      }}
                      className={`text-left p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-rose-800/35 border-rose-400/40 text-white'
                          : 'glass-surface border-rose-200/10 text-rose-100/80 hover:border-rose-300/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-rose-300 block">
                          Episode {ep.episode}
                        </span>
                        <span className="text-sm font-medium text-white truncate block">
                          {ep.title || `Episode ${ep.episode}`}
                        </span>
                      </div>
                      <Play className="w-4 h-4 shrink-0 text-rose-300" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Cast */}
          {detail.cast && detail.cast.length > 0 && (
            <section className="space-y-3 pt-4 border-t border-rose-200/10">
              <h3 className="font-display text-lg font-semibold text-white">Cast</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {detail.cast.slice(0, 12).map((member, idx) => (
                  <div
                    key={`${member.name}-${idx}`}
                    className="glass-surface rounded-xl p-2.5 flex items-center gap-2.5"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-rose-950/60 shrink-0 flex items-center justify-center text-xs font-semibold text-rose-200">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        member.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{member.name}</p>
                      {member.role && (
                        <p className="text-[11px] text-rose-100/55 truncate">{member.role}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Content */}
          {detail.related && detail.related.length > 0 && (
            <section className="space-y-3 pt-4 border-t border-rose-200/10">
              <h3 className="font-display text-lg font-semibold text-white">Related Titles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {detail.related.slice(0, 5).map((rel) => (
                  <MediaCard
                    key={`${rel.id}-${rel.slug}`}
                    item={rel}
                    onSelect={onSelectRelated}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
