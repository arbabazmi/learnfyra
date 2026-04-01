/**
 * @file src/components/layout/AppLayout.tsx
 * @description Authenticated app shell — sidebar + topbar + main content area.
 * Used by DashboardPage, WorksheetPage, ReportsPage, etc.
 */

import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Award,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  GraduationCap,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Worksheets',  href: '/worksheet',  icon: FileText,        badge: '3' },
  { label: 'Reports',     href: '/reports',    icon: BarChart3 },
  { label: 'Achievements',href: '/achievements',icon: Award },
];

const bottomItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
  /** Page heading shown in the topbar */
  pageTitle?: string;
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleSignOut = () => {
    auth.signOut();
    navigate('/', { replace: true });
  };
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  // Close notification dropdown on outside click
  React.useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const SidebarContent: React.FC = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border shrink-0">
        <Link to="/" onClick={() => setSidebarOpen(false)}>
          <Logo size="lg" />
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Sidebar navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                active
                  ? 'bg-primary-light text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('size-4.5 shrink-0', active ? 'text-primary' : '')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav + user */}
      <div className="px-3 py-4 border-t border-border space-y-0.5 shrink-0">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150',
                active
                  ? 'bg-primary-light text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* User row — auth-aware */}
        {auth.isAuthenticated && auth.user ? (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl bg-surface">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
              <GraduationCap className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{auth.user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{auth.user.role}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl bg-primary-light text-primary text-sm font-bold hover:bg-primary/10 transition-colors"
          >
            <UserPlus className="size-4 shrink-0" />
            Sign in to save progress
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-white">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-border flex flex-col',
          'transition-transform duration-300 ease-in-out lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Mobile sidebar"
      >
        <button
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="size-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 sm:px-6 bg-white border-b border-border shrink-0">
          {/* Mobile sidebar toggle */}
          <button
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-4" />
          </button>

          {/* Page title */}
          {pageTitle && (
            <h1 className="text-[15px] font-extrabold text-foreground">{pageTitle}</h1>
          )}

          <div className="flex-1" />

          {/* Topbar actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell with dropdown */}
            <div ref={notifRef} className="relative">
              <button
                className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Notifications"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="size-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-border shadow-xl p-4 z-50">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Notifications</p>
                  <p className="text-sm text-muted-foreground">No new notifications</p>
                </div>
              )}
            </div>
            {/* User avatar — dynamic initials */}
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              {getInitials(auth.user?.displayName)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export { AppLayout };
