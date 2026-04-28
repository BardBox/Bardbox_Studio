import { createClient } from '@/lib/supabase/server';
import { HrDashboard } from '@/components/hr/HrDashboard';
import type { LeaveRequest, TeamAvailability, UserProfile } from '@/lib/types';

export default async function HrPage() {
  const supabase = await createClient();

  const [leavePending, leaveAll, availability, profiles] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(full_name, role)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(full_name, role)')
      .in('status', ['approved', 'denied'])
      .gte('end_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('start_date', { ascending: false })
      .limit(50),
    supabase.from('team_availability').select('*'),
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('role')
      .order('full_name'),
  ]);

  // Flatten joined profile data into LeaveRequest shape
  function flattenLeave(rows: unknown[]): LeaveRequest[] {
    return (rows as Array<Record<string, unknown>>).map((r) => {
      const prof = r.profiles as { full_name: string; role: string } | null;
      return {
        ...(r as unknown as LeaveRequest),
        full_name: prof?.full_name,
        role: prof?.role as LeaveRequest['role'],
      };
    });
  }

  return (
    <HrDashboard
      pendingLeave={flattenLeave(leavePending.data ?? [])}
      recentLeave={flattenLeave(leaveAll.data ?? [])}
      availability={(availability.data ?? []) as TeamAvailability[]}
      teamProfiles={(profiles.data ?? []) as UserProfile[]}
    />
  );
}
