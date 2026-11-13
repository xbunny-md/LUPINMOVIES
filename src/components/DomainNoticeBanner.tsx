import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { ApiClientError } from '../lib/api';

interface DomainNoticeBannerProps {
  error: unknown;
  onRetry?: () => void;
}

export function DomainNoticeBanner({ error, onRetry }: DomainNoticeBannerProps) {
  if (!error) return null;

  const isApiErr = error instanceof ApiClientError;
  const isDomain = isApiErr && error.isDomainRestriction;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unable to reach media catalog.';
  const originHost =
    (isApiErr && error.detectedOrigin) ||
    (typeof window !== 'undefined' ? window.location.hostname : '');

  return (
    <div
      role="alert"
      className="glass-surface-elevated rounded-2xl p-5 sm:p-6 border border-rose-500/25 text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center shrink-0 text-rose-300">
            {isDomain ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              {isDomain
                ? 'FRAMEX API Key Domain Authorization Required'
                : 'Media Service Temporarily Unavailable'}
            </h3>
            <p className="text-sm text-rose-100/75 leading-relaxed">
              {message}
            </p>
            {isDomain && originHost && (
              <p className="text-xs text-rose-200/70 leading-relaxed pt-1">
                Authorize <code className="font-mono text-amber-200 bg-black/40 px-1.5 py-0.5 rounded">{originHost}</code> in your FRAMEX API key settings under Allowed Domains, then retry.
              </p>
            )}
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="glass-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shrink-0 min-h-[44px] whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}
