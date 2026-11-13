import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.ts';

export const localRouter = Router();

const SESSION_COOKIE = 'lupin_session';
const SESSION_DAYS = 14;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie || '';
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

interface SessionUser {
  id: number;
  email: string;
  name: string;
  preferred_quality: string;
  preferred_subtitle_lang: string;
  preferred_audio_lang: string;
  created_at: string;
}

function getAuthenticatedUser(req: Request): SessionUser | null {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.preferred_quality, u.preferred_subtitle_lang, u.preferred_audio_lang, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as SessionUser | undefined;

  return row || null;
}

function createSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 86400_000,
    path: '/',
  });
}

// Auth: Register
localRouter.post('/auth/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim() || email.split('@')[0];

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(email, name, passwordHash);

  const userId = Number(result.lastInsertRowid);
  createSession(res, userId);

  const user = db
    .prepare(
      'SELECT id, email, name, preferred_quality, preferred_subtitle_lang, preferred_audio_lang, created_at FROM users WHERE id = ?'
    )
    .get(userId);

  res.status(201).json({ user });
});

// Auth: Login
localRouter.post('/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const row = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(email) as { id: number; password_hash: string } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  createSession(res, row.id);
  const user = db
    .prepare(
      'SELECT id, email, name, preferred_quality, preferred_subtitle_lang, preferred_audio_lang, created_at FROM users WHERE id = ?'
    )
    .get(row.id);

  res.json({ user });
});

// Auth: Current user
localRouter.get('/auth/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  res.json({ user });
});

// Auth: Logout
localRouter.post('/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Profile & Preferences
localRouter.patch('/auth/profile', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const name = req.body?.name ? String(req.body.name).trim() : user.name;
  const preferred_quality = req.body?.preferred_quality
    ? String(req.body.preferred_quality)
    : user.preferred_quality;
  const preferred_subtitle_lang = req.body?.preferred_subtitle_lang
    ? String(req.body.preferred_subtitle_lang)
    : user.preferred_subtitle_lang;
  const preferred_audio_lang = req.body?.preferred_audio_lang
    ? String(req.body.preferred_audio_lang)
    : user.preferred_audio_lang;

  db.prepare(
    `UPDATE users SET name = ?, preferred_quality = ?, preferred_subtitle_lang = ?, preferred_audio_lang = ? WHERE id = ?`
  ).run(name, preferred_quality, preferred_subtitle_lang, preferred_audio_lang, user.id);

  const updated = db
    .prepare(
      'SELECT id, email, name, preferred_quality, preferred_subtitle_lang, preferred_audio_lang, created_at FROM users WHERE id = ?'
    )
    .get(user.id);

  res.json({ user: updated });
});

// Personal Library (Watchlist & Favorites)
localRouter.get('/library', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.json({ items: [], progress: [], reading: [] });

  const items = db
    .prepare('SELECT * FROM library_items WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);

  const progress = db
    .prepare('SELECT * FROM watch_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 40')
    .all(user.id);

  const reading = db
    .prepare('SELECT * FROM reading_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30')
    .all(user.id);

  res.json({ items, progress, reading });
});

localRouter.post('/library/toggle', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to sync your personal library.' });

  const list_type = req.body?.list_type === 'favorite' ? 'favorite' : 'watchlist';
  const media_type = String(req.body?.media_type || 'movie');
  const item_id = String(req.body?.item_id || '').trim();
  const slug = String(req.body?.slug || item_id).trim();
  const provider = String(req.body?.provider || 'moviebox');
  const title = String(req.body?.title || 'Untitled');
  const poster = req.body?.poster ? String(req.body.poster) : null;
  const year = req.body?.year ? String(req.body.year) : null;
  const metadata_json = req.body?.metadata ? JSON.stringify(req.body.metadata) : null;

  if (!item_id) return res.status(400).json({ error: 'item_id is required' });

  const existing = db
    .prepare(
      'SELECT id FROM library_items WHERE user_id = ? AND list_type = ? AND item_id = ? AND media_type = ?'
    )
    .get(user.id, list_type, item_id, media_type) as { id: number } | undefined;

  if (existing) {
    db.prepare('DELETE FROM library_items WHERE id = ?').run(existing.id);
    return res.json({ active: false });
  }

  db.prepare(
    `INSERT INTO library_items (user_id, list_type, media_type, item_id, slug, provider, title, poster, year, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, list_type, media_type, item_id, slug, provider, title, poster, year, metadata_json);

  res.json({ active: true });
});

// Watch Progress (Continue Watching & Recently Watched)
localRouter.post('/progress/watch', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.json({ ok: false, guest: true });

  const content_id = String(req.body?.content_id || '').trim();
  if (!content_id) return res.status(400).json({ error: 'content_id is required' });

  const slug = String(req.body?.slug || content_id);
  const provider = String(req.body?.provider || 'moviebox');
  const media_type = String(req.body?.media_type || 'movie');
  const title = String(req.body?.title || 'Untitled');
  const poster = req.body?.poster ? String(req.body.poster) : null;
  const season = Number(req.body?.season || 0);
  const episode = Number(req.body?.episode || 0);
  const position_seconds = Math.max(0, Number(req.body?.position_seconds || 0));
  const duration_seconds = Math.max(0, Number(req.body?.duration_seconds || 0));

  db.prepare(
    `INSERT INTO watch_progress
       (user_id, content_id, slug, provider, media_type, title, poster, season, episode, position_seconds, duration_seconds, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, content_id, media_type, season, episode)
     DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       poster = COALESCE(excluded.poster, watch_progress.poster),
       position_seconds = excluded.position_seconds,
       duration_seconds = excluded.duration_seconds,
       updated_at = datetime('now')`
  ).run(
    user.id,
    content_id,
    slug,
    provider,
    media_type,
    title,
    poster,
    season,
    episode,
    position_seconds,
    duration_seconds
  );

  res.json({ ok: true });
});

// Reading Progress (Novels)
localRouter.post('/progress/reading', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.json({ ok: false, guest: true });

  const novel_id = String(req.body?.novel_id || '').trim();
  const chapter_id = String(req.body?.chapter_id || '').trim();
  if (!novel_id || !chapter_id) {
    return res.status(400).json({ error: 'novel_id and chapter_id are required' });
  }

  const novel_title = String(req.body?.novel_title || 'Untitled Novel');
  const cover = req.body?.cover ? String(req.body.cover) : null;
  const chapter_title = String(req.body?.chapter_title || 'Chapter');
  const progress_percent = Math.min(100, Math.max(0, Number(req.body?.progress_percent || 0)));

  db.prepare(
    `INSERT INTO reading_progress
       (user_id, novel_id, novel_title, cover, chapter_id, chapter_title, progress_percent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, novel_id)
     DO UPDATE SET
       novel_title = excluded.novel_title,
       cover = COALESCE(excluded.cover, reading_progress.cover),
       chapter_id = excluded.chapter_id,
       chapter_title = excluded.chapter_title,
       progress_percent = excluded.progress_percent,
       updated_at = datetime('now')`
  ).run(user.id, novel_id, novel_title, cover, chapter_id, chapter_title, progress_percent);

  res.json({ ok: true });
});
