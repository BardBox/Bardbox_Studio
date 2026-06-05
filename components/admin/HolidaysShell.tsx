'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, CalendarOff, Plus } from 'lucide-react';

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

const inputCls = 'h-8 rounded-full border border-white/50 bg-white/60 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm';

export function HolidaysShell({ initialHolidays }: Props) {
  const [holidays, setHolidays]     = useState<Holiday[]>(initialHolidays);
  const [date, setDate]             = useState('');
  const [name, setName]             = useState('');
  const [adding, setAdding]         = useState(false);
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
      toast.success(`"${created.name}" added`);
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
    <div className="space-y-4 max-w-2xl">

      {/* Add form */}
      <div className="glass-panel rounded-xl px-5 py-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Add Holiday</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={`${inputCls} w-40`}
          />
          <input
            placeholder="Holiday name (e.g. Diwali)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className={`${inputCls} flex-1 min-w-48`}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !date || !name.trim()}
            className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Task creation and imports will automatically skip holidays. Calendar marks them as "Off".
        </p>
      </div>

      {/* Upcoming holidays */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upcoming Holidays</h2>
          {upcoming.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-400/20">
              {upcoming.length}
            </span>
          )}
        </div>
        {upcoming.length === 0 ? (
          <div className="glass-panel rounded-xl p-6 text-center text-slate-400 text-sm">
            No upcoming holidays added yet.
          </div>
        ) : (
          <div className="glass-panel rounded-xl overflow-hidden">
            {upcoming.map((h, idx) => (
              <div
                key={h.id}
                className={`flex items-center justify-between px-4 py-3 hover:bg-white/20 transition-colors ${idx < upcoming.length - 1 ? 'border-b border-white/15' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <CalendarOff className="size-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{h.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(h.holiday_date)}</p>
                  </div>
                </div>
                <button
                  disabled={deletingId === h.id}
                  onClick={() => handleDelete(h.id, h.name)}
                  className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past holidays */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-400 px-1">Past Holidays</h2>
          <div className="glass-panel rounded-xl overflow-hidden opacity-60">
            {past.map((h, idx) => (
              <div
                key={h.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < past.length - 1 ? 'border-b border-white/15' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <CalendarOff className="size-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{h.name}</p>
                    <p className="text-xs text-slate-400">{formatDate(h.holiday_date)}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-400/20">Past</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
