/**
 * @file src/components/layout/AppLayout.tsx
 * @description Authenticated app shell — sidebar + topbar + main content area.
 * Used by DashboardPage, WorksheetPage, ReportsPage, etc.
 */

import * as React from 'react';
import { Link, useLocation } from 'react-router';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';

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

const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const SidebarContent: React.FC = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border shrink-0">
        <Link to="/" onClick={() => setSidebarOpen(false)}>
          <Logo size="sm" />
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

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl bg-surface">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            <GraduationCap className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">Student</p>
            <p className="text-xs text-muted-foreground truncate">Grade 7</p>
          </div>
          <button
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
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
            <button
              className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              PS
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
