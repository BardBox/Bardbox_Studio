'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import { AiAssistant } from './AiAssistant';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListChecks,
  Inbox,
  FilePlus,
  CalendarDays,
  MonitorPlay,
  CheckCircle2,
  Building2,
  Users,
  Umbrella,
  Pencil,
  Shield,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';

interface AppShellProps {
  displayName: string;
  role: UserRole;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<UserRole, string> = {
  designer: 'Designer',
  smo: 'Social Media',
  manager: 'Manager',
  admin: 'Admin',
  ceo: 'CEO',
  hr: 'HR',
  developer: 'Developer',
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

type NavEntry = NavItem | { group: string; items: NavItem[] };

function isGroup(e: NavEntry): e is { group: string; items: NavItem[] } {
  return 'group' in e;
}

const NAV: NavEntry[] = [
  { href: '/manager', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  {
    group: 'Operations',
    items: [
      { href: '/manager/tasks',    label: 'All Tasks',   icon: ListChecks },
      { href: '/manager/requests', label: 'Requests',    icon: Inbox },
      { href: '/request-task',     label: 'New Request', icon: FilePlus },
    ],
  },
  {
    group: 'Content',
    items: [
      { href: '/content',       label: 'Calendar',     icon: CalendarDays },
      { href: '/smo',           label: 'SMO View',     icon: MonitorPlay },
      { href: '/ceo',           label: 'CEO Overview', icon: LayoutDashboard, exact: true },
      { href: '/ceo/approvals', label: 'Approvals',    icon: CheckCircle2 },
    ],
  },
  {
    group: 'Clients',
    items: [
      { href: '/manager/clients', label: 'All Clients', icon: Building2 },
    ],
  },
  {
    group: 'Team',
    items: [
      { href: '/admin/team', label: 'Team Load',      icon: Users },
      { href: '/hr',         label: 'Leave',          icon: Umbrella },
      { href: '/designer',   label: 'Designer Board', icon: Pencil },
    ],
  },
  {
    group: 'Settings',
    items: [
      { href: '/admin/roles',    label: 'Roles',        icon: Shield },
      { href: '/admin/settings', label: 'App Settings', icon: Settings },
    ],
  },
];

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-secondary text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({
  displayName,
  role,
  pathname,
  onNavClick,
  onSignOut,
}: {
  displayName: string;
  role: UserRole;
  pathname: string;
  onNavClick?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-5 border-b shrink-0">
        <span className="font-semibold text-base tracking-tight">Bardbox Studio</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map((entry) => {
          if (isGroup(entry)) {
            return (
              <div key={entry.group}>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {entry.group}
                </p>
                <div className="space-y-0.5">
                  {entry.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavClick} />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <NavLink key={entry.href} item={entry} pathname={pathname} onClick={onNavClick} />
          );
        })}
      </nav>

      <div className="border-t px-4 py-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ displayName, role, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const sidebarProps = {
    displayName,
    role,
    pathname,
    onNavClick: () => setMobileOpen(false),
    onSignOut: handleSignOut,
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-background border-r z-20 flex-col">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-60 bg-background border-r z-40 flex flex-col lg:hidden">
            <SidebarContent {...sidebarProps} />
          </aside>
        </>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-10 bg-background border-b h-14 flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-semibold text-base tracking-tight">Bardbox Studio</span>
      </div>

      {/* Main content */}
      <main className="lg:ml-60">
        <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      </main>

      <AiAssistant />
    </div>
  );
}
