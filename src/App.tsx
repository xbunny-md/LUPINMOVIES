import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar, type AppRoute } from './components/Navbar';
import { TitleDetailModal } from './components/TitleDetailModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { AnimePage } from './pages/AnimePage';
import { LiveSportsPage } from './pages/LiveSportsPage';
import { NovelsPage } from './pages/NovelsPage';
import { LibraryPage } from './pages/LibraryPage';
import type { ActivePlaybackTarget, MediaItem } from './types/framex';

function LupinShell() {
  const [route, setRoute] = useState<AppRoute>('home');
  const [selectedTitle, setSelectedTitle] = useState<MediaItem | null>(null);
  const [playbackTarget, setPlaybackTarget] = useState<ActivePlaybackTarget | null>(null);

  const navigate = (next: AppRoute) => {
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="lupin-canvas min-h-screen flex flex-col pb-20 md:pb-8">
      <Navbar currentRoute={route} onNavigate={navigate} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {route === 'home' && (
          <HomePage
            onSelectTitle={setSelectedTitle}
            onPlayTarget={setPlaybackTarget}
            onNavigate={navigate}
          />
        )}
        {route === 'discover' && <DiscoverPage onSelectTitle={setSelectedTitle} />}
        {route === 'anime' && <AnimePage onPlay={setPlaybackTarget} />}
        {route === 'live' && <LiveSportsPage onPlay={setPlaybackTarget} />}
        {route === 'novels' && <NovelsPage />}
        {route === 'library' && (
          <LibraryPage
            onSelectTitle={setSelectedTitle}
            onPlayTarget={setPlaybackTarget}
          />
        )}
      </main>

      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-14 pt-6 border-t border-rose-200/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-rose-100/50">
        <span>LUPIN MOVIES · Dark Glassmorphism Streaming Ecosystem</span>
        <span>Powered by FRAMEX Media APIs</span>
      </footer>

      <TitleDetailModal
        item={selectedTitle}
        onClose={() => setSelectedTitle(null)}
        onPlay={(target) => {
          setSelectedTitle(null);
          setPlaybackTarget(target);
        }}
        onSelectRelated={(item) => setSelectedTitle(item)}
      />

      <VideoPlayerModal
        target={playbackTarget}
        onClose={() => setPlaybackTarget(null)}
      />

      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LupinShell />
    </AuthProvider>
  );
}
