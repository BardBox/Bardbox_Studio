'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContentType } from './ContentTypeManager';

interface CapacityRow {
  id: number;
  user_id: string;
  content_type: string;
  task_type: string;
  daily_cap: number;
  notes: string | null;
  updated_at: string;
}

interface UserWithCapacity {
  id: string;
  full_name: string;
  role: 'designer' | 'smo';
  is_active: boolean;
  rows: CapacityRow[];
}

const ROLE_COLORS: Record<string, string> = {
  designer: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  smo:      'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

function CapacityRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: CapacityRow;
  onUpdate: (id: number, cap: number, notes: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [cap, setCap] = useState(String(row.daily_cap));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [pending, startTransition] = useTransition();

  function cancel() {
    setCap(String(row.daily_cap));
    setNotes(row.notes ?? '');
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      await onUpdate(row.id, Number(cap), notes);
      setEditing(false);
    });
  }

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2 px-3 text-sm font-medium capitalize">{row.content_type.replace(/_/g, ' ')}</td>
      <td className="py-2 px-3">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {row.task_type}
        </span>
      </td>
      <td className="py-2 px-3 w-28">
        {editing ? (
          <Input
            type="number"
            min={1}
            max={50}
            value={cap}
            onChange={e => setCap(e.target.value)}
            className="h-7 w-20 text-sm"
          />
        ) : (
          <span className="font-semibold tabular-nums">{row.daily_cap}</span>
        )}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground">
        {editing ? (
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional note..."
            className="h-7 text-xs"
          />
        ) : (
          row.notes ?? <span className="italic text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={save} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => startTransition(() => onDelete(row.id))}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddRowForm({
  userId,
  role,
  existingTypes,
  contentTypes,
  onAdd,
  onCancel,
}: {
  userId: string;
  role: 'designer' | 'smo';
  existingTypes: string[];
  contentTypes: ContentType[];
  onAdd: (row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}) {
  const allTypes = contentTypes
    .filter(ct => role === 'designer' ? ct.for_designer : ct.for_smo);
  const available = allTypes.filter(ct => !existingTypes.includes(ct.key));
  const taskType = role === 'smo' ? 'post' : 'design';

  const [contentType, setContentType] = useState(available[0]?.key ?? '');
  const [customType, setCustomType] = useState('');
  const [cap, setCap] = useState('3');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const finalType = contentType === '__custom__' ? customType.toLowerCase().trim() : contentType;

  function submit() {
    if (!finalType || !cap) return;
    startTransition(async () => {
      await onAdd({ content_type: finalType, task_type: taskType, daily_cap: Number(cap), notes: notes || null });
    });
  }

  return (
    <tr className="border-b border-border/50 bg-muted/20">
      <td className="py-2 px-3" colSpan={2}>
        <div className="flex items-center gap-2">
          <Select value={contentType} onValueChange={v => setContentType(v ?? '')}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available.map(ct => (
                <SelectItem key={ct.key} value={ct.key} className="text-xs">
                  {ct.label}
                </SelectItem>
              ))}
              <SelectItem value="__custom__" className="text-xs">Custom type...</SelectItem>
            </SelectContent>
          </Select>
          {contentType === '__custom__' && (
            <Input
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="e.g. banner"
              className="h-7 text-xs w-28"
            />
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        <Input type="number" min={1} max={50} value={cap} onChange={e => setCap(e.target.value)} className="h-7 w-20 text-sm" />
      </td>
      <td className="py-2 px-3">
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note..." className="h-7 text-xs" />
      </td>
      <td className="py-2 px-3 text-right">
        <div className="flex items-center gap-1 justify-end">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={submit} disabled={pending || !finalType}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function UserCapacityCard({ user, contentTypes, onChange }: { user: UserWithCapacity; contentTypes: ContentType[]; onChange: (updated: UserWithCapacity) => void }) {
  const [adding, setAdding] = useState(false);

  async function handleUpdate(rowId: number, cap: number, notes: string) {
    await fetch(`/api/admin/capacity/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_cap: cap, notes }),
    });
    onChange({
      ...user,
      rows: user.rows.map(r => r.id === rowId ? { ...r, daily_cap: cap, notes } : r),
    });
  }

  async function handleDelete(rowId: number) {
    await fetch(`/api/admin/capacity/${rowId}`, { method: 'DELETE' });
    onChange({ ...user, rows: user.rows.filter(r => r.id !== rowId) });
  }

  async function handleAdd(row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) {
    const res = await fetch('/api/admin/capacity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, ...row }),
    });
    const data = await res.json();
    onChange({ ...user, rows: [...user.rows, data] });
    setAdding(false);
  }

  const existingTypes = user.rows.map(r => r.content_type);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{user.full_name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
            {user.role.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">{user.rows.length} content types</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3" />
          Add type
        </Button>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50 text-xs text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium">Content Type</th>
            <th className="text-left py-2 px-3 font-medium">Task Type</th>
            <th className="text-left py-2 px-3 font-medium">Cap / Day</th>
            <th className="text-left py-2 px-3 font-medium">Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {user.rows.map(row => (
            <CapacityRow key={row.id} row={row} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
          {user.rows.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="text-center text-xs text-muted-foreground py-4 italic">
                No capacity rules — using default ({user.role === 'smo' ? 10 : 3}/day)
              </td>
            </tr>
          )}
          {adding && (
            <AddRowForm
              userId={user.id}
              role={user.role}
              existingTypes={existingTypes}
              contentTypes={contentTypes}
              onAdd={handleAdd}
              onCancel={() => setAdding(false)}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CapacityMatrix({ initialUsers, contentTypes }: { initialUsers: UserWithCapacity[]; contentTypes: ContentType[] }) {
  const [users, setUsers] = useState(initialUsers);

  function updateUser(updated: UserWithCapacity) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  }

  const designers = users.filter(u => u.role === 'designer');
  const smos = users.filter(u => u.role === 'smo');

  return (
    <div className="space-y-8">
      {designers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold">Graphic Designers</h2>
            <Badge variant="secondary" className="text-xs">design tasks</Badge>
          </div>
          <div className="space-y-4">
            {designers.map(u => (
              <UserCapacityCard key={u.id} user={u} contentTypes={contentTypes} onChange={updateUser} />
            ))}
          </div>
        </section>
      )}

      {smos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold">SMO — Social Media Operators</h2>
            <Badge variant="secondary" className="text-xs">post tasks</Badge>
          </div>
          <div className="space-y-4">
            {smos.map(u => (
              <UserCapacityCard key={u.id} user={u} contentTypes={contentTypes} onChange={updateUser} />
            ))}
          </div>
        </section>
      )}

      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          No designers or SMOs found. Invite team members first.
        </p>
      )}
    </div>
  );
}
