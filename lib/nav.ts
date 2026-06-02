import type { LucideIcon } from 'lucide-react';

// ── Serializable types (safe to pass server → client) ──────────────────────
export interface NavItem {
  href: string;
  label: string;
  iconName: string;
  exact?: boolean;
}

export type NavEntry = NavItem | { group: string; items: NavItem[] };

export function isNavGroup(e: NavEntry): e is { group: string; items: NavItem[] } {
  return 'group' in e;
}

// ── Master registry ─────────────────────────────────────────────────────────
// Icons stored as string names; AppShell resolves them to components client-side.
const NAV_MASTER: NavEntry[] = [
  { href: '/manager', label: 'Dashboard',    iconName: 'LayoutDashboard', exact: true },
  { href: '/ceo',     label: 'CEO Overview', iconName: 'LayoutDashboard', exact: true },

  {
    group: 'Operations',
    items: [
      { href: '/manager/tasks',    label: 'All Tasks',    iconName: 'ListChecks' },
      { href: '/manager/requests', label: 'Requests',     iconName: 'Inbox' },
      { href: '/manager/clients',  label: 'All Clients',  iconName: 'Building2' },
      { href: '/request-task',     label: 'New Request',  iconName: 'FilePlus' },
    ],
  },
  {
    group: 'Content',
    items: [
      { href: '/content',       label: 'Calendar',       iconName: 'CalendarDays' },
      { href: '/smo',           label: 'SMO View',       iconName: 'MonitorPlay' },
      { href: '/ceo/approvals', label: 'Approvals',      iconName: 'CheckCircle2' },
      { href: '/designer',      label: 'Designer Board', iconName: 'Pencil' },
    ],
  },
  {
    group: 'Team',
    items: [
      { href: '/admin/team',             label: 'Team Load',       iconName: 'Users' },
      { href: '/hr',                     label: 'Leave',           iconName: 'Umbrella' },
      { href: '/manager/leave-conflicts', label: 'Leave Conflicts', iconName: 'AlertTriangle' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { href: '/admin/roles',       label: 'Roles',        iconName: 'Shield' },
      { href: '/admin/settings',    label: 'App Settings', iconName: 'Settings' },
      { href: '/admin/permissions', label: 'Permissions',  iconName: 'ShieldCheck' },
    ],
  },
];

/** Default routes per role — used as fallback when DB returns nothing. */
export const ROLE_DEFAULT_ROUTES: Record<string, string[]> = {
  manager:   ['/manager', '/manager/tasks', '/manager/requests', '/manager/clients', '/request-task', '/content', '/admin/team', '/hr', '/manager/leave-conflicts'],
  admin:     ['/manager', '/manager/tasks', '/manager/requests', '/manager/clients', '/request-task', '/content', '/smo', '/designer', '/admin/team', '/hr', '/manager/leave-conflicts', '/admin/roles', '/admin/settings', '/admin/permissions'],
  ceo:       ['/ceo', '/ceo/approvals', '/content', '/admin/team'],
  smo:       ['/smo', '/content', '/request-task'],
  designer:  ['/designer', '/content', '/request-task'],
  hr:        ['/hr', '/admin/team'],
  developer: ['/manager', '/manager/tasks', '/request-task', '/admin/roles', '/admin/settings'],
};

/** Filter NAV_MASTER to only include routes in the allowed set. */
export function buildNav(enabledRoutes: string[]): NavEntry[] {
  const allowed = new Set(enabledRoutes);
  const result: NavEntry[] = [];

  for (const entry of NAV_MASTER) {
    if (isNavGroup(entry)) {
      const items = entry.items.filter(i => allowed.has(i.href));
      if (items.length > 0) result.push({ group: entry.group, items });
    } else {
      if (allowed.has(entry.href)) result.push(entry);
    }
  }

  return result;
}

/** All routes in the master registry (for the admin permissions UI). */
export const ALL_ROUTES: { href: string; label: string; group: string }[] = NAV_MASTER.flatMap(
  (entry) => {
    if (isNavGroup(entry)) {
      return entry.items.map(i => ({ href: i.href, label: i.label, group: entry.group }));
    }
    return [{ href: entry.href, label: entry.label, group: 'Top' }];
  }
);

// ── Client-side icon resolution ─────────────────────────────────────────────
// Import is done in AppShell (client component) to keep this file server-safe.
export type IconMap = Record<string, LucideIcon>;
