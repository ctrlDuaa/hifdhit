import { Button } from '@/components/ui/button';
import { LogOut, Link2, Bookmark } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { startQfLogin, isQfSessionValid, logoutQf } from '@/services/qfAuth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BookmarksPanel } from '@/components/BookmarksPanel';

export const AppHeader = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [qfConnected, setQfConnected] = useState(isQfSessionValid());
  const [qfLoading, setQfLoading] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

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
                onClick={handleQfConnect}
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
  );
};
