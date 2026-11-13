export class ApiClientError extends Error {
  status: number;
  code?: string;
  isDomainRestriction: boolean;
  detectedOrigin?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
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

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errMessage =
      (data && typeof data.error === 'string' && data.error) ||
      (data && typeof data.message === 'string' && data.message) ||
      `Request failed (${res.status})`;
    throw new ApiClientError(
      res.status,
      errMessage,
      data && typeof data.code === 'string' ? data.code : undefined,
      Boolean(data && data.isDomainRestriction),
      data && typeof data.detectedOrigin === 'string' ? data.detectedOrigin : undefined
    );
  }

  return data as T;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
