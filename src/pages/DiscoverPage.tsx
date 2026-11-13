import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { apiFetch, buildQuery } from '../lib/api';
import { extractArray, normalizeMediaItem } from '../lib/mediaUtils';
import type { MediaItem, SearchV2Metadata } from '../types/framex';
import { MediaCard } from '../components/MediaCard';
import { DomainNoticeBanner } from '../components/DomainNoticeBanner';

interface DiscoverPageProps {
  onSelectTitle: (item: MediaItem) => void;
}

type CatalogTab = 'trending' | 'popular_movies' | 'popular_series' | 'latest_movies' | 'latest_series' | 'upcoming';

const CATALOG_TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular_movies', label: 'Popular Movies' },
  { id: 'popular_series', label: 'Popular Series' },
  { id: 'latest_movies', label: 'Latest Movies' },
  { id: 'latest_series', label: 'Latest Series' },
  { id: 'upcoming', label: 'Upcoming' },
];

export function DiscoverPage({ onSelectTitle }: DiscoverPageProps) {
  const [provider, setProvider] = useState<'v1' | 'v2'>('v1');
  const [activeTab, setActiveTab] = useState<CatalogTab>('trending');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchMeta, setSearchMeta] = useState<SearchV2Metadata | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [genres, setGenres] = useState<Array<{ name: string; slug: string }>>([]);
  const [categories, setCategories] = useState<Array<{ name: string; slug: string }>>([]);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]);

  // Load categories & genres for active provider
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`/api/fx/genres${buildQuery({ provider })}`).catch(() => null),
      apiFetch(`/api/fx/categories${buildQuery({ provider })}`).catch(() => null),
    ]).then(([gRes, cRes]) => {
      if (!active) return;
      setGenres(
        extractArray(gRes)
          .map((g) => ({
            name: String(g.name || g.title || g.slug || ''),
            slug: String(g.slug || g.id || g.name || ''),
          }))
          .filter((x) => x.name && x.slug)
      );
      setCategories(
        extractArray(cRes)
          .map((c) => ({
            name: String(c.name || c.title || c.slug || ''),
            slug: String(c.slug || c.id || c.name || ''),
          }))
          .filter((x) => x.name && x.slug)
      );
    });
    return () => {
      active = false;
    };
  }, [provider]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearchMeta(null);

    try {
      const defaultSource = provider === 'v2' ? 'showbox' : 'moviebox';
      let url = '';

      if (debouncedQuery) {
        url = `/api/fx/search${buildQuery({
          q: debouncedQuery,
          page,
          mode: 'v2',
        })}`;
      } else if (selectedGenre) {
        url = `/api/fx/genres/${encodeURIComponent(selectedGenre)}${buildQuery({
          provider,
          page,
        })}`;
      } else if (selectedCategory) {
        url = `/api/fx/categories/${encodeURIComponent(selectedCategory)}${buildQuery({
          provider,
          page,
        })}`;
      } else {
        switch (activeTab) {
          case 'trending':
            url = `/api/fx/movies/trending${buildQuery({ provider, page })}`;
            break;
          case 'popular_movies':
            url = `/api/fx/movies/popular${buildQuery({ provider, page })}`;
            break;
          case 'popular_series':
            url = `/api/fx/series/popular${buildQuery({ provider, page })}`;
            break;
          case 'latest_movies':
            url = `/api/fx/movies/latest${buildQuery({ provider, page })}`;
            break;
          case 'latest_series':
            url = `/api/fx/series/latest${buildQuery({ provider, page })}`;
            break;
          case 'upcoming':
            url = `/api/fx/movies/upcoming${buildQuery({ provider })}`;
            break;
        }
      }

      const res = await apiFetch<Record<string, unknown>>(url);
      if (debouncedQuery) {
        setSearchMeta({
          schemaVersion: res.schemaVersion as string | undefined,
          source: res.source as string | undefined,
          fallback: res.fallback as boolean | undefined,
          fallbackReason: res.fallbackReason as string | undefined,
        });
      }

      const list = extractArray(res).map((r) => normalizeMediaItem(r, defaultSource));
      setItems(list);
    } catch (err) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedGenre, selectedCategory, activeTab, provider, page]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  return (
    <div className="space-y-6">
      {/* Header & Search Toolbar */}
      <div className="glass-surface rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Discover Cinema & Series
            </h1>
            <p className="text-sm text-rose-100/65 mt-0.5">
              Provider-aware search and browse across MovieBox and Showbox catalogs.
            </p>
          </div>

          {/* Provider Switch */}
          <div className="inline-flex p-1 rounded-xl bg-black/40 border border-rose-200/10 self-start">
            <button
              type="button"
              onClick={() => {
                setProvider('v1');
                setSelectedGenre('');
                setSelectedCategory('');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                provider === 'v1' ? 'glass-btn-primary text-white' : 'text-rose-100/70 hover:text-white'
              }`}
            >
              MovieBox (v1)
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('v2');
                setSelectedGenre('');
                setSelectedCategory('');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                provider === 'v2' ? 'glass-btn-primary text-white' : 'text-rose-100/70 hover:text-white'
              }`}
            >
              Showbox (v2)
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-rose-200/60 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, series, or titles (e.g. Inception, Dune, Breaking Bad)…"
            className="w-full h-12 pl-11 pr-11 rounded-2xl bg-black/45 border border-rose-200/15 text-sm text-white placeholder:text-rose-100/40 focus:outline-none focus:border-rose-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-rose-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Catalog Tabs + Filters */}
        {!debouncedQuery && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {CATALOG_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedGenre('');
                    setSelectedCategory('');
                    setPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    !selectedGenre && !selectedCategory && activeTab === tab.id
                      ? 'glass-btn-primary text-white'
                      : 'glass-btn text-rose-100/75'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {(genres.length > 0 || categories.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {genres.length > 0 && (
                  <select
                    aria-label="Filter by genre"
                    value={selectedGenre}
                    onChange={(e) => {
                      setSelectedGenre(e.target.value);
                      setSelectedCategory('');
                      setPage(1);
                    }}
                    className="h-10 px-3 rounded-xl bg-black/45 border border-rose-200/15 text-xs text-rose-50 focus:outline-none focus:border-rose-400"
                  >
                    <option value="">All Genres</option>
                    {genres.map((g) => (
                      <option key={g.slug} value={g.slug} className="bg-[#14060b]">
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}

                {categories.length > 0 && (
                  <select
                    aria-label="Filter by category"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedGenre('');
                      setPage(1);
                    }}
                    className="h-10 px-3 rounded-xl bg-black/45 border border-rose-200/15 text-xs text-rose-50 focus:outline-none focus:border-rose-400"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug} className="bg-[#14060b]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {debouncedQuery && searchMeta && (
          <p className="text-xs text-rose-100/70">
            Showing results for <strong className="text-white">{debouncedQuery}</strong>
            {searchMeta.source ? ` · Source: ${searchMeta.source}` : ''}
            {searchMeta.fallback ? ' · Showbox fallback active' : ''}
          </p>
        )}
      </div>

      {Boolean(error) && <DomainNoticeBanner error={error} onRetry={() => void fetchCatalog()} />}

      {/* Grid Results */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-surface rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[2/3] bg-rose-950/40" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-rose-900/40 rounded w-4/5" />
                <div className="h-3 bg-rose-900/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="glass-surface rounded-3xl p-12 text-center space-y-2">
          <p className="font-display text-lg font-semibold text-white">No titles found</p>
          <p className="text-sm text-rose-100/60">
            Try adjusting your search query, switching providers, or clearing filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <MediaCard
              key={`${item.source}-${item.id}-${item.slug}`}
              item={item}
              onSelect={onSelectTitle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {activeTab !== 'upcoming' && items.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="glass-btn h-10 px-4 rounded-xl text-xs font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <span className="font-mono text-xs text-rose-100/75 px-3">Page {page}</span>
          <button
            type="button"
            disabled={loading || items.length < 10}
            onClick={() => setPage((p) => p + 1)}
            className="glass-btn h-10 px-4 rounded-xl text-xs font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
