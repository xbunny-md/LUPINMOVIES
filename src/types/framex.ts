export type ProviderSource = 'moviebox' | 'showbox' | string;

export interface MediaItem {
  id: string;
  subjectId?: string;
  slug: string;
  detailPath?: string;
  title: string;
  description?: string;
  overview?: string;
  year?: string | number | null;
  releaseDate?: string | null;
  duration?: string | number | null;
  rating?: string | number | null;
  genres: string[];
  poster?: string | null;
  backdrop?: string | null;
  type: 'movie' | 'series' | string;
  source: ProviderSource;
  imdbId?: string | null;
  raw?: Record<string, unknown>;
}

export interface SearchV2Metadata {
  schemaVersion?: string;
  query?: string;
  source?: string;
  fallback?: boolean;
  fallbackReason?: string | null;
  providers?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  playback?: Record<string, unknown>;
}

export interface SeasonEpisode {
  season: number;
  episode: number;
  title?: string;
  id?: string;
  duration?: string | number;
  thumbnail?: string | null;
}

export interface MediaDetail extends MediaItem {
  cast?: Array<{ name: string; role?: string; avatar?: string | null }>;
  seasons?: Array<{ season: number; episodes: SeasonEpisode[] }>;
  related?: MediaItem[];
  languages?: string[];
  hasSubtitles?: boolean;
  trailerUrl?: string | null;
}

export interface StreamSourceOption {
  id?: string;
  resolution?: string | number;
  quality?: string;
  format?: string;
  size?: string | number;
  lang?: string;
  url?: string;
}

export interface SubtitleTrack {
  id?: string;
  lang?: string;
  label?: string;
  url: string;
  format?: string;
}

export interface SignedStreamResponse {
  url: string;
  expiresAt?: string | number;
  expiresIn?: number;
  resolution?: string | number;
  lang?: string;
  format?: string;
}

export type PlayerMode = 'direct' | 'hls' | 'embed';

export interface ActivePlaybackTarget {
  mode: PlayerMode;
  title: string;
  subtitle?: string;
  poster?: string | null;
  provider: 'moviebox' | 'showbox' | 'gotaku' | 'animex' | 'channels' | 'tvgarden' | 'wrestling' | 'sports' | 'proxy';
  contentId: string;
  slug?: string;
  detailPath?: string;
  mediaType: 'movie' | 'series' | 'anime' | 'live' | 'sports' | 'wrestling';
  season?: number;
  episode?: number;
  totalEpisodesInSeason?: number;
  // For direct/signed streams
  initialUrl?: string;
  expiresIn?: number;
  expiresAt?: string | number;
  // For anime
  animeType?: 'sub' | 'dub' | 'hard_sub';
  animeProviderId?: string;
  // For live TV
  countryCode?: string;
  // Optional callbacks for next episode
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  preferred_quality: string;
  preferred_subtitle_lang: string;
  preferred_audio_lang: string;
  created_at?: string;
}

export interface LibraryEntry {
  id?: number;
  list_type: 'watchlist' | 'favorite';
  media_type: string;
  item_id: string;
  slug: string;
  provider: string;
  title: string;
  poster?: string | null;
  year?: string | null;
  created_at?: string;
}

export interface WatchProgressEntry {
  content_id: string;
  slug: string;
  provider: string;
  media_type: string;
  title: string;
  poster?: string | null;
  season: number;
  episode: number;
  position_seconds: number;
  duration_seconds: number;
  updated_at?: string;
}

export interface ReadingProgressEntry {
  novel_id: string;
  novel_title: string;
  cover?: string | null;
  chapter_id: string;
  chapter_title: string;
  progress_percent: number;
  updated_at?: string;
}
