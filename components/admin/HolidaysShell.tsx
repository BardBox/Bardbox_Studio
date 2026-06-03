'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, CalendarOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface Holiday {
  id: number;
  holiday_date: string;
  name: string;
}

interface Props {
  initialHolidays: Holiday[];
}

function formatDate(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function isPast(isoDate: string) {
  return isoDate < new Date().toISOString().slice(0, 10);
}

export function HolidaysShell({ initialHolidays }: Props) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [date, setDate]         = useState('');
  const [name, setName]         = useState('');
  const [adding, setAdding]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleAdd() {
    if (!date || !name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to add holiday');
      }
      const created: Holiday = await res.json();
      setHolidays(prev =>
        [...prev, created].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
      );
      setDate('');
      setName('');
      toast.success(`Holiday "${created.name}" added`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add holiday');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, holidayName: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success(`"${holidayName}" removed`);
    } catch {
      toast.error('Could not delete holiday');
    } finally {
      setDeletingId(null);
    }
  }

  const upcoming = holidays.filter(h => !isPast(h.holiday_date));
  const past     = holidays.filter(h =>  isPast(h.holiday_date));

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Add form */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Add Holiday</h2>
        <div className="flex gap-3 flex-wrap">
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-44"
          />
          <Input
            placeholder="Holiday name (e.g. Diwali)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-48"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding || !date || !name.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Task creation and imports will automatically skip holidays. Calendar marks them as "Off".
        </p>
      </div>

      {/* Upcoming holidays */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Upcoming Holidays</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-xl">No upcoming holidays added yet.</p>
        ) : (
          <div className="rounded-xl border divide-y">
            {upcoming.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <CalendarOff className="h-4 w-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.holiday_date)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-600"
                  disabled={deletingId === h.id}
                  onClick={() => handleDelete(h.id, h.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past holidays */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground">Past Holidays</h2>
          <div className="rounded-xl border divide-y opacity-60">
            {past.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <CalendarOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.holiday_date)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Past</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
