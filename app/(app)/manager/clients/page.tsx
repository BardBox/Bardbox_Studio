import { createClient } from '@/lib/supabase/server';
import { ClientsManager } from '@/components/manager/ClientsManager';
import type { Client } from '@/lib/types';

export default async function ManagerClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('*').order('name');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage client accounts.</p>
      </div>
      <ClientsManager initialClients={(data ?? []) as Client[]} />
    </div>
  );
}
