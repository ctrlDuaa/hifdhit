import { Button } from '@/components/ui/button';
import { LogOut, Link2, Bookmark, BookMarked, Library, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { startQfLogin, isQfSessionValid, logoutQf } from '@/services/qfAuth';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BookmarksPanel } from '@/components/BookmarksPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const AppHeader = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [qfConnected, setQfConnected] = useState(() => isQfSessionValid(user?.id || null));
  const [qfLoading, setQfLoading] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  useEffect(() => {
    setQfConnected(isQfSessionValid(user?.id || null));
    setQfLoading(false);
    setBenefitsOpen(false);
    setBookmarksOpen(false);
  }, [user?.id]);

  const handleQfConnect = async () => {
    setQfLoading(true);
    try {
      await startQfLogin();
    } catch (err) {
      console.error('Failed to start QF login:', err);
      setQfLoading(false);
      toast({
        title: 'Connection Failed',
        description: err instanceof Error ? err.message : 'Failed to connect to Quran.com',
        variant: 'destructive',
      });
    }
  };

  const handleQfDisconnect = () => {
    logoutQf();
    setQfConnected(false);
  };

  return (
    <>
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 bg-[linear-gradient(90deg,#C6A477,#2a363b)] py-[8px]">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 bg-transparent py-3 rounded-lg">
            <h1 className="text-2xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity">Hifdh it</h1>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {qfConnected && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setBookmarksOpen(true)}
                className="bg-[#c6a477] h-9 w-9"
                aria-label="Open collections"
                title="Your collections"
              >
                <Bookmark className="w-4 h-4" />
              </Button>
            )}
            {qfConnected ? (
              <Button variant="outline" size="sm" onClick={handleQfDisconnect} className="text-xs bg-[#c6a477]">
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Quran.com ✓
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBenefitsOpen(true)}
                disabled={qfLoading}
                className="text-xs bg-[#c6a477]"
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                {qfLoading ? 'Connecting...' : 'Connect Quran.com'}
              </Button>
            )}
            <Button variant="outline" onClick={signOut} className="bg-[#c6a477]">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
    <BookmarksPanel open={bookmarksOpen} onOpenChange={setBookmarksOpen} />

    <Dialog open={benefitsOpen} onOpenChange={setBenefitsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Quran.com Account</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Link your Quran.com account to unlock a seamless memorization experience.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0">
              <BookMarked className="w-5 h-5 text-[#C6A477]" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Save meaningful ayat as you memorize — revisit them later on Quran.com to explore tafsir, reflect deeper, and make personal connections.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0">
              <Library className="w-5 h-5 text-[#C6A477]" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Your saved ayat, now ready for hifdh — seamlessly import collections from Quran.com and begin memorizing what matters to you.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0">
              <SlidersHorizontal className="w-5 h-5 text-[#C6A477]" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Your hifdh, your preferences — automatically sync your preferred reciter, translation, and language from Quran.com for a personalized memorization experience.
            </p>
          </div>
        </div>
        <Button
          onClick={handleQfConnect}
          disabled={qfLoading}
          className="w-full bg-[#C6A477] hover:bg-[#b8956a] text-white"
        >
          <Link2 className="w-4 h-4 mr-2" />
          {qfLoading ? 'Connecting...' : 'Connect to Quran.com'}
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
};
