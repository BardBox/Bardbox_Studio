'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export interface ContentType {
  id: number;
  key: string;
  label: string;
  for_designer: boolean;
  for_smo: boolean;
  is_active: boolean;
  sort_order: number;
}

function AddTypeForm({ onAdd }: { onAdd: (ct: ContentType) => void }) {
  const [label, setLabel] = useState('');
  const [forDesigner, setForDesigner] = useState(true);
  const [forSmo, setForSmo] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!label.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/admin/content-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: label.toLowerCase().trim().replace(/\s+/g, '_'),
          label: label.trim(),
          for_designer: forDesigner,
          for_smo: forSmo,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to add'); return; }
      onAdd(data);
      setLabel('');
      setForDesigner(true);
      setForSmo(false);
      toast.success(`"${data.label}" added`);
    });
  }

  return (
    <tr className="border-t border-border bg-muted/10">
      <td className="py-2 px-3">
        <Input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="e.g. Banner"
          className="h-7 text-xs w-36"
        />
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground">
        auto from label
      </td>
      <td className="py-2 px-3 text-center">
        <input type="checkbox" checked={forDesigner} onChange={e => setForDesigner(e.target.checked)} className="h-4 w-4 rounded" />
      </td>
      <td className="py-2 px-3 text-center">
        <input type="checkbox" checked={forSmo} onChange={e => setForSmo(e.target.checked)} className="h-4 w-4 rounded" />
      </td>
      <td className="py-2 px-3 text-right">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={submit} disabled={pending || !label.trim()}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </td>
    </tr>
  );
}

interface ContentTypeManagerProps {
  initialTypes: ContentType[];
  onAdded?: (ct: ContentType) => void;
  onDeleted?: (id: number) => void;
  onUpdated?: (ct: ContentType) => void;
}

export function ContentTypeManager({ initialTypes, onAdded, onDeleted, onUpdated }: ContentTypeManagerProps) {
  const [types, setTypes] = useState(initialTypes);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd(ct: ContentType) {
    setTypes(prev => [...prev, ct]);
    onAdded?.(ct);
  }

  function handleToggle(id: number, field: 'for_designer' | 'for_smo', value: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/content-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) { toast.error('Update failed'); return; }
      const updated = types.find(t => t.id === id);
      if (updated) {
        const next = { ...updated, [field]: value };
        setTypes(prev => prev.map(t => t.id === id ? next : t));
        onUpdated?.(next);
      }
    });
  }

  function handleDelete(id: number, label: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/content-types/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Delete failed'); return; }
      setTypes(prev => prev.filter(t => t.id !== id));
      onDeleted?.(id);
      toast.success(`"${label}" removed`);
    });
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <div>
          <span className="font-semibold text-sm">Manage Content Types</span>
          <span className="ml-2 text-xs text-muted-foreground">{types.length} types defined</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">Label</th>
              <th className="text-left py-2 px-3 font-medium">Key</th>
              <th className="text-center py-2 px-3 font-medium">Designer</th>
              <th className="text-center py-2 px-3 font-medium">SMO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {types.map(ct => (
              <tr key={ct.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 text-sm font-medium">{ct.label}</td>
                <td className="py-2 px-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{ct.key}</code>
                </td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={ct.for_designer}
                    onChange={e => handleToggle(ct.id, 'for_designer', e.target.checked)}
                    disabled={pending}
                    className="h-4 w-4 rounded"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={ct.for_smo}
                    onChange={e => handleToggle(ct.id, 'for_smo', e.target.checked)}
                    disabled={pending}
                    className="h-4 w-4 rounded"
                  />
                </td>
                <td className="py-2 px-3 text-right">
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(ct.id, ct.label)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            <AddTypeForm onAdd={handleAdd} />
          </tbody>
        </table>
      )}
    </div>
  );
}
