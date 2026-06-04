'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import type { NavEntry, NavItem } from '@/lib/nav';
import { isNavGroup } from '@/lib/nav';
import { AiAssistant } from './AiAssistant';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ListChecks, Inbox, FilePlus, CalendarDays,
  MonitorPlay, CheckCircle2, Building2, Users, Umbrella, Pencil,
  Shield, Settings, ShieldCheck, AlertTriangle, Gauge,
  LogOut, Menu, UserCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ListChecks, Inbox, FilePlus, CalendarDays,
  MonitorPlay, CheckCircle2, Building2, Users, Umbrella, Pencil,
  Shield, Settings, ShieldCheck, AlertTriangle, Gauge,
};

interface AppShellProps {
  displayName: string;
  role: UserRole;
  nav: NavEntry[];
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

function NavLink({ item, pathname, onClick }: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;
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

function SidebarContent({ displayName, role, nav, pathname, onNavClick, onSignOut }: {
  displayName: string;
  role: UserRole;
  nav: NavEntry[];
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
        {nav.map((entry) => {
          if (isNavGroup(entry)) {
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
          <Link href="/profile" className="min-w-0 flex items-center gap-2 group" onClick={onNavClick}>
            <UserCircle className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{displayName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={onSignOut}
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ displayName, role, nav, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const sidebarProps = {
    displayName, role, nav, pathname,
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
