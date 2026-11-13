import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import { apiFetch, buildQuery } from '../lib/api';
import { extractArray, FALLBACK_ART } from '../lib/mediaUtils';
import { useAuth } from '../context/AuthContext';
import { DomainNoticeBanner } from '../components/DomainNoticeBanner';

interface NovelItem {
  id: string;
  title: string;
  author?: string;
  cover?: string | null;
  description?: string;
  category?: string;
}

interface ChapterItem {
  id: string;
  title: string;
  order?: number;
}

export function NovelsPage() {
  const { saveReadingProgress, readingProgress } = useAuth();

  const [section, setSection] = useState<'home' | 'recommendations' | 'ranks' | 'latest' | 'completed'>('home');
  const [query, setQuery] = useState('');
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [selectedNovel, setSelectedNovel] = useState<NovelItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chapterPage, setChapterPage] = useState(1);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [activeChapter, setActiveChapter] = useState<{
    id: string;
    title: string;
    content: string;
  } | null>(null);
  const [loadingChapterText, setLoadingChapterText] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const normalizeNovels = (payload: unknown): NovelItem[] =>
    extractArray(payload)
      .map((n) => ({
        id: String(n.contentId || n.novelId || n.id || ''),
        title: String(n.title || n.name || n.bookName || 'Untitled Novel'),
        author: n.author ? String(n.author) : undefined,
        cover: (n.cover || n.coverUrl || n.poster || n.image || null) as string | null,
        description: (n.description || n.intro || n.synopsis) as string | undefined,
        category: (n.category || n.genreName) as string | undefined,
      }))
      .filter((n) => n.id);

  const loadNovels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/fx/novels/home?page=1&size=24';
      if (query.trim()) {
        url = `/api/fx/novels/search${buildQuery({ q: query.trim(), page: 1, size: 24 })}`;
      } else if (section === 'recommendations') {
        url = '/api/fx/novels/recommendations?page=1&size=24';
      } else if (section === 'ranks') {
        url = '/api/fx/novels/rank-groups?page=1&size=24';
      } else if (section === 'latest') {
        url = '/api/fx/novels/store?opConfId=5&page=1&size=24';
      } else if (section === 'completed') {
        url = '/api/fx/novels/store?opConfId=6&page=1&size=24';
      }

      const res = await apiFetch(url);
      setNovels(normalizeNovels(res));
    } catch (err) {
      setError(err);
      setNovels([]);
    } finally {
      setLoading(false);
    }
  }, [section, query]);

  useEffect(() => {
    void loadNovels();
  }, [section]);

  const openNovel = async (novel: NovelItem, pg = 1) => {
    setSelectedNovel(novel);
    setActiveChapter(null);
    setChapterPage(pg);
    setLoadingChapters(true);
    try {
      const [det, chaps] = await Promise.all([
        apiFetch<Record<string, unknown>>(
          `/api/fx/novels/detail${buildQuery({ contentId: novel.id })}`
        ).catch(() => null),
        apiFetch(
          `/api/fx/novels/chapters${buildQuery({ contentId: novel.id, page: pg, size: 50 })}`
        ),
      ]);
      if (det && (det.description || det.intro)) {
        setSelectedNovel((prev) =>
          prev ? { ...prev, description: String(det.description || det.intro) } : prev
        );
      }
      const list = extractArray(chaps).map((c, idx) => ({
        id: String(c.chapterId || c.id || ''),
        title: String(c.title || c.name || `Chapter ${(pg - 1) * 50 + idx + 1}`),
        order: Number(c.order ?? idx + 1),
      }));
      setChapters(list.filter((c) => c.id));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingChapters(false);
    }
  };

  const openChapter = async (chap: ChapterItem) => {
    if (!selectedNovel) return;
    setLoadingChapterText(true);
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/api/fx/novels/chapter${buildQuery({ chapterId: chap.id })}`
      );
      const text = String(
        res.content || res.text || res.body || (res.data as Record<string, unknown>)?.content || ''
      );
      setActiveChapter({
        id: chap.id,
        title: String(res.title || chap.title),
        content: text || 'Chapter content could not be retrieved from NovelHub.',
      });
      const idx = chapters.findIndex((c) => c.id === chap.id);
      const pct = chapters.length > 0 ? Math.round(((idx + 1) / chapters.length) * 100) : 10;
      void saveReadingProgress({
        novel_id: selectedNovel.id,
        novel_title: selectedNovel.title,
        cover: selectedNovel.cover || null,
        chapter_id: chap.id,
        chapter_title: chap.title,
        progress_percent: pct,
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoadingChapterText(false);
    }
  };

  // Distraction-Free Reader View
  if (activeChapter && selectedNovel) {
    const currentIdx = chapters.findIndex((c) => c.id === activeChapter.id);
    const prevChap = currentIdx > 0 ? chapters[currentIdx - 1] : null;
    const nextChap = currentIdx >= 0 && currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="glass-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 sticky top-20 z-30">
          <button
            type="button"
            onClick={() => setActiveChapter(null)}
            className="glass-btn h-10 px-3.5 rounded-xl text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chapters</span>
          </button>

          <div className="text-center min-w-0 flex-1">
            <p className="text-xs text-rose-200/70 truncate">{selectedNovel.title}</p>
            <h2 className="font-display text-sm sm:text-base font-semibold text-white truncate">
              {activeChapter.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Decrease font size"
              onClick={() => setFontSize((s) => Math.max(14, s - 2))}
              className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs text-rose-100/80 w-8 text-center">{fontSize}</span>
            <button
              type="button"
              aria-label="Increase font size"
              onClick={() => setFontSize((s) => Math.min(26, s + 2))}
              className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <article className="glass-surface-elevated rounded-3xl p-6 sm:p-10">
          {loadingChapterText ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-rose-400" />
            </div>
          ) : (
            <div
              style={{ fontSize: `${fontSize}px` }}
              className="text-rose-50/90 leading-[1.85] whitespace-pre-wrap font-serif max-w-[68ch] mx-auto"
            >
              {activeChapter.content}
            </div>
          )}
        </article>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={!prevChap}
            onClick={() => prevChap && void openChapter(prevChap)}
            className="glass-btn h-11 px-5 rounded-xl text-sm font-medium text-white inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Chapter</span>
          </button>
          <button
            type="button"
            disabled={!nextChap}
            onClick={() => nextChap && void openChapter(nextChap)}
            className="glass-btn-primary h-11 px-5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-surface rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Novel Library
            </h1>
            <p className="text-sm text-rose-100/65 mt-0.5">
              Curated fiction from NovelHub & NovelStore with persistent reading progress.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', label: 'Featured' },
              { id: 'recommendations', label: 'Recommended' },
              { id: 'ranks', label: 'Rankings' },
              { id: 'latest', label: 'Latest' },
              { id: 'completed', label: 'Completed' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSection(s.id as typeof section);
                  setQuery('');
                  setSelectedNovel(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer ${
                  section === s.id ? 'glass-btn-primary text-white' : 'glass-btn text-rose-100/75'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadNovels();
          }}
          className="flex gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-rose-200/60 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search novels by title or keyword…"
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-black/45 border border-rose-200/15 text-sm text-white placeholder:text-rose-100/40 focus:outline-none focus:border-rose-400"
            />
          </div>
          <button
            type="submit"
            className="glass-btn-primary h-11 px-5 rounded-xl text-sm font-semibold text-white cursor-pointer"
          >
            Search
          </button>
        </form>
      </section>

      {Boolean(error) && <DomainNoticeBanner error={error} onRetry={() => void loadNovels()} />}

      {/* Recent Reading History Strip */}
      {readingProgress.length > 0 && !selectedNovel && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Continue Reading</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {readingProgress.slice(0, 3).map((rp) => (
              <button
                key={rp.novel_id}
                type="button"
                onClick={() =>
                  void openNovel({
                    id: rp.novel_id,
                    title: rp.novel_title,
                    cover: rp.cover,
                  })
                }
                className="glass-surface rounded-2xl p-3.5 flex items-center gap-3 text-left cursor-pointer hover:border-rose-400/35"
              >
                <img
                  src={rp.cover || FALLBACK_ART.novelCover}
                  alt={rp.novel_title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-white truncate">
                    {rp.novel_title}
                  </p>
                  <p className="text-xs text-rose-200/70 truncate">{rp.chapter_title}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Selected Novel Detail + Chapter Directory */}
      {selectedNovel ? (
        <section className="glass-surface-elevated rounded-3xl p-5 sm:p-7 space-y-6">
          <button
            type="button"
            onClick={() => setSelectedNovel(null)}
            className="glass-btn h-9 px-3.5 rounded-xl text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Novels</span>
          </button>

          <div className="flex flex-col sm:flex-row gap-6">
            <img
              src={selectedNovel.cover || FALLBACK_ART.novelCover}
              alt={selectedNovel.title}
              referrerPolicy="no-referrer"
              className="w-32 sm:w-40 aspect-[3/4] object-cover rounded-2xl border border-rose-200/15 shrink-0"
            />
            <div className="space-y-2.5">
              <p className="text-xs text-rose-200/70">
                {[selectedNovel.author, selectedNovel.category].filter(Boolean).join(' · ') || 'NovelHub'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {selectedNovel.title}
              </h2>
              {selectedNovel.description && (
                <p className="text-sm text-rose-100/75 leading-relaxed max-w-2xl">
                  {selectedNovel.description}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-rose-200/10">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">Chapters</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={chapterPage <= 1}
                  onClick={() => void openNovel(selectedNovel, Math.max(1, chapterPage - 1))}
                  className="glass-btn h-8 px-3 rounded-lg text-xs text-white disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="font-mono text-xs text-rose-100/70">Page {chapterPage}</span>
                <button
                  type="button"
                  disabled={chapters.length < 50}
                  onClick={() => void openNovel(selectedNovel, chapterPage + 1)}
                  className="glass-btn h-8 px-3 rounded-lg text-xs text-white disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>

            {loadingChapters ? (
              <div className="flex items-center gap-2 text-sm text-rose-100/70 py-6">
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                <span>Loading chapters…</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => void openChapter(ch)}
                    className="glass-btn p-3 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-medium text-white truncate">
                      {ch.title}
                    </span>
                    <BookOpen className="w-4 h-4 text-rose-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-surface rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[3/4] bg-rose-950/40" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-rose-900/40 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {novels.map((novel) => (
            <button
              key={novel.id}
              type="button"
              onClick={() => void openNovel(novel)}
              className="group glass-surface rounded-2xl overflow-hidden text-left cursor-pointer transition-transform hover:-translate-y-1"
            >
              <div className="aspect-[3/4] w-full overflow-hidden bg-[#17080d]">
                <img
                  src={novel.cover || FALLBACK_ART.novelCover}
                  alt={novel.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 space-y-0.5">
                <h3 className="font-display text-sm font-semibold text-white truncate">
                  {novel.title}
                </h3>
                <p className="text-xs text-rose-100/60 truncate">
                  {novel.author || novel.category || 'NovelHub'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
