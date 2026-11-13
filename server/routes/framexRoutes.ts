import { Router, type Request, type Response } from 'express';
import { framexGet, FramexApiError } from '../framexClient.ts';

export const framexRouter = Router();

function handleError(res: Response, err: unknown) {
  if (err instanceof FramexApiError) {
    return res.status(err.status).json({
      ok: false,
      status: err.status,
      code: err.code,
      error: err.message,
      isDomainRestriction: err.isDomainRestriction,
      detectedOrigin: err.detectedOrigin,
    });
  }
  const msg = err instanceof Error ? err.message : 'Unexpected server error';
  return res.status(500).json({ ok: false, status: 500, code: 'INTERNAL_ERROR', error: msg });
}

function getProviderPrefix(req: Request): '/v1' | '/v2' {
  return req.query.provider === 'v2' ? '/v2' : '/v1';
}

// Health
framexRouter.get('/health', async (req, res) => {
  try {
    const data = await framexGet('/healthz', { req, noCache: true });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Discovery: Movies & Series (MovieBox v1 & Showbox v2)
framexRouter.get('/movies/trending', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/movies/trending`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/movies/popular', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/movies/popular`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/series/popular', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/series/popular`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/movies/latest', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/movies/latest`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/series/latest', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/series/latest`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/movies/upcoming', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const data = await framexGet(`${prefix}/movies/upcoming`, {
      req,
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Search (v1 MovieBox with Showbox fallback, or v2 provider-aware search envelope)
framexRouter.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ ok: false, error: 'Search query (q) is required.' });
    }
    const mode = req.query.mode === 'v1' ? '/v1' : '/v2';
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${mode}/search`, {
      req,
      query: { q, page },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Categories & Genres
framexRouter.get('/categories', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const data = await framexGet(`${prefix}/categories`, { req, cacheTtlMs: 120_000 });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/categories/:slug', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/categories/${encodeURIComponent(req.params.slug)}`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/genres', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const data = await framexGet(`${prefix}/genres`, { req, cacheTtlMs: 120_000 });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/genres/:slug', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const page = Number(req.query.page || 1);
    const data = await framexGet(`${prefix}/genres/${encodeURIComponent(req.params.slug)}`, {
      req,
      query: { page },
      cacheTtlMs: 45_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ID Resolution (MovieBox detailPath <-> subjectId)
framexRouter.get('/ids/lookup', async (req, res) => {
  try {
    const detailPath = String(req.query.detailPath || '').trim();
    if (!detailPath) return res.status(400).json({ ok: false, error: 'detailPath is required' });
    const data = await framexGet('/v1/ids/lookup', {
      req,
      query: { detailPath },
      cacheTtlMs: 300_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/ids/detail-path', async (req, res) => {
  try {
    const subjectId = String(req.query.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ ok: false, error: 'subjectId is required' });
    const data = await framexGet('/v1/ids/detail-path', {
      req,
      query: { subjectId },
      cacheTtlMs: 300_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Movie / Series Details
framexRouter.get('/movies/:slug', async (req, res) => {
  try {
    const prefix = getProviderPrefix(req);
    const type = req.query.type ? String(req.query.type) : undefined;
    const data = await framexGet(`${prefix}/movies/${encodeURIComponent(req.params.slug)}`, {
      req,
      query: { type },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Signed Stream URL (10-minute lifetime — NEVER cached)
framexRouter.get('/stream-url', async (req, res) => {
  try {
    const subjectId = String(req.query.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ ok: false, error: 'subjectId is required' });
    const data = await framexGet('/v1/stream-url', {
      req,
      noCache: true,
      query: {
        subjectId,
        resolution: req.query.resolution ? String(req.query.resolution) : undefined,
        lang: req.query.lang ? String(req.query.lang) : undefined,
        se: req.query.se ? String(req.query.se) : undefined,
        ep: req.query.ep ? String(req.query.ep) : undefined,
        download: req.query.download ? String(req.query.download) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Play links, Download links & Captions (NEVER cached)
framexRouter.get('/play-links', async (req, res) => {
  try {
    const subjectId = String(req.query.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ ok: false, error: 'subjectId is required' });
    const data = await framexGet('/play-links', {
      req,
      noCache: true,
      query: {
        subjectId,
        detailPath: req.query.detailPath ? String(req.query.detailPath) : undefined,
        se: req.query.se ? String(req.query.se) : undefined,
        ep: req.query.ep ? String(req.query.ep) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/download-links', async (req, res) => {
  try {
    const subjectId = String(req.query.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ ok: false, error: 'subjectId is required' });
    const data = await framexGet('/download-links', {
      req,
      noCache: true,
      query: {
        subjectId,
        detailPath: req.query.detailPath ? String(req.query.detailPath) : undefined,
        se: req.query.se ? String(req.query.se) : undefined,
        ep: req.query.ep ? String(req.query.ep) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/captions', async (req, res) => {
  try {
    const subjectId = String(req.query.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ ok: false, error: 'subjectId is required' });
    const data = await framexGet('/captions', {
      req,
      noCache: true,
      query: {
        subjectId,
        streamId: req.query.streamId ? String(req.query.streamId) : undefined,
        detailPath: req.query.detailPath ? String(req.query.detailPath) : undefined,
        format: req.query.format ? String(req.query.format) : undefined,
        resolution: req.query.resolution ? String(req.query.resolution) : undefined,
        se: req.query.se ? String(req.query.se) : undefined,
        ep: req.query.ep ? String(req.query.ep) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Proxy sources (slug / IMDb fallback)
framexRouter.get('/proxy/sources/:slug', async (req, res) => {
  try {
    const data = await framexGet(`/v1/proxy/sources/${encodeURIComponent(req.params.slug)}`, {
      req,
      noCache: true,
      query: {
        type: req.query.type ? String(req.query.type) : undefined,
        imdb: req.query.imdb ? String(req.query.imdb) : undefined,
        season: req.query.season ? String(req.query.season) : undefined,
        episode: req.query.episode ? String(req.query.episode) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/proxy/imdb/:ttId', async (req, res) => {
  try {
    const data = await framexGet(`/v1/proxy/imdb/${encodeURIComponent(req.params.ttId)}`, {
      req,
      noCache: true,
      query: {
        type: req.query.type ? String(req.query.type) : undefined,
        season: req.query.season ? String(req.query.season) : undefined,
        episode: req.query.episode ? String(req.query.episode) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Subtitle text proxy (converts SRT -> WebVTT so browser <track> elements render reliably)
framexRouter.get('/subtitle-proxy', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).send('Invalid subtitle URL');
  }
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).send('Subtitle fetch failed');
    let text = await r.text();
    if (!text.trimStart().startsWith('WEBVTT')) {
      // Convert SRT timestamps (00:00:01,200 -> 00:00:01.200) to WebVTT
      text =
        'WEBVTT\n\n' +
        text
          .replace(/\r\n/g, '\n')
          .replace(/^\d+\n/gm, '')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);
  } catch {
    res.status(502).send('Unable to load subtitle');
  }
});

// ========================
// ANIME: GOTAKU (v1) & ANIMEX (v2)
// ========================
framexRouter.get('/anime/gotaku/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'q is required' });
    const data = await framexGet('/v1/anime/search', {
      req,
      query: { q, limit: req.query.limit ? Number(req.query.limit) : 20 },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/gotaku/detail', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    if (!contentId) return res.status(400).json({ ok: false, error: 'contentId is required' });
    const data = await framexGet('/v1/anime/detail', {
      req,
      query: { contentId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/gotaku/episodes', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    if (!contentId) return res.status(400).json({ ok: false, error: 'contentId is required' });
    const data = await framexGet('/v1/anime/episodes', {
      req,
      query: { contentId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/gotaku/episode', async (req, res) => {
  try {
    const episodeId = String(req.query.episodeId || '').trim();
    if (!episodeId) return res.status(400).json({ ok: false, error: 'episodeId is required' });
    const data = await framexGet('/v1/anime/episode', {
      req,
      query: { episodeId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/gotaku/stream', async (req, res) => {
  try {
    const episodeId = String(req.query.episodeId || '').trim();
    if (!episodeId) return res.status(400).json({ ok: false, error: 'episodeId is required' });
    const data = await framexGet('/v1/anime/stream', {
      req,
      noCache: true,
      query: {
        episodeId,
        type: req.query.type ? String(req.query.type) : 'hard_sub',
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/animex/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'q is required' });
    const data = await framexGet('/v1/animev2/search', {
      req,
      query: { q, limit: req.query.limit ? Number(req.query.limit) : 20 },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/animex/episodes', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    if (!contentId) return res.status(400).json({ ok: false, error: 'contentId is required' });
    const data = await framexGet('/v1/animev2/episodes', {
      req,
      query: { contentId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/animex/providers', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    const episode = String(req.query.episode || '').trim();
    if (!contentId || !episode) {
      return res.status(400).json({ ok: false, error: 'contentId and episode are required' });
    }
    const data = await framexGet('/v1/animev2/providers', {
      req,
      query: { contentId, episode },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/animex/embed', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    const episode = String(req.query.episode || '').trim();
    if (!contentId || !episode) {
      return res.status(400).json({ ok: false, error: 'contentId and episode are required' });
    }
    const data = await framexGet('/v1/animev2/embed', {
      req,
      noCache: true,
      query: {
        contentId,
        episode,
        type: req.query.type ? String(req.query.type) : 'sub',
        providerId: req.query.providerId ? String(req.query.providerId) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/anime/animex/stream', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || '').trim();
    const episode = String(req.query.episode || '').trim();
    if (!contentId || !episode) {
      return res.status(400).json({ ok: false, error: 'contentId and episode are required' });
    }
    const data = await framexGet('/v1/animev2/stream', {
      req,
      noCache: true,
      query: {
        contentId,
        episode,
        type: req.query.type ? String(req.query.type) : 'sub',
        providerId: req.query.providerId ? String(req.query.providerId) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ========================
// LIVE TV: CHANNELS (v1) & TVGARDEN (v2)
// ========================
framexRouter.get('/channels', async (req, res) => {
  try {
    const data = await framexGet('/v1/channels', { req, cacheTtlMs: 30_000 });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/channels/:channelId', async (req, res) => {
  try {
    const data = await framexGet(`/v1/channels/${encodeURIComponent(req.params.channelId)}`, {
      req,
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/channels/:channelId/stream', async (req, res) => {
  try {
    const data = await framexGet(`/v1/channels/${encodeURIComponent(req.params.channelId)}/stream`, {
      req,
      noCache: true,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/channels/:channelId/schedule', async (req, res) => {
  try {
    const data = await framexGet(`/v1/channels/${encodeURIComponent(req.params.channelId)}/schedule`, {
      req,
      query: { day: req.query.day ? String(req.query.day) : undefined },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/tvgarden/countries', async (req, res) => {
  try {
    const data = await framexGet('/v1/channels-v2/countries', { req, cacheTtlMs: 300_000 });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/tvgarden/channels', async (req, res) => {
  try {
    const country = String(req.query.country || 'us').trim();
    const data = await framexGet('/v1/channels-v2/channels', {
      req,
      query: { country },
      cacheTtlMs: 120_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/tvgarden/channel', async (req, res) => {
  try {
    const country = String(req.query.country || '').trim();
    const channelId = String(req.query.channelId || '').trim();
    if (!country || !channelId) {
      return res.status(400).json({ ok: false, error: 'country and channelId are required' });
    }
    const data = await framexGet('/v1/channels-v2/channel', {
      req,
      noCache: true,
      query: { country, channelId },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/tvgarden/stream', async (req, res) => {
  try {
    const country = String(req.query.country || '').trim();
    const channelId = String(req.query.channelId || '').trim();
    if (!country || !channelId) {
      return res.status(400).json({ ok: false, error: 'country and channelId are required' });
    }
    const data = await framexGet('/v1/channels-v2/stream', {
      req,
      noCache: true,
      query: { country, channelId },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ========================
// WRESTLING
// ========================
framexRouter.get('/wrestling/events', async (req, res) => {
  try {
    const data = await framexGet('/v1/wrestling/events', {
      req,
      query: {
        catalog: req.query.catalog ? String(req.query.catalog) : 'official',
        page: req.query.page ? Number(req.query.page) : 1,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/wrestling/event', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ ok: false, error: 'url is required' });
    const data = await framexGet('/v1/wrestling/event', {
      req,
      noCache: true,
      query: {
        url,
        resolve: req.query.resolve ? String(req.query.resolve) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/wrestling/stream', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ ok: false, error: 'url is required' });
    const data = await framexGet('/v1/wrestling/stream', {
      req,
      noCache: true,
      query: { url },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ========================
// SPORTS: GOALNIVO
// ========================
framexRouter.get('/sports/aggregate', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/aggregate', {
      req,
      query: { sportType: req.query.sportType ? String(req.query.sportType) : 'football' },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/recommendations', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/recommendations', {
      req,
      query: { sportType: req.query.sportType ? String(req.query.sportType) : 'football' },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/highlight-banner', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/highlight-banner', {
      req,
      query: { sportType: req.query.sportType ? String(req.query.sportType) : 'football' },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/resources', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/resources', {
      req,
      query: {
        resourceType: req.query.resourceType ? String(req.query.resourceType) : undefined,
        sportType: req.query.sportType ? String(req.query.sportType) : 'football',
        leagueId: req.query.leagueId ? String(req.query.leagueId) : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        perPage: req.query.perPage ? Number(req.query.perPage) : 20,
      },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/matches', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/matches', {
      req,
      query: {
        startTime: req.query.startTime ? String(req.query.startTime) : undefined,
        endTime: req.query.endTime ? String(req.query.endTime) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        matchType: req.query.matchType ? String(req.query.matchType) : undefined,
      },
      cacheTtlMs: 20_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/ongoing', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/ongoing', {
      req,
      noCache: true,
      query: {
        startTime: req.query.startTime ? String(req.query.startTime) : undefined,
        endTime: req.query.endTime ? String(req.query.endTime) : undefined,
        matchType: req.query.matchType ? String(req.query.matchType) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/replays', async (req, res) => {
  try {
    const data = await framexGet('/v1/sports/replays', {
      req,
      noCache: true,
      query: {
        startTime: req.query.startTime ? String(req.query.startTime) : undefined,
        endTime: req.query.endTime ? String(req.query.endTime) : undefined,
        matchType: req.query.matchType ? String(req.query.matchType) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/replay', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/replay', {
      req,
      noCache: true,
      query: { matchId },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/detail', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/detail', {
      req,
      query: { matchId },
      cacheTtlMs: 20_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/rankings', async (req, res) => {
  try {
    const leagueId = String(req.query.leagueId || '').trim();
    if (!leagueId) return res.status(400).json({ ok: false, error: 'leagueId is required' });
    const data = await framexGet('/v1/sports/rankings', {
      req,
      query: { leagueId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/h2h', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/h2h', {
      req,
      query: { matchId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/stats', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/stats', {
      req,
      query: { matchId },
      cacheTtlMs: 15_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/events', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/events', {
      req,
      query: { matchId },
      cacheTtlMs: 15_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/lineups', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/lineups', {
      req,
      query: { matchId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/sports/match-flow', async (req, res) => {
  try {
    const matchId = String(req.query.matchId || req.query.id || '').trim();
    if (!matchId) return res.status(400).json({ ok: false, error: 'matchId is required' });
    const data = await framexGet('/v1/sports/match-flow', {
      req,
      noCache: true,
      query: {
        matchId,
        lastSort: req.query.lastSort ? String(req.query.lastSort) : undefined,
        pageSize: req.query.pageSize ? String(req.query.pageSize) : undefined,
      },
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ========================
// NOVELS: NOVELHUB & NOVELSTORE
// ========================
framexRouter.get('/novels/home', async (req, res) => {
  try {
    const data = await framexGet('/v1/novels/home', {
      req,
      query: {
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/search', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.keyword || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'q is required' });
    const data = await framexGet('/v1/novels/search', {
      req,
      query: {
        q,
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/suggestions', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.keyword || '').trim();
    if (!q) return res.json({ suggestions: [] });
    const data = await framexGet('/v1/novels/suggestions', {
      req,
      query: { q, size: req.query.size ? Number(req.query.size) : 8 },
      cacheTtlMs: 30_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/detail', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || req.query.novelId || req.query.id || '').trim();
    if (!contentId) return res.status(400).json({ ok: false, error: 'contentId is required' });
    const data = await framexGet('/v1/novels/detail', {
      req,
      query: { contentId },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/chapters', async (req, res) => {
  try {
    const contentId = String(req.query.contentId || req.query.novelId || req.query.id || '').trim();
    if (!contentId) return res.status(400).json({ ok: false, error: 'contentId is required' });
    const data = await framexGet('/v1/novels/chapters', {
      req,
      query: {
        contentId,
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 50,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/chapter', async (req, res) => {
  try {
    const chapterId = String(req.query.chapterId || '').trim();
    if (!chapterId) return res.status(400).json({ ok: false, error: 'chapterId is required' });
    const data = await framexGet('/v1/novels/chapter', {
      req,
      query: { chapterId },
      cacheTtlMs: 120_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/recommendations', async (req, res) => {
  try {
    const data = await framexGet('/v1/novels/recommendations', {
      req,
      query: {
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/operations', async (req, res) => {
  try {
    const data = await framexGet('/v1/novels/operations', {
      req,
      query: {
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/rank-groups', async (req, res) => {
  try {
    const data = await framexGet('/v1/novels/rank-groups', {
      req,
      query: {
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/genres', async (req, res) => {
  try {
    const data = await framexGet('/v1/novels/genres', {
      req,
      query: {
        genreId: req.query.genreId ? String(req.query.genreId) : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

framexRouter.get('/novels/store', async (req, res) => {
  try {
    const data = await framexGet('/v1/novelstore/groups', {
      req,
      query: {
        opConfId: req.query.opConfId ? Number(req.query.opConfId) : 5,
        page: req.query.page ? Number(req.query.page) : 1,
        size: req.query.size ? Number(req.query.size) : 20,
      },
      cacheTtlMs: 60_000,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});
