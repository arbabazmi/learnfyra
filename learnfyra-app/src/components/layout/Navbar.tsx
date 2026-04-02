/**
 * @file src/components/layout/Navbar.tsx
 * @description Landing page sticky navbar.
 *
 * - Logo: image only (no redundant text — logo contains branding)
 * - Anchor links: smooth-scroll to landing page sections
 * - Sign In: opens AuthModal at sign-in step
 * - Get Started: opens AuthModal at role-selection step
 * - Mobile: full hamburger menu with same links
 */

import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';

function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, '').trim() || 'Student';
}

interface NavItem {
  label: string;
  href: string;
  /** true = anchor scroll, false = page route */
  anchor: boolean;
}

const navItems: NavItem[] = [
  { label: 'Features',     href: '#features',      anchor: true  },
  { label: 'How It Works', href: '#how-it-works',  anchor: true  },
  { label: 'For Schools',  href: '#for-schools',   anchor: true  },
  { label: 'Dashboard',    href: '/dashboard',     anchor: false },
];

interface NavbarProps {
  onSignIn?: () => void;
  onTryWorksheet?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSignIn, onTryWorksheet }) => {
  const [isOpen, setIsOpen]   = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSignOut = () => {
    auth.signOut();
    navigate('/', { replace: true });
  };

  // Scroll-aware shadow / backdrop
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on navigation
  React.useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const handleItemClick = (item: NavItem) => {
    setIsOpen(false);
    if (item.anchor) {
      // Only scroll if on the landing page; otherwise navigate home first
      if (location.pathname === '/') {
        const el = document.querySelector(item.href);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const linkClass = cn(
    'px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150',
    'text-muted-foreground hover:text-foreground hover:bg-muted',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-white/90 backdrop-blur-sm border-b border-border/60',
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo — image only, no text ──────────────────── */}
          <Link
            to="/"
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 py-1"
            aria-label="Learnfyra home"
          >
            <Logo size="nav" />
          </Link>

          {/* ── Desktop nav links ────────────────────────────── */}
          <div className="hidden md:flex items-center gap-0.5" role="menubar">
            {navItems.map((item) =>
              item.anchor ? (
                <button
                  key={item.href}
                  role="menuitem"
                  onClick={() => handleItemClick(item)}
                  className={linkClass}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  role="menuitem"
                  className={cn(
                    linkClass,
                    location.pathname.startsWith(item.href) && 'text-primary bg-primary-light',
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>

          {/* ── Desktop CTAs ─────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-3">
            {auth.isAuthenticated && auth.user ? (
              <>
                <Link
                  to="/dashboard"
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
                    'text-foreground hover:bg-muted',
                  )}
                >
                  <User className="size-4" />
                  {sanitizeName(auth.user.displayName || 'Student')}
                </Link>
                <Button variant="ghost" size="md" onClick={handleSignOut}>
                  <LogOut className="size-4 mr-1.5" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="md" onClick={onSignIn}>
                  Sign In
                </Button>
                <Button variant="primary" size="md" onClick={onTryWorksheet}>
                  Try a Worksheet
                </Button>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ─────────────────────────────── */}
          <button
            className={cn(
              'md:hidden flex items-center justify-center w-10 h-10 rounded-lg',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            onClick={() => setIsOpen((v) => !v)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* ── Mobile menu ──────────────────────────────────────── */}
        <div
          id="mobile-menu"
          className={cn(
            'md:hidden overflow-hidden transition-all duration-300 ease-in-out',
            isOpen ? 'max-h-[28rem] pb-4' : 'max-h-0',
          )}
        >
          <div className="flex flex-col gap-1 pt-2 border-t border-border">
            {navItems.map((item) =>
              item.anchor ? (
                <button
                  key={item.href}
                  onClick={() => handleItemClick(item)}
                  className={cn(linkClass, 'text-left')}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    linkClass,
                    location.pathname.startsWith(item.href) && 'text-primary bg-primary-light',
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
              {auth.isAuthenticated && auth.user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-foreground rounded-lg hover:bg-muted transition-colors"
                  >
                    <User className="size-4" />
                    {sanitizeName(auth.user.displayName || 'Student')}
                  </Link>
                  <Button variant="ghost" size="md" className="justify-center" onClick={() => { setIsOpen(false); handleSignOut(); }}>
                    <LogOut className="size-4 mr-1.5" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="md" className="justify-center" onClick={() => { setIsOpen(false); onSignIn?.(); }}>
                    Sign In
                  </Button>
                  <Button variant="primary" size="md" className="justify-center" onClick={() => { setIsOpen(false); onTryWorksheet?.(); }}>
                    Try a Worksheet
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export { Navbar };
