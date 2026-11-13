import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="glass-surface-elevated w-full max-w-md rounded-3xl p-6 sm:p-8 relative">
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          aria-label="Close authentication modal"
          className="glass-btn absolute top-5 right-5 w-10 h-10 rounded-xl flex items-center justify-center text-rose-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1.5 mb-6">
          <h2 id="auth-modal-title" className="font-display text-2xl font-bold text-white">
            {mode === 'login' ? 'Sign In to LUPIN MOVIES' : 'Create Your Account'}
          </h2>
          <p className="text-sm text-rose-100/65">
            Sync your watchlist, favorites, watch progress, and novel reading history.
          </p>
        </div>

        {/* Segmented Tab */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/35 border border-rose-200/10 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-rose-700/80 text-white'
                : 'text-rose-100/65 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-rose-700/80 text-white'
                : 'text-rose-100/65 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label htmlFor="auth-name" className="block text-xs font-medium text-rose-100/80">
                Display Name
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Arsène Lupin"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-black/40 border border-rose-200/15 text-sm text-white placeholder:text-rose-100/35 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="block text-xs font-medium text-rose-100/80">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="viewer@lupinmovies.com"
              required
              autoComplete="email"
              className="w-full h-11 px-3.5 rounded-xl bg-black/40 border border-rose-200/15 text-sm text-white placeholder:text-rose-100/35 focus:outline-none focus:border-rose-400"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="block text-xs font-medium text-rose-100/80">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full h-11 px-3.5 rounded-xl bg-black/40 border border-rose-200/15 text-sm text-white placeholder:text-rose-100/35 focus:outline-none focus:border-rose-400"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="glass-btn-primary w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
