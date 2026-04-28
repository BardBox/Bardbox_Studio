import { createClient } from '@/lib/supabase/server';
import { RequestTaskForm } from '@/components/shared/RequestTaskForm';
import type { Client } from '@/lib/types';

export default async function RequestTaskPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: { user } }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Request a Task</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a content task for manager approval. You'll be notified once it's reviewed.
        </p>
      </div>
      <RequestTaskForm
        clients={(clients ?? []) as Client[]}
        userId={user?.id ?? ''}
      />
    </div>
  );
}
