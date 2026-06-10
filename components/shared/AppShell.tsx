'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Shield, Settings, ShieldCheck, AlertTriangle, Gauge, CalendarOff,
  LogOut, Menu, UserCircle, Sparkles, Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ListChecks, Inbox, FilePlus, CalendarDays,
  MonitorPlay, CheckCircle2, Building2, Users, Umbrella, Pencil,
  Shield, Settings, ShieldCheck, AlertTriangle, Gauge, CalendarOff,
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  Operations: ListChecks,
  Content:    CalendarDays,
  Team:       Users,
  Settings:   Settings,
};

interface AppShellProps {
  displayName: string;
  role: UserRole;
  nav: NavEntry[];
  children: React.ReactNode;
}

const ROLE_LABELS: Record<UserRole, string> = {
  designer:     'Designer',
  video_editor: 'Video Editor',
  smo:          'Social Media',
  manager:      'Manager',
  admin:        'Admin',
  ceo:          'CEO',
  hr:           'HR',
  developer:    'Developer',
};

// ── Section model ───────────────────────────────────────────────────────────

type SectionDef = {
  id: string;
  label: string;
  Icon: LucideIcon;
  entries: NavEntry[];
};

function buildSections(nav: NavEntry[]): SectionDef[] {
  const sections: SectionDef[] = [];
  const standalones: NavItem[] = [];

  for (const entry of nav) {
    if (isNavGroup(entry)) {
      sections.push({
        id:      entry.group,
        label:   entry.group,
        Icon:    GROUP_ICONS[entry.group] ?? Settings,
        entries: [entry],
      });
    } else {
      standalones.push(entry);
    }
  }

  if (standalones.length > 0) {
    sections.unshift({
      id:      'home',
      label:   'Home',
      Icon:    LayoutDashboard,
      entries: standalones,
    });
  }

  return sections;
}

function findSectionId(sections: SectionDef[], pathname: string): string {
  for (const section of sections) {
    for (const entry of section.entries) {
      if (isNavGroup(entry)) {
        if (entry.items.some(item =>
          item.exact ? pathname === item.href : pathname.startsWith(item.href)
        )) return section.id;
      } else {
        if (entry.exact ? pathname === entry.href : pathname.startsWith(entry.href)) {
          return section.id;
        }
      }
    }
  }
  return sections[0]?.id ?? 'home';
}

// ── NavLink ─────────────────────────────────────────────────────────────────

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
        'flex items-center gap-3 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-200',
        active
          ? 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300'
          : 'text-slate-500 hover:text-slate-800 hover:bg-blue-500/8 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/8'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

// ── SidebarContent ──────────────────────────────────────────────────────────

function getFirstHref(entries: NavEntry[]): string | null {
  for (const entry of entries) {
    if (isNavGroup(entry)) return entry.items[0]?.href ?? null;
    else return entry.href;
  }
  return null;
}

function SidebarContent({ displayName, role, nav, pathname, onNavClick, onSignOut }: {
  displayName: string;
  role: UserRole;
  nav: NavEntry[];
  pathname: string;
  onNavClick?: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const sections = useMemo(() => buildSections(nav), [nav]);
  const [selectedId, setSelectedId] = useState(() => findSectionId(sections, pathname));

  // Sync section when user navigates via a link
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      setSelectedId(findSectionId(sections, pathname));
    }
  }, [pathname, sections]);

  const activeSection = sections.find(s => s.id === selectedId) ?? sections[0];

  return (
    <div className="flex h-full w-full">

      {/* ── Icon Rail (48 px) ─────────────────────────────── */}
      <div className="w-12 h-full flex flex-col items-center py-5 gap-4 border-r border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-xl shrink-0">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
          <Sparkles className="size-4" />
        </div>

        {/* Section icons — one per group + home */}
        <nav className="flex flex-col gap-1 flex-1 mt-1 w-full items-center">
          {sections.map(({ id, label, Icon, entries }) => {
            const active = id === selectedId;
            return (
              <button
                key={id}
                title={label}
                onClick={() => {
                  setSelectedId(id);
                  const href = getFirstHref(entries);
                  if (href) router.push(href);
                }}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200',
                  active
                    ? 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300'
                    : 'text-slate-400 hover:bg-blue-500/10 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300'
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </nav>

        {/* Theme + sign out */}
        <div className="flex flex-col gap-1 items-center">
          <div className="w-9 h-9 flex items-center justify-center">
            <ThemeToggle />
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-all"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Contextual Nav (240 px) ───────────────────────── */}
      <div className="flex flex-col flex-1 py-5 px-3 min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-2 mb-5 shrink-0">
          <h1 className="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight">
            Bardbox Studio
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
            {activeSection.id === 'home' ? ROLE_LABELS[role] : activeSection.label}
          </p>
        </div>

        {/* Items for the selected section */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
          {activeSection.entries.map((entry) => {
            if (isNavGroup(entry)) {
              return (
                <div key={entry.group} className="space-y-0.5">
                  {entry.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavClick} />
                  ))}
                </div>
              );
            }
            return (
              <NavLink key={entry.href} item={entry} pathname={pathname} onClick={onNavClick} />
            );
          })}
        </nav>

        {/* Footer: user info + CTA */}
        <div className="shrink-0 mt-4 space-y-2.5 pt-3 border-t border-white/40 dark:border-white/10">
          <Link
            href="/profile"
            onClick={onNavClick}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/8 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0">
              <UserCircle className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-400">{ROLE_LABELS[role]}</p>
            </div>
          </Link>

          <Link
            href="/content"
            onClick={onNavClick}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/25 active:scale-95 transition-all duration-200"
          >
            <Plus className="size-4" />
            New Content
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── AppShell ────────────────────────────────────────────────────────────────

export function AppShell({ displayName, role, nav, children }: AppShellProps) {
  const router   = useRouter();
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
    onSignOut:  handleSignOut,
  };

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — 288 px (48 rail + 240 nav) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 z-20 glass-sidebar">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 z-40 flex lg:hidden glass-sidebar">
            <SidebarContent {...sidebarProps} />
          </aside>
        </>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-10 glass-topbar border-b border-white/40 dark:border-white/10 h-14 flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100">
          Bardbox Studio
        </span>
      </div>

      {/* Main content */}
      <main className="lg:ml-72">
        <div className="p-4">{children}</div>
      </main>

      <AiAssistant />
    </div>
  );
}
