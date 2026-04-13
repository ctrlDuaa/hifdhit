import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/logo.png';
export const AppHeader = () => {
  const {
    signOut
  } = useAuth();
  return <header className="border-b bg-card">
      <div className="container mx-auto px-4 bg-[linear-gradient(90deg,#C6A477,#2a363b)] py-[8px]">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 bg-transparent py-3 rounded-lg">
            <h1 className="text-2xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity">Hifdh it</h1>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={signOut} className="bg-[#c6a477]">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>;
};