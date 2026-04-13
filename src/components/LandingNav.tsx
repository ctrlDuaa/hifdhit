import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

interface LandingNavProps {
  onLoginClick: () => void;
  onSignUpClick: () => void;
}

export const LandingNav = ({ onLoginClick, onSignUpClick }: LandingNavProps) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-[60px] transition-all duration-300 ${
        isScrolled
          ? 'bg-gradient-to-r from-[#2a363b]/20 to-[#2a363b]/15 backdrop-blur-sm shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: '#C6A477' }}>
            Hifdh it
          </span>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onLoginClick}
            variant="ghost"
            className="rounded-full px-6 text-white hover:bg-white/10 transition-all duration-200"
          >
            Log In
          </Button>
          <Button
            onClick={onSignUpClick}
            className="rounded-full px-6 bg-gradient-to-r from-[#C6A477] to-[#DFCEBF] text-white hover:opacity-90 transition-all duration-200"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </nav>
  );
};
