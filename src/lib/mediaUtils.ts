import type { MediaDetail, MediaItem, SeasonEpisode, SubtitleTrack } from '../types/framex';

export const FALLBACK_ART = {
  cinemaHero: '/src/assets/images/lupin_cinema_hero_1794595137200.jpg',
  animeShowcase: '/src/assets/images/lupin_anime_showcase_1794595138312.jpg',
  sportsArena: '/src/assets/images/lupin_sports_arena_1794595138572.jpg',
  novelCover: '/src/assets/images/lupin_novel_cover_1794595139214.jpg',
};

export function extractArray(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of [
    'results',
    'items',
    'data',
    'list',
    'movies',
    'series',
    'records',
    'channels',
    'countries',
    'events',
    'matches',
    'chapters',
    'novels',
    'episodes',
    'providers',
    'servers',
    'categories',
    'genres',
  ]) {
    const val = obj[key];
    if (Array.isArray(val)) return val as Record<string, unknown>[];
    if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).items)) {
      return (val as Record<string, unknown>).items as Record<string, unknown>[];
    }
    if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).list)) {
      return (val as Record<string, unknown>).list as Record<string, unknown>[];
    }
    if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).results)) {
      return (val as Record<string, unknown>).results as Record<string, unknown>[];
    }
  }
  return [];
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  }
  return undefined;
}

export function normalizeMediaItem(
  raw: Record<string, unknown>,
  defaultSource: 'moviebox' | 'showbox' = 'moviebox'
): MediaItem {
  const id =
    pickStr(raw, ['subjectId', 'contentId', 'id', '_id']) ||
    pickStr(raw, ['slug', 'detailPath']) ||
    'unknown';

  const slug =
    pickStr(raw, ['slug', 'detailPath', 'path']) ||
    id;

  const title =
    pickStr(raw, ['title', 'name', 'subjectName']) || 'Untitled';

  const poster =
    pickStr(raw, ['poster', 'cover', 'image', 'thumbnail', 'posterUrl']) ||
    (raw.cover && typeof raw.cover === 'object'
      ? pickStr(raw.cover as Record<string, unknown>, ['url', 'src'])
      : undefined) ||
    null;

  const backdrop =
    pickStr(raw, ['backdrop', 'banner', 'coverWide', 'stills', 'backdropUrl']) ||
    poster;

  const rawType = (pickStr(raw, ['type', 'mediaType', 'subjectType']) || 'movie').toLowerCase();
  const type =
    rawType.includes('series') || rawType.includes('tv') || rawType === '2'
      ? 'series'
      : 'movie';

  const genresRaw = raw.genres || raw.genre || raw.tags;
  const genres: string[] = Array.isArray(genresRaw)
    ? genresRaw
        .map((g) => (typeof g === 'string' ? g : (g as Record<string, unknown>)?.name as string))
        .filter(Boolean)
    : typeof genresRaw === 'string'
      ? genresRaw.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
      : [];

  const source = (pickStr(raw, ['source', 'provider']) || defaultSource).toLowerCase();

  return {
    id,
    subjectId: pickStr(raw, ['subjectId', 'id']),
    slug,
    detailPath: pickStr(raw, ['detailPath', 'slug']),
    title,
    description: pickStr(raw, ['description', 'synopsis', 'overview', 'plot', 'intro']),
    overview: pickStr(raw, ['overview', 'description', 'synopsis']),
    year: pickStr(raw, ['year', 'releaseYear']) || (pickStr(raw, ['releaseDate'])?.slice(0, 4) ?? null),
    releaseDate: pickStr(raw, ['releaseDate', 'released']) ?? null,
    duration: pickStr(raw, ['duration', 'runtime']) ?? null,
    rating: pickStr(raw, ['rating', 'imdbRatingValue', 'score', 'voteAverage']) ?? null,
    genres,
    poster,
    backdrop,
    type,
    source,
    imdbId: pickStr(raw, ['imdbId', 'imdb']) ?? null,
    raw,
  };
}

export function normalizeMediaDetail(
  payload: unknown,
  fallbackItem?: MediaItem
): MediaDetail {
  const root =
    payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : ((payload || {}) as Record<string, unknown>);

  const base = normalizeMediaItem(
    { ...(fallbackItem?.raw || {}), ...root },
    (fallbackItem?.source as 'moviebox' | 'showbox') || 'moviebox'
  );

  // Extract cast defensively
  const rawCast = root.cast || root.actors || root.stars || root.credits;
  const cast: MediaDetail['cast'] = Array.isArray(rawCast)
    ? rawCast.slice(0, 16).map((c) => {
        if (typeof c === 'string') return { name: c };
        const co = c as Record<string, unknown>;
        return {
          name: pickStr(co, ['name', 'actorName', 'title']) || 'Cast Member',
          role: pickStr(co, ['role', 'character']),
          avatar: pickStr(co, ['avatar', 'photo', 'image', 'profile']) || null,
        };
      })
    : undefined;

  // Extract seasons/episodes defensively
  const seasonsMap = new Map<number, SeasonEpisode[]>();
  const rawSeasons = root.seasons || root.seasonList || (root.resource as Record<string, unknown>)?.seasons;
  if (Array.isArray(rawSeasons)) {
    for (const s of rawSeasons) {
      const so = s as Record<string, unknown>;
      const seNum = Number(so.se ?? so.season ?? so.seasonNumber ?? 1);
      const epsRaw = so.episodes || so.epList || so.maxEp;
      if (Array.isArray(epsRaw)) {
        const eps: SeasonEpisode[] = epsRaw.map((ep, idx) => {
          if (typeof ep === 'number') {
            return { season: seNum, episode: ep, title: `Episode ${ep}` };
          }
          const eo = ep as Record<string, unknown>;
          const epNum = Number(eo.ep ?? eo.episode ?? eo.episodeNumber ?? idx + 1);
          return {
            season: seNum,
            episode: epNum,
            title: pickStr(eo, ['title', 'name']) || `Episode ${epNum}`,
            id: pickStr(eo, ['id', 'episodeId']),
            duration: pickStr(eo, ['duration', 'runtime']),
            thumbnail: pickStr(eo, ['thumbnail', 'poster', 'cover']) || null,
          };
        });
        seasonsMap.set(seNum, eps);
      } else if (typeof so.maxEp === 'number' && so.maxEp > 0) {
        const eps: SeasonEpisode[] = Array.from({ length: so.maxEp }, (_, idx) => ({
          season: seNum,
          episode: idx + 1,
          title: `Episode ${idx + 1}`,
        }));
        seasonsMap.set(seNum, eps);
      }
    }
  }

  // Fallback if episodes is flat array on root
  if (seasonsMap.size === 0 && Array.isArray(root.episodes)) {
    for (const ep of root.episodes as Record<string, unknown>[]) {
      const seNum = Number(ep.season ?? ep.se ?? 1);
      const epNum = Number(ep.episode ?? ep.ep ?? ep.number ?? 1);
      const list = seasonsMap.get(seNum) || [];
      list.push({
        season: seNum,
        episode: epNum,
        title: pickStr(ep, ['title', 'name']) || `Episode ${epNum}`,
        id: pickStr(ep, ['id', 'episodeId']),
      });
      seasonsMap.set(seNum, list);
    }
  }

  const seasons = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a.episode - b.episode),
    }));

  const relatedRaw = root.related || root.recommendations || root.similar;
  const related = Array.isArray(relatedRaw)
    ? (relatedRaw as Record<string, unknown>[]).map((r) =>
        normalizeMediaItem(r, (base.source as 'moviebox' | 'showbox') || 'moviebox')
      )
    : undefined;

  return {
    ...base,
    cast,
    seasons: seasons.length > 0 ? seasons : undefined,
    related,
    trailerUrl: pickStr(root, ['trailer', 'trailerUrl']),
  };
}

export function normalizeSubtitles(payload: unknown): SubtitleTrack[] {
  const arr = extractArray(payload);
  const rootSub =
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as Record<string, unknown>).captions)
      ? ((payload as Record<string, unknown>).captions as Record<string, unknown>[])
      : payload &&
          typeof payload === 'object' &&
          Array.isArray((payload as Record<string, unknown>).subtitles)
        ? ((payload as Record<string, unknown>).subtitles as Record<string, unknown>[])
        : arr;

  return rootSub
    .map((s) => {
      const url = pickStr(s, ['url', 'src', 'file', 'vttUrl', 'srtUrl']);
      if (!url) return null;
      return {
        id: pickStr(s, ['id', 'lan']),
        lang: pickStr(s, ['lang', 'lan', 'language', 'code']) || 'en',
        label: pickStr(s, ['label', 'lanName', 'languageName', 'lang', 'name']) || 'Subtitles',
        url,
        format: pickStr(s, ['format', 'ext']),
      } as SubtitleTrack;
    })
    .filter((x): x is SubtitleTrack => x !== null);
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
