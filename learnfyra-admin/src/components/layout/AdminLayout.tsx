/**
 * @file src/components/layout/AdminLayout.tsx
 * @description Persistent shell rendered around every authenticated page.
 * Provides a collapsible sidebar (mobile overlay / desktop pinned), a thin
 * top header with the role badge, and a scrollable main area via <Outlet />.
 *
 * Navigation items are split into two groups:
 *  - platformNavItems — visible to platform admins (super_admin | admin)
 *  - schoolNavItems   — visible to all admin roles
 */
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, DollarSign, Settings, School,
  ScrollText, ShieldCheck, Menu, LogOut, ChevronDown,
  GraduationCap, ClipboardList, Wrench, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const platformNavItems: NavItem[] = [
  { label: 'Dashboard',       path: '/dashboard',      icon: LayoutDashboard },
  { label: 'Users',           path: '/users',          icon: Users           },
  { label: 'Question Bank',   path: '/question-bank',  icon: BookOpen        },
  { label: 'Cost Dashboard',  path: '/cost',           icon: DollarSign      },
  { label: 'Configuration',   path: '/config',         icon: Settings        },
  { label: 'Schools',         path: '/schools',        icon: School          },
  { label: 'Audit Log',       path: '/audit-log',      icon: ScrollText      },
  { label: 'Compliance Log',  path: '/compliance-log', icon: ShieldCheck     },
];

const schoolNavItems: NavItem[] = [
  { label: 'Overview',     path: '/school',              icon: BarChart3      },
  { label: 'Teachers',     path: '/school/teachers',     icon: GraduationCap  },
  { label: 'Students',     path: '/school/students',     icon: Users          },
  { label: 'Bulk Assign',  path: '/school/bulk-assign',  icon: ClipboardList  },
  { label: 'Settings',     path: '/school/config',       icon: Wrench         },
];

/**
 * Renders a labelled group of NavLink items.
 *
 * @param items - Array of nav item definitions
 * @param title - Section heading shown above the links
 * @param onNavigate - Callback fired after a link is clicked (used to close
 *                     the mobile sidebar)
 */
function NavGroup({
  items,
  title,
  onNavigate,
}: {
  items: NavItem[];
  title: string;
  onNavigate: () => void;
}) {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground'
    );

  return (
    <div className="mb-6">
      <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
        {title}
      </p>
      <nav className="space-y-1">
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/school'}
            className={navLinkClass}
            onClick={onNavigate}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/**
 * Full-page layout shell.
 * Renders the sidebar on the left and the routed page content on the right.
 * The sidebar collapses to an overlay on screens narrower than lg (1024 px).
 */
export function AdminLayout() {
  const { user, logout, isPlatformAdmin, isSchoolAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          L
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground">Learnfyra</p>
          <p className="text-xs text-sidebar-muted-foreground">Admin Console</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {isPlatformAdmin && (
          <NavGroup items={platformNavItems} title="Platform" onNavigate={closeSidebar} />
        )}
        {(isPlatformAdmin || isSchoolAdmin) && (
          <NavGroup items={schoolNavItems} title="School" onNavigate={closeSidebar} />
        )}
      </div>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(prev => !prev)}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm hover:bg-sidebar-muted transition-colors"
          >
            <div className="flex items-center justify-center size-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name ?? 'Admin'}
              </p>
              <p className="text-xs text-sidebar-muted-foreground truncate">{user?.email}</p>
            </div>
            <ChevronDown
              className={cn(
                'size-4 text-sidebar-muted-foreground transition-transform',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-sidebar-border bg-sidebar-bg shadow-lg py-1 animate-fade-in">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-sidebar-muted transition-colors"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar — pinned, always visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col w-[var(--sidebar-width)] bg-sidebar-bg border-r border-sidebar-border shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay — rendered only when open */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-sidebar-bg flex flex-col animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg p-1.5 hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-light text-primary">
            {user?.role?.replace('_', ' ')}
          </span>
        </header>

        {/* Routed page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
