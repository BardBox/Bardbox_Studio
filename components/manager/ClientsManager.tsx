'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Client } from '@/lib/types';

export function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json();
    if (res.ok) {
      setClients((prev) => [...prev, json].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      toast.success(`Client "${json.name}" added`);
    } else {
      toast.error(json.error ?? 'Failed to add client');
    }
    setAdding(false);
  }

  async function toggleActive(client: Client) {
    setTogglingId(client.id);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !client.is_active }),
    });
    if (res.ok) {
      setClients((prev) =>
        prev.map((c) => c.id === client.id ? { ...c, is_active: !c.is_active } : c)
      );
    } else {
      toast.error('Update failed');
    }
    setTogglingId(null);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addClient} className="flex gap-2 max-w-sm">
        <Input
          placeholder="New client name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </form>

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground text-sm">No clients yet</p>
        ) : (
          <div className="divide-y">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`flex items-center justify-between px-4 py-3 ${!client.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{client.name}</span>
                  {!client.is_active && (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`text-xs h-7 ${client.is_active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-700'}`}
                  disabled={togglingId === client.id}
                  onClick={() => toggleActive(client)}
                >
                  {togglingId === client.id ? '…' : client.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
