'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import { AiAssistant } from './AiAssistant';

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

const NAV_LINKS: Partial<Record<UserRole, { href: string; label: string }[]>> = {
  designer: [
    { href: '/designer', label: 'My Tasks' },
    { href: '/request-task', label: 'Request Task' },
  ],
  smo: [
    { href: '/smo', label: 'Calendar' },
    { href: '/request-task', label: 'Request Task' },
  ],
  manager: [
    { href: '/manager', label: 'Dashboard' },
    { href: '/manager/tasks', label: 'Tasks' },
    { href: '/manager/requests', label: 'Requests' },
    { href: '/manager/clients', label: 'Clients' },
    { href: '/content', label: 'Content' },
    { href: '/admin/team', label: 'Team' },
    { href: '/admin/settings', label: 'Settings' },
  ],
  ceo: [
    { href: '/ceo', label: 'Overview' },
    { href: '/ceo/approvals', label: 'Approvals' },
    { href: '/manager/requests', label: 'Requests' },
    { href: '/manager/clients', label: 'Clients' },
    { href: '/content', label: 'Content' },
    { href: '/admin/team', label: 'Team' },
  ],
  hr: [
    { href: '/admin/team', label: 'Team' },
    { href: '/hr', label: 'Leave' },
  ],
  admin: [
    { href: '/manager', label: 'Dashboard' },
    { href: '/manager/tasks', label: 'Tasks' },
    { href: '/manager/requests', label: 'Requests' },
    { href: '/manager/clients', label: 'Clients' },
    { href: '/content', label: 'Content' },
    { href: '/ceo', label: 'CEO View' },
    { href: '/admin/team', label: 'Team' },
    { href: '/hr', label: 'Leave' },
    { href: '/admin/settings', label: 'Settings' },
  ],
  developer: [
    { href: '/manager', label: 'Dashboard' },
    { href: '/manager/tasks', label: 'Tasks' },
    { href: '/content', label: 'Content' },
    { href: '/admin/team', label: 'Team' },
    { href: '/hr', label: 'Leave' },
  ],
};

export function AppShell({ displayName, role, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const links = NAV_LINKS[role] ?? [];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-base tracking-tight">Bardbox Studio</span>
            {links.length > 0 && (
              <nav className="flex items-center gap-1">
                {links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                      (href === '/manager' ? pathname === '/manager' : pathname.startsWith(href))
                        ? 'bg-secondary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{displayName}</span>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {ROLE_LABELS[role]}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      <AiAssistant />
    </div>
  );
}
