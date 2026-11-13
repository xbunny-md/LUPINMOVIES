import type { Request } from 'express';

const FRAMEX_BASE_URL = 'https://framex.wolvarex.com/api';
const FRAMEX_API_KEY =
  process.env.FRAMEX_API_KEY ||
  'fxk_live_c134ff3116d29f33a97b2c29245734b90e883abeb760259d';

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// Short TTL cache strictly for static discovery/catalog metadata (never temporary playback URLs)
const catalogCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 45_000;

export class FramexApiError extends Error {
  status: number;
  code: string;
  isDomainRestriction: boolean;
  detectedOrigin?: string;

  constructor(
    status: number,
    message: string,
    code = 'FRAMEX_ERROR',
    isDomainRestriction = false,
    detectedOrigin?: string
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.isDomainRestriction = isDomainRestriction;
    this.detectedOrigin = detectedOrigin;
  }
}

export function extractRequestOrigin(req?: Request): {
  origin?: string;
  referer?: string;
  hostLabel?: string;
} {
  if (!req) {
    const appUrl = process.env.APP_URL;
    if (appUrl && appUrl.startsWith('http')) {
      return { origin: appUrl, referer: `${appUrl}/`, hostLabel: new URL(appUrl).hostname };
    }
    return {};
  }

  const rawOrigin = req.get('origin');
  const rawReferer = req.get('referer');
  const forwardedHost = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';

  let origin = rawOrigin;
  if (!origin && rawReferer) {
    try {
      origin = new URL(rawReferer).origin;
    } catch {
      // ignore invalid referer
    }
  }
  if (!origin && forwardedHost) {
    origin = `${proto}://${forwardedHost}`;
  }

  let hostLabel = forwardedHost;
  if (!hostLabel && origin) {
    try {
      hostLabel = new URL(origin).hostname;
    } catch {
      // ignore
    }
  }

  return {
    origin,
    referer: rawReferer || (origin ? `${origin}/` : undefined),
    hostLabel,
  };
}

export interface FramexRequestOptions {
  req?: Request;
  query?: Record<string, string | number | boolean | undefined | null>;
  cacheTtlMs?: number;
  noCache?: boolean;
  timeoutMs?: number;
}

export async function framexGet<T = unknown>(
  endpointPath: string,
  options: FramexRequestOptions = {}
): Promise<T> {
  const { req, query, cacheTtlMs = 0, noCache = false, timeoutMs = 15_000 } = options;

  const url = new URL(`${FRAMEX_BASE_URL}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const cacheKey = url.toString();
  if (!noCache && cacheTtlMs > 0) {
    const cached = catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const { origin, referer, hostLabel } = extractRequestOrigin(req);
  const headers: Record<string, string> = {
    'X-API-Key': FRAMEX_API_KEY,
    Accept: 'application/json',
  };
  if (origin) headers['Origin'] = origin;
  if (referer) headers['Referer'] = referer;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = { raw: rawText };
    }

    if (!response.ok) {
      const rawErr =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? (parsed as { error?: unknown }).error
          : parsed && typeof parsed === 'object' && 'message' in parsed
            ? (parsed as { message?: unknown }).message
            : null;
      const errorMsg: string =
        typeof rawErr === 'string' && rawErr.trim()
          ? rawErr
          : `FRAMEX request failed with status ${response.status}`;

      const isDomainRestriction =
        response.status === 403 &&
        errorMsg.toLowerCase().includes('domain');

      throw new FramexApiError(
        response.status,
        errorMsg,
        isDomainRestriction ? 'DOMAIN_NOT_ALLOWED' : `HTTP_${response.status}`,
        isDomainRestriction,
        hostLabel || origin
      );
    }

    if (!noCache && cacheTtlMs > 0) {
      catalogCache.set(cacheKey, {
        data: parsed,
        expiresAt: Date.now() + (cacheTtlMs || DEFAULT_CACHE_TTL_MS),
      });
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof FramexApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FramexApiError(504, 'FRAMEX upstream request timed out', 'UPSTREAM_TIMEOUT');
    }
    throw new FramexApiError(
      502,
      err instanceof Error ? err.message : 'Unable to reach FRAMEX upstream service',
      'UPSTREAM_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}
