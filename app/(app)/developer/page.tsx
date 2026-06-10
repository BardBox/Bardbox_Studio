import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import {
  LayoutDashboard, ListChecks, Inbox, Building2, FilePlus,
  CalendarDays, MonitorPlay, CheckCircle2, Pencil,
  Users, Umbrella, AlertTriangle,
  Gauge, CalendarOff, Shield, Settings, ShieldCheck,
} from 'lucide-react';
import { ROLE_DEFAULT_ROUTES } from '@/lib/nav';
import type { PipelineSummary, PipelineTask } from '@/lib/types';

// Match nav master href → icon component
const ROUTE_ICON: Record<string, React.ElementType> = {
  '/manager':                  LayoutDashboard,
  '/developer':                LayoutDashboard,
  '/ceo':                      LayoutDashboard,
  '/manager/tasks':            ListChecks,
  '/manager/requests':         Inbox,
  '/manager/clients':          Building2,
  '/request-task':             FilePlus,
  '/content':                  CalendarDays,
  '/smo':                      MonitorPlay,
  '/ceo/approvals':            CheckCircle2,
  '/designer':                 Pencil,
  '/admin/team':               Users,
  '/hr':                       Umbrella,
  '/manager/leave-conflicts':  AlertTriangle,
  '/admin/capacity':           Gauge,
  '/admin/holidays':           CalendarOff,
  '/admin/roles':              Shield,
  '/admin/settings':           Settings,
  '/admin/permissions':        ShieldCheck,
};

const ROUTE_LABEL: Record<string, string> = {
  '/manager':                  'Manager Dashboard',
  '/developer':                'Developer Dashboard',
  '/ceo':                      'CEO Overview',
  '/manager/tasks':            'All Tasks',
  '/manager/requests':         'Requests',
  '/manager/clients':          'All Clients',
  '/request-task':             'New Request',
  '/content':                  'Calendar',
  '/smo':                      'SMO View',
  '/ceo/approvals':            'Approvals',
  '/designer':                 'Designer Board',
  '/admin/team':               'Team Load',
  '/hr':                       'Leave',
  '/manager/leave-conflicts':  'Leave Conflicts',
  '/admin/capacity':           'Task Capacity',
  '/admin/holidays':           'Public Holidays',
  '/admin/roles':              'Roles',
  '/admin/settings':           'App Settings',
  '/admin/permissions':        'Permissions',
};

const ROUTE_DESC: Record<string, string> = {
  '/manager/tasks':            'Assign, filter and manage every task',
  '/manager/requests':         'Incoming content requests',
  '/manager/clients':          'All active clients',
  '/request-task':             'Submit a new content request',
  '/content':                  'Monthly content calendar',
  '/admin/team':               'Team workload overview',
  '/hr':                       'Leave management',
  '/manager/leave-conflicts':  'Tasks affected by leave',
  '/admin/capacity':           'Per-employee content type caps',
  '/admin/holidays':           'Holiday calendar',
  '/admin/roles':              'Manage team roles',
  '/admin/settings':           'AI provider, knowledge base',
  '/admin/permissions':        'Role-based access control',
};

export default async function DeveloperPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user!.id).single();
  const role = profile?.role ?? 'developer';

  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + (5 * 60 + 30) * 60_000);
  const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;

  // Fetch this role's actual enabled permissions from DB
  const { data: permRows } = await supabase
    .from('role_permissions')
    .select('route, enabled')
    .eq('role', role);

  let allowedRoutes: string[];
  if (permRows && permRows.length > 0) {
    allowedRoutes = permRows
      .filter((r: { route: string; enabled: boolean }) => r.enabled)
      .map((r: { route: string }) => r.route);
  } else {
    allowedRoutes = ROLE_DEFAULT_ROUTES[role] ?? [];
  }

  // Build quick access: all allowed routes except own home page
  const quickRoutes = allowedRoutes.filter(r => r !== '/developer');

  const [
    { data: summary },
    { data: myTasks },
    { count: clientsCount },
    { count: teamCount },
  ] = await Promise.all([
    supabase.from('pipeline_summary').select('*').single(),
    supabase
      .from('task_pipeline_health')
      .select('*')
      .eq('assignee_id', user!.id)
      .not('pressure_level', 'eq', 'completed')
      .order('internal_deadline', { ascending: true }),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const s = (summary ?? {}) as PipelineSummary;
  const tasks = (myTasks ?? []) as PipelineTask[];

  const STATUS_COLOR: Record<string, string> = {
    todo: 'bg-slate-400', assigned: 'bg-blue-400', working_on_it: 'bg-blue-500',
    submitted: 'bg-amber-400', on_hold: 'bg-orange-400', blocked: 'bg-red-500',
    approved: 'bg-emerald-400', done: 'bg-emerald-600',
  };

  const PRESSURE_COLOR: Record<string, string> = {
    overdue: 'text-red-500', critical: 'text-orange-500',
    approaching: 'text-amber-500', comfortable: 'text-emerald-500',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{todayStr}</p>
      </div>

      {/* System Overview */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">System Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Clients', value: clientsCount ?? 0, color: 'text-slate-800 dark:text-slate-100' },
            { label: 'Team Members',   value: teamCount ?? 0,    color: 'text-slate-800 dark:text-slate-100' },
            { label: 'Overdue Tasks',  value: s.overdue ?? 0,    color: (s.overdue ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500' },
            { label: 'Done This Week', value: s.completed_this_week ?? 0, color: 'text-emerald-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-panel rounded-xl px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* My Tasks */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          My Tasks <span className="normal-case text-slate-300 font-normal">({tasks.length})</span>
        </p>
        {tasks.length === 0 ? (
          <div className="glass-panel rounded-xl px-5 py-8 text-center text-sm text-slate-400">
            No active tasks assigned to you.
          </div>
        ) : (
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/20 dark:border-white/10">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Priority</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.task_id} className="border-b border-white/10 last:border-0 hover:bg-white/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{t.client_name}</p>
                      <p className="text-xs text-slate-400">{t.content_type} · {t.platform}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`size-2 rounded-full ${STATUS_COLOR[t.task_status] ?? 'bg-slate-300'}`} />
                        {t.task_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${PRESSURE_COLOR[t.pressure_level] ?? 'text-slate-500'}`}>
                      {t.internal_deadline ? new Date(t.internal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-500">{t.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Access — derived from actual DB permissions */}
      {quickRoutes.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickRoutes.map((href) => {
              const Icon = ROUTE_ICON[href] ?? Settings;
              const label = ROUTE_LABEL[href] ?? href;
              const desc = ROUTE_DESC[href] ?? '';
              return (
                <Link
                  key={href}
                  href={href}
                  className="glass-panel rounded-xl px-4 py-4 flex items-start gap-3 hover:bg-white/20 dark:hover:bg-white/10 transition-colors group"
                >
                  <Icon className="size-5 mt-0.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
                    {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
