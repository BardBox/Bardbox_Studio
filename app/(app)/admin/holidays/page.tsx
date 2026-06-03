import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { HolidaysShell } from '@/components/admin/HolidaysShell';

export default async function HolidaysPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/');

  const { data: holidays } = await supabaseAdmin
    .from('public_holidays')
    .select('id, holiday_date, name')
    .order('holiday_date', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Public Holidays</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dates added here will be blocked from task creation and imports. They appear as "Off" on the content calendar.
        </p>
      </div>
      <HolidaysShell initialHolidays={holidays ?? []} />
    </div>
  );
}
