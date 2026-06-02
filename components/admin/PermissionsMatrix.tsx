'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import type { UserRole } from '@/lib/types';

interface RouteInfo { href: string; label: string; group: string }

interface Props {
  roles: UserRole[];
  routes: RouteInfo[];
  initialPermissions: Record<string, Record<string, boolean>>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  designer: 'Designer', smo: 'SMO', manager: 'Manager',
  admin: 'Admin', ceo: 'CEO', hr: 'HR', developer: 'Developer',
};

export function PermissionsMatrix({ roles, routes, initialPermissions }: Props) {
  const [perms, setPerms] = useState(initialPermissions);
  const [pending, startTransition] = useTransition();

  function toggle(role: string, route: string, routeLabel: string) {
    const newEnabled = !perms[role]?.[route];
    const roleLabel = ROLE_LABELS[role as UserRole] ?? role;
    setPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [route]: newEnabled },
    }));

    startTransition(async () => {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, route, enabled: newEnabled }),
      });
      if (res.ok) {
        if (newEnabled) {
          toast.success(`${routeLabel} enabled for ${roleLabel}`);
        } else {
          toast.warning(`${routeLabel} disabled for ${roleLabel}`);
        }
      } else {
        setPerms(prev => ({
          ...prev,
          [role]: { ...prev[role], [route]: !newEnabled },
        }));
        toast.error(`Failed to update ${routeLabel} for ${roleLabel}`);
      }
    });
  }

  // Group routes by their group label
  const groups = Array.from(new Set(routes.map(r => r.group)));

  return (
    <div className="rounded-xl border overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-52">
              Page / Route
            </th>
            {roles.map(role => (
              <th key={role} className="px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <React.Fragment key={`group-${group}`}>
              <tr className="bg-muted/20">
                <td
                  colSpan={roles.length + 1}
                  className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60"
                >
                  {group}
                </td>
              </tr>
              {routes.filter(r => r.group === group).map(route => (
                <tr key={route.href} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{route.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{route.href}</div>
                  </td>
                  {roles.map(role => {
                    const enabled = perms[role]?.[route.href] ?? false;
                    return (
                      <td key={role} className="px-3 py-2.5 text-center">
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggle(role, route.href, route.label)}
                          disabled={pending}
                          aria-label={`${enabled ? 'Disable' : 'Enable'} ${route.label} for ${role}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
