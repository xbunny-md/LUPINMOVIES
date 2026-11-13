import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Globe,
  Loader2,
  Play,
  Radio,
  Trophy,
  Tv,
  Swords,
  X,
} from 'lucide-react';
import { apiFetch, buildQuery } from '../lib/api';
import { extractArray, FALLBACK_ART } from '../lib/mediaUtils';
import type { ActivePlaybackTarget } from '../types/framex';
import { DomainNoticeBanner } from '../components/DomainNoticeBanner';

interface LiveSportsPageProps {
  onPlay: (target: ActivePlaybackTarget) => void;
}

type HubTab = 'tv' | 'sports' | 'wrestling';

export function LiveSportsPage({ onPlay }: LiveSportsPageProps) {
  const [tab, setTab] = useState<HubTab>('tv');
  const [error, setError] = useState<unknown>(null);

  // Live TV State (Channels v1 + TVGarden v2)
  const [citizenChannels, setCitizenChannels] = useState<Record<string, unknown>[]>([]);
  const [selectedScheduleChannel, setSelectedScheduleChannel] = useState<{
    id: string;
    name: string;
    items: Record<string, unknown>[];
  } | null>(null);
  const [countries, setCountries] = useState<Array<{ code: string; name: string; count?: number }>>([]);
  const [selectedCountry, setSelectedCountry] = useState('us');
  const [gardenChannels, setGardenChannels] = useState<Record<string, unknown>[]>([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [loadingTv, setLoadingTv] = useState(false);

  // Sports State (GoalNivo)
  const [sportsSubTab, setSportsSubTab] = useState<'ongoing' | 'matches' | 'replays' | 'rankings'>('ongoing');
  const [ongoingMatches, setOngoingMatches] = useState<Record<string, unknown>[]>([]);
  const [matchesList, setMatchesList] = useState<Record<string, unknown>[]>([]);
  const [replaysList, setReplaysList] = useState<Record<string, unknown>[]>([]);
  const [leagueId, setLeagueId] = useState('17');
  const [rankings, setRankings] = useState<Record<string, unknown>[]>([]);
  const [loadingSports, setLoadingSports] = useState(false);

  // Match Detail Inspector
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [matchDetailTab, setMatchDetailTab] = useState<'events' | 'stats' | 'lineups' | 'h2h'>('events');
  const [matchDetailData, setMatchDetailData] = useState<{
    detail?: Record<string, unknown>;
    events?: Record<string, unknown>[];
    stats?: Record<string, unknown>[];
    lineups?: Record<string, unknown>;
    h2h?: Record<string, unknown>;
  }>({});
  const [loadingMatchDetail, setLoadingMatchDetail] = useState(false);

  // Wrestling State
  const [wrestlingCatalog, setWrestlingCatalog] = useState<'official' | 'archive'>('official');
  const [wrestlingPage, setWrestlingPage] = useState(1);
  const [wrestlingEvents, setWrestlingEvents] = useState<Record<string, unknown>[]>([]);
  const [selectedWrestlingEvent, setSelectedWrestlingEvent] = useState<{
    title: string;
    parts: Record<string, unknown>[];
  } | null>(null);
  const [loadingWrestling, setLoadingWrestling] = useState(false);

  // Load Live TV
  const loadTv = useCallback(async () => {
    setLoadingTv(true);
    setError(null);
    try {
      const [c1, cty] = await Promise.all([
        apiFetch('/api/fx/channels').catch(() => null),
        apiFetch('/api/fx/tvgarden/countries'),
      ]);
      setCitizenChannels(extractArray(c1));
      const cList = extractArray(cty).map((c) => ({
        code: String(c.code || c.countryCode || c.iso || '').toLowerCase(),
        name: String(c.name || c.countryName || c.code || ''),
        count: Number(c.count ?? c.channelCount ?? 0),
      }));
      setCountries(cList.filter((c) => c.code));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingTv(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tv') void loadTv();
  }, [tab, loadTv]);

  useEffect(() => {
    if (tab !== 'tv' || !selectedCountry) return;
    let active = true;
    apiFetch(`/api/fx/tvgarden/channels${buildQuery({ country: selectedCountry })}`)
      .then((res) => {
        if (active) setGardenChannels(extractArray(res));
      })
      .catch(() => {
        if (active) setGardenChannels([]);
      });
    return () => {
      active = false;
    };
  }, [tab, selectedCountry]);

  const playCitizenChannel = async (ch: Record<string, unknown>) => {
    const id = String(ch.id || ch.channelId || '');
    const name = String(ch.name || ch.title || 'Live Channel');
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/api/fx/channels/${encodeURIComponent(id)}/stream`
      );
      const hlsUrl = (res.hlsUrl || res.streamUrl || res.url) as string | undefined;
      const embedUrl = res.embedUrl as string | undefined;
      if (hlsUrl && !embedUrl) {
        onPlay({
          mode: 'hls',
          title: name,
          subtitle: 'Live Television',
          provider: 'channels',
          contentId: id,
          mediaType: 'live',
          initialUrl: hlsUrl,
        });
      } else if (embedUrl) {
        onPlay({
          mode: 'embed',
          title: name,
          subtitle: 'Live Television (Embed)',
          provider: 'channels',
          contentId: id,
          mediaType: 'live',
          initialUrl: embedUrl,
        });
      }
    } catch (err) {
      setError(err);
    }
  };

  const openSchedule = async (ch: Record<string, unknown>) => {
    const id = String(ch.id || ch.channelId || '');
    const name = String(ch.name || ch.title || 'Channel');
    try {
      const res = await apiFetch(`/api/fx/channels/${encodeURIComponent(id)}/schedule`);
      setSelectedScheduleChannel({ id, name, items: extractArray(res) });
    } catch (err) {
      setError(err);
    }
  };

  const playGardenChannel = async (ch: Record<string, unknown>) => {
    const id = String(ch.channelId || ch.id || ch.nanoid || '');
    const name = String(ch.name || ch.title || 'TVGarden Channel');
    try {
      const res = await apiFetch<{ data?: Record<string, unknown> } & Record<string, unknown>>(
        `/api/fx/tvgarden/stream${buildQuery({ country: selectedCountry, channelId: id })}`
      );
      const payload = res.data || res;
      const proxyUrl = payload.proxyUrl as string | null | undefined;
      const embedUrl = payload.embedUrl as string | null | undefined;

      if (proxyUrl) {
        onPlay({
          mode: 'hls',
          title: name,
          subtitle: `Live TV · ${selectedCountry.toUpperCase()}`,
          provider: 'tvgarden',
          contentId: id,
          countryCode: selectedCountry,
          mediaType: 'live',
          initialUrl: proxyUrl,
        });
      } else if (embedUrl) {
        onPlay({
          mode: 'embed',
          title: name,
          subtitle: `Live TV · ${selectedCountry.toUpperCase()} (YouTube Embed)`,
          provider: 'tvgarden',
          contentId: id,
          countryCode: selectedCountry,
          mediaType: 'live',
          initialUrl: embedUrl,
        });
      }
    } catch (err) {
      setError(err);
    }
  };

  // Load Sports
  const loadSports = useCallback(async () => {
    setLoadingSports(true);
    setError(null);
    try {
      const now = Date.now();
      const dayAgo = now - 24 * 3600_000;
      const dayAhead = now + 24 * 3600_000;

      if (sportsSubTab === 'ongoing') {
        const res = await apiFetch('/api/fx/sports/ongoing');
        setOngoingMatches(extractArray(res));
      } else if (sportsSubTab === 'matches') {
        const res = await apiFetch(
          `/api/fx/sports/matches${buildQuery({ startTime: dayAgo, endTime: dayAhead })}`
        );
        setMatchesList(extractArray(res));
      } else if (sportsSubTab === 'replays') {
        const res = await apiFetch('/api/fx/sports/replays');
        setReplaysList(extractArray(res));
      } else if (sportsSubTab === 'rankings') {
        const res = await apiFetch(
          `/api/fx/sports/rankings${buildQuery({ leagueId })}`
        );
        setRankings(extractArray(res));
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoadingSports(false);
    }
  }, [sportsSubTab, leagueId]);

  useEffect(() => {
    if (tab === 'sports') void loadSports();
  }, [tab, loadSports]);

  const inspectMatch = async (matchId: string) => {
    setActiveMatchId(matchId);
    setLoadingMatchDetail(true);
    try {
      const [detail, events, stats, lineups, h2h] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/api/fx/sports/detail${buildQuery({ matchId })}`).catch(() => ({})),
        apiFetch(`/api/fx/sports/events${buildQuery({ matchId })}`).catch(() => []),
        apiFetch(`/api/fx/sports/stats${buildQuery({ matchId })}`).catch(() => []),
        apiFetch<Record<string, unknown>>(`/api/fx/sports/lineups${buildQuery({ matchId })}`).catch(() => ({})),
        apiFetch<Record<string, unknown>>(`/api/fx/sports/h2h${buildQuery({ matchId })}`).catch(() => ({})),
      ]);
      setMatchDetailData({
        detail,
        events: extractArray(events),
        stats: extractArray(stats),
        lineups,
        h2h,
      });
    } finally {
      setLoadingMatchDetail(false);
    }
  };

  // Load Wrestling
  const loadWrestling = useCallback(async () => {
    setLoadingWrestling(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/fx/wrestling/events${buildQuery({ catalog: wrestlingCatalog, page: wrestlingPage })}`
      );
      setWrestlingEvents(extractArray(res));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingWrestling(false);
    }
  }, [wrestlingCatalog, wrestlingPage]);

  useEffect(() => {
    if (tab === 'wrestling') void loadWrestling();
  }, [tab, loadWrestling]);

  const inspectWrestlingEvent = async (ev: Record<string, unknown>) => {
    const url = String(ev.url || ev.eventUrl || '');
    const title = String(ev.title || ev.name || 'Wrestling Event');
    if (!url) return;
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/api/fx/wrestling/event${buildQuery({ url, resolve: 1 })}`
      );
      const parts = extractArray(res.parts || res);
      setSelectedWrestlingEvent({ title, parts });
    } catch (err) {
      setError(err);
    }
  };

  const playWrestlingPart = async (part: Record<string, unknown>, title: string) => {
    const partUrl = String(part.url || part.streamUrl || '');
    if (!partUrl) return;
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/api/fx/wrestling/stream${buildQuery({ url: partUrl })}`
      );
      const hlsUrl = String(res.hlsUrl || res.proxyUrl || res.url || '');
      if (hlsUrl) {
        onPlay({
          mode: 'hls',
          title,
          subtitle: String(part.label || part.title || 'Event Stream'),
          provider: 'wrestling',
          contentId: partUrl,
          mediaType: 'wrestling',
          initialUrl: hlsUrl,
        });
      }
    } catch (err) {
      setError(err);
    }
  };

  const filteredGarden = gardenChannels.filter((c) => {
    if (!channelFilter.trim()) return true;
    const name = String(c.name || c.title || '').toLowerCase();
    return name.includes(channelFilter.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative rounded-3xl overflow-hidden glass-surface-elevated p-6 sm:p-8">
        <img
          src={FALLBACK_ART.sportsArena}
          alt="Live TV and Sports Arena"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080305] via-[#17060c]/85 to-transparent" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
              Live Broadcasts & Sports Center
            </h1>
            <p className="text-sm text-rose-100/75 mt-1">
              International Live TV channels, live football coverage & analytics, and Wrestling replays.
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-black/50 border border-rose-200/15 self-start">
            <button
              type="button"
              onClick={() => setTab('tv')}
              className={`px-4 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'tv' ? 'glass-btn-primary text-white' : 'text-rose-100/70'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Live TV</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('sports')}
              className={`px-4 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'sports' ? 'glass-btn-primary text-white' : 'text-rose-100/70'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Sports Center</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('wrestling')}
              className={`px-4 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'wrestling' ? 'glass-btn-primary text-white' : 'text-rose-100/70'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Wrestling</span>
            </button>
          </div>
        </div>
      </section>

      {Boolean(error) && (
        <DomainNoticeBanner
          error={error}
          onRetry={() => {
            if (tab === 'tv') void loadTv();
            else if (tab === 'sports') void loadSports();
            else void loadWrestling();
          }}
        />
      )}

      {/* TAB 1: LIVE TV */}
      {tab === 'tv' && (
        <div className="space-y-8">
          {/* Citizen Digital Featured Channels */}
          {citizenChannels.length > 0 && (
            <section className="space-y-3.5">
              <h2 className="font-display text-xl font-semibold text-white">
                Featured Live Channels
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {citizenChannels.map((ch) => {
                  const id = String(ch.id || ch.channelId || '');
                  const name = String(ch.name || ch.title || 'Channel');
                  const logo = (ch.logo || ch.image) as string | undefined;
                  return (
                    <div
                      key={id}
                      className="glass-surface rounded-2xl p-4 flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-black/45 border border-rose-200/10 flex items-center justify-center overflow-hidden shrink-0">
                          {logo ? (
                            <img
                              src={logo}
                              alt={name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Radio className="w-5 h-5 text-rose-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-semibold text-white truncate">
                            {name}
                          </h3>
                          <p className="text-xs text-rose-200/65">
                            {ch.isLive ? 'On Air · Live' : 'Channel Stream'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void playCitizenChannel(ch)}
                          className="glass-btn-primary flex-1 h-9 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Watch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void openSchedule(ch)}
                          aria-label={`Schedule for ${name}`}
                          className="glass-btn h-9 px-3 rounded-xl text-xs text-rose-100 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Guide</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Programme Schedule Drawer */}
          {selectedScheduleChannel && (
            <section className="glass-surface-elevated rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">
                  {selectedScheduleChannel.name} — Programme Schedule
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedScheduleChannel(null)}
                  className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selectedScheduleChannel.items.length === 0 ? (
                <p className="text-sm text-rose-100/60">No schedule listings returned for today.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
                  {selectedScheduleChannel.items.map((prog, idx) => (
                    <div key={idx} className="glass-surface rounded-xl p-3 space-y-0.5">
                      <p className="font-mono text-xs text-rose-300">
                        {String(prog.time || prog.startTime || '')}
                      </p>
                      <p className="text-sm font-medium text-white truncate">
                        {String(prog.title || prog.name || 'Programme')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TVGarden Global Country Directory */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-rose-300" />
                  <span>Global Channels Directory</span>
                </h2>
                <p className="text-xs text-rose-100/60 mt-0.5">
                  Browse TVGarden channels by country (HLS proxy & YouTube live streams).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select country"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-black/50 border border-rose-200/15 text-xs text-white"
                >
                  {countries.length === 0 ? (
                    <option value="us" className="bg-[#14060b]">
                      United States (us)
                    </option>
                  ) : (
                    countries.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#14060b]">
                        {c.name} ({c.code.toUpperCase()})
                      </option>
                    ))
                  )}
                </select>
                <input
                  type="search"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  placeholder="Filter channels…"
                  className="h-10 px-3.5 rounded-xl bg-black/50 border border-rose-200/15 text-xs text-white placeholder:text-rose-100/40"
                />
              </div>
            </div>

            {loadingTv ? (
              <div className="flex items-center gap-2 text-sm text-rose-100/70 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
                <span>Loading TVGarden channels…</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredGarden.slice(0, 60).map((ch, idx) => {
                  const id = String(ch.channelId || ch.id || ch.nanoid || idx);
                  const name = String(ch.name || ch.title || 'Channel');
                  const logo = (ch.logo || ch.image) as string | undefined;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void playGardenChannel(ch)}
                      className="glass-surface rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left hover:border-rose-400/35 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-black/45 border border-rose-200/10 flex items-center justify-center overflow-hidden shrink-0">
                          {logo ? (
                            <img
                              src={logo}
                              alt={name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Tv className="w-4 h-4 text-rose-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{name}</p>
                          <p className="text-[11px] text-rose-100/60 truncate">
                            {ch.hasHls ? 'HLS Relay' : ch.hasYoutube ? 'YouTube Live' : 'Broadcast'}
                          </p>
                        </div>
                      </div>
                      <Play className="w-4 h-4 text-rose-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: SPORTS CENTER */}
      {tab === 'sports' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ongoing', label: 'Live Matches' },
                { id: 'matches', label: 'Fixtures' },
                { id: 'replays', label: 'Replays & Highlights' },
                { id: 'rankings', label: 'League Standings' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSportsSubTab(s.id as typeof sportsSubTab)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer ${
                    sportsSubTab === s.id
                      ? 'glass-btn-primary text-white'
                      : 'glass-btn text-rose-100/75'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {sportsSubTab === 'rankings' && (
              <div className="flex items-center gap-2">
                <label htmlFor="league-id" className="text-xs text-rose-100/70">
                  League ID:
                </label>
                <input
                  id="league-id"
                  type="text"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="w-24 h-9 px-2.5 rounded-xl bg-black/50 border border-rose-200/15 text-xs font-mono text-white"
                />
              </div>
            )}
          </div>

          {loadingSports ? (
            <div className="flex items-center gap-2 text-sm text-rose-100/70 py-10">
              <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
              <span>Loading GoalNivo sports data…</span>
            </div>
          ) : sportsSubTab === 'rankings' ? (
            <div className="glass-surface rounded-3xl overflow-hidden">
              {rankings.length === 0 ? (
                <p className="p-8 text-center text-sm text-rose-100/60">
                  No standings data available for League ID {leagueId}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-rose-200/10 text-rose-100/60">
                      <tr>
                        <th className="p-3.5">#</th>
                        <th className="p-3.5">Club</th>
                        <th className="p-3.5 text-right font-mono">P</th>
                        <th className="p-3.5 text-right font-mono">W</th>
                        <th className="p-3.5 text-right font-mono">D</th>
                        <th className="p-3.5 text-right font-mono">L</th>
                        <th className="p-3.5 text-right font-mono">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-200/10 tabular-nums">
                      {rankings.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="p-3.5 font-mono text-rose-300">
                            {String(row.rank || row.position || idx + 1)}
                          </td>
                          <td className="p-3.5 font-medium text-white">
                            {String(row.teamName || row.name || 'Team')}
                          </td>
                          <td className="p-3.5 text-right font-mono">{String(row.played ?? row.matches ?? '-')}</td>
                          <td className="p-3.5 text-right font-mono">{String(row.win ?? row.wins ?? '-')}</td>
                          <td className="p-3.5 text-right font-mono">{String(row.draw ?? row.draws ?? '-')}</td>
                          <td className="p-3.5 text-right font-mono">{String(row.loss ?? row.losses ?? '-')}</td>
                          <td className="p-3.5 text-right font-mono font-semibold text-amber-300">
                            {String(row.points ?? row.pts ?? '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(sportsSubTab === 'ongoing'
                ? ongoingMatches
                : sportsSubTab === 'matches'
                  ? matchesList
                  : replaysList
              ).map((m, idx) => {
                const matchId = String(m.matchId || m.id || idx);
                const home = String(m.homeTeamName || (m.home as Record<string, unknown>)?.name || m.homeName || 'Home');
                const away = String(m.awayTeamName || (m.away as Record<string, unknown>)?.name || m.awayName || 'Away');
                const score = `${m.homeScore ?? '-'} : ${m.awayScore ?? '-'}`;
                const proxyUrl = (m.proxyUrl || m.streamUrl || m.url) as string | undefined;

                return (
                  <div
                    key={matchId}
                    className="glass-surface rounded-2xl p-4 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <p className="text-xs text-rose-200/70 truncate">
                        {String(m.leagueName || m.competition || 'Football')}
                        {m.statusText ? ` · ${String(m.statusText)}` : ''}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display text-sm font-semibold text-white truncate flex-1">
                          {home}
                        </span>
                        <span className="font-mono text-base font-bold text-amber-300 tabular-nums shrink-0">
                          {score}
                        </span>
                        <span className="font-display text-sm font-semibold text-white truncate flex-1 text-right">
                          {away}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void inspectMatch(matchId)}
                        className="glass-btn flex-1 h-9 rounded-xl text-xs font-medium text-white cursor-pointer"
                      >
                        Stats & Lineups
                      </button>
                      {proxyUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            onPlay({
                              mode: proxyUrl.includes('.m3u8') ? 'hls' : 'direct',
                              title: `${home} vs ${away}`,
                              subtitle: String(m.leagueName || 'Match Stream'),
                              provider: 'sports',
                              contentId: matchId,
                              mediaType: 'sports',
                              initialUrl: proxyUrl,
                            })
                          }
                          className="glass-btn-primary h-9 px-3.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Watch</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Match Detail Inspector */}
          {activeMatchId && (
            <section className="glass-surface-elevated rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">
                  Match Center · {activeMatchId}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveMatchId(null)}
                  className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {(['events', 'stats', 'lineups', 'h2h'] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setMatchDetailTab(dt)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize cursor-pointer ${
                      matchDetailTab === dt ? 'glass-btn-primary text-white' : 'glass-btn text-rose-100/75'
                    }`}
                  >
                    {dt === 'h2h' ? 'Head-to-Head' : dt}
                  </button>
                ))}
              </div>

              {loadingMatchDetail ? (
                <div className="flex items-center gap-2 text-sm text-rose-100/70 py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  <span>Loading match telemetry…</span>
                </div>
              ) : (
                <pre className="text-xs font-mono text-rose-100/80 bg-black/40 border border-rose-200/10 rounded-2xl p-4 overflow-x-auto max-h-72">
                  {JSON.stringify(
                    matchDetailTab === 'events'
                      ? matchDetailData.events
                      : matchDetailTab === 'stats'
                        ? matchDetailData.stats
                        : matchDetailTab === 'lineups'
                          ? matchDetailData.lineups
                          : matchDetailData.h2h,
                    null,
                    2
                  )}
                </pre>
              )}
            </section>
          )}
        </div>
      )}

      {/* TAB 3: WRESTLING */}
      {tab === 'wrestling' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl bg-black/45 border border-rose-200/10">
              <button
                type="button"
                onClick={() => {
                  setWrestlingCatalog('official');
                  setWrestlingPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  wrestlingCatalog === 'official' ? 'glass-btn-primary text-white' : 'text-rose-100/70'
                }`}
              >
                Official Catalog
              </button>
              <button
                type="button"
                onClick={() => {
                  setWrestlingCatalog('archive');
                  setWrestlingPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  wrestlingCatalog === 'archive' ? 'glass-btn-primary text-white' : 'text-rose-100/70'
                }`}
              >
                Archive
              </button>
            </div>
          </div>

          {selectedWrestlingEvent && (
            <section className="glass-surface-elevated rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">
                  {selectedWrestlingEvent.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedWrestlingEvent(null)}
                  className="glass-btn w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {selectedWrestlingEvent.parts.map((part, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void playWrestlingPart(part, selectedWrestlingEvent.title)}
                    className="glass-btn p-3 rounded-xl flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-xs font-medium text-white truncate">
                      {String(part.label || part.title || `Part ${idx + 1}`)}
                    </span>
                    <Play className="w-4 h-4 text-rose-300 shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {loadingWrestling ? (
            <div className="flex items-center gap-2 text-sm text-rose-100/70 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
              <span>Loading wrestling events…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wrestlingEvents.map((ev, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void inspectWrestlingEvent(ev)}
                  className="glass-surface rounded-2xl p-4 text-left space-y-2 hover:border-rose-400/40 transition-colors cursor-pointer"
                >
                  <p className="font-display text-base font-semibold text-white line-clamp-2">
                    {String(ev.title || ev.name || 'Wrestling Event')}
                  </p>
                  <p className="text-xs text-rose-100/60">
                    {[ev.date, ev.promotion || wrestlingCatalog].filter(Boolean).map(String).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
