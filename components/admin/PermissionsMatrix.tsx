'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ToggleRight, ToggleLeft } from 'lucide-react';
import type { UserRole } from '@/lib/types';

interface RouteInfo { href: string; label: string; group: string }

interface Props {
  roles: UserRole[];
  routes: RouteInfo[];
  initialPermissions: Record<string, Record<string, boolean>>;
}

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer', smo: 'SMO', manager: 'Manager',
  admin: 'Admin', ceo: 'CEO', hr: 'HR', developer: 'Developer',
};

const ROLE_COLORS: Record<string, string> = {
  admin:     'text-slate-600',
  manager:   'text-amber-600',
  ceo:       'text-indigo-600',
  hr:        'text-pink-600',
  designer:  'text-blue-600',
  smo:       'text-violet-600',
  developer: 'text-emerald-600',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="inline-flex items-center justify-center transition-all disabled:opacity-40 hover:opacity-80"
    >
      {checked
        ? <ToggleRight className="size-7 text-emerald-500" />
        : <ToggleLeft className="size-7 text-slate-300" />}
    </button>
  );
}

export function PermissionsMatrix({ roles, routes, initialPermissions }: Props) {
  const [perms, setPerms] = useState(initialPermissions);
  const [pending, startTransition] = useTransition();

  function toggle(role: string, route: string, routeLabel: string) {
    const newEnabled = !perms[role]?.[route];
    const roleLabel  = ROLE_LABELS[role] ?? role;
    setPerms(prev => ({ ...prev, [role]: { ...prev[role], [route]: newEnabled } }));

    startTransition(async () => {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, route, enabled: newEnabled }),
      });
      if (res.ok) {
        newEnabled
          ? toast.success(`${routeLabel} enabled for ${roleLabel}`)
          : toast.warning(`${routeLabel} disabled for ${roleLabel}`);
      } else {
        setPerms(prev => ({ ...prev, [role]: { ...prev[role], [route]: !newEnabled } }));
        toast.error(`Failed to update ${routeLabel} for ${roleLabel}`);
      }
    });
  }

  const groups = Array.from(new Set(routes.map(r => r.group)));

  return (
    <div className="glass-panel rounded-xl overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-white/20 dark:bg-white/5 border-b border-white/30 dark:border-white/10">
          <tr>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-52 whitespace-nowrap">
              Page / Route
            </th>
            {roles.map(role => (
              <th key={role} className={`w-24 px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap ${ROLE_COLORS[role] ?? 'text-slate-500'}`}>
                {ROLE_LABELS[role] ?? role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <React.Fragment key={`group-${group}`}>
              <tr className="bg-white/10 dark:bg-white/3">
                <td
                  colSpan={roles.length + 1}
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                >
                  {group}
                </td>
              </tr>
              {routes.filter(r => r.group === group).map(route => (
                <tr key={route.href} className="border-b border-white/10 last:border-0 hover:bg-white/15 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{route.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{route.href}</div>
                  </td>
                  {roles.map(role => (
                    <td key={role} className="w-24 px-3 py-2.5 text-center">
                      <Toggle
                        checked={perms[role]?.[route.href] ?? false}
                        onChange={() => toggle(role, route.href, route.label)}
                        disabled={pending}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
