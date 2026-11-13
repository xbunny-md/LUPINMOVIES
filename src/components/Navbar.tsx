import { Bookmark, Compass, Film, Home, Radio, Sparkles, BookOpen, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type AppRoute = 'home' | 'discover' | 'anime' | 'live' | 'novels' | 'library';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const NAV_LINKS: Array<{ id: AppRoute; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'anime', label: 'Anime' },
  { id: 'live', label: 'Live & Sports' },
  { id: 'novels', label: 'Novels' },
];

const MOBILE_TABS: Array<{ id: AppRoute; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'anime', label: 'Anime', icon: Sparkles },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'library', label: 'Library', icon: Bookmark },
];

export function Navbar({ currentRoute, onNavigate }: NavbarProps) {
  const { user } = useAuth();

  return (
    <>
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="glass-nav sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-lg"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-600 to-rose-900 border border-rose-300/30 flex items-center justify-center shadow-sm">
              <Film className="w-4 h-4 text-white" />
            </span>
            <span>LUPIN MOVIES</span>
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_LINKS.map((link) => {
              const active = currentRoute === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate(link.id)}
                  className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded ${
                    active ? 'text-white' : 'text-rose-100/65 hover:text-white'
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-gradient-to-r from-rose-500 to-amber-300 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action (Library / Account) */}
          <div className="flex items-center shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('novels')}
              aria-label="Novels"
              className={`md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
                currentRoute === 'novels' ? 'bg-rose-600/30 text-white' : 'text-rose-100/75 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 min-h-[40px] inline-flex items-center gap-2 cursor-pointer transition-all ${
                currentRoute === 'library'
                  ? 'glass-btn-primary text-white'
                  : 'glass-btn text-rose-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{user ? user.name.split(' ')[0] : 'Library'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Bar (keeps aggregate sticky <= 15% of mobile viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-rose-200/10 border-b-0"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = currentRoute === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  active ? 'text-rose-400' : 'text-rose-100/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
