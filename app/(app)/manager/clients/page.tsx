import { createClient } from '@/lib/supabase/server';
import { ClientsManager } from '@/components/manager/ClientsManager';
import type { Client } from '@/lib/types';

export default async function ManagerClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('*').order('name');

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">All Clients</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">Manage client accounts and logos.</p>
      </div>
      <ClientsManager initialClients={(data ?? []) as Client[]} />
    </div>
  );
}
