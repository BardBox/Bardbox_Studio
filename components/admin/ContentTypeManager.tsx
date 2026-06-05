'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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
    <tr className="border-t border-white/20 bg-blue-500/5 text-xs">
      <td className="py-1.5 px-3">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="e.g. Banner"
          className="h-6 w-36 rounded-lg border border-white/50 bg-white/60 px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm"
        />
      </td>
      <td className="py-1.5 px-3 text-[10px] text-slate-400 italic">auto from label</td>
      <td className="py-1.5 px-3 text-center">
        <input type="checkbox" checked={forDesigner} onChange={e => setForDesigner(e.target.checked)} className="h-3.5 w-3.5 rounded accent-blue-500" />
      </td>
      <td className="py-1.5 px-3 text-center">
        <input type="checkbox" checked={forSmo} onChange={e => setForSmo(e.target.checked)} className="h-3.5 w-3.5 rounded accent-violet-500" />
      </td>
      <td className="py-1.5 px-3 text-right">
        <button
          onClick={submit}
          disabled={pending || !label.trim()}
          className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors disabled:opacity-40"
        >
          <Plus className="size-2.5" /> Add
        </button>
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
    <div className="glass-panel rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/20 hover:bg-white/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Manage Content Types</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-400/20">{types.length} types</span>
        </div>
        {open
          ? <ChevronUp className="size-3.5 text-slate-400" />
          : <ChevronDown className="size-3.5 text-slate-400" />}
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-white/20">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="text-left py-1.5 px-3">Label</th>
                <th className="text-left py-1.5 px-3">Key</th>
                <th className="text-center py-1.5 px-3">Designer</th>
                <th className="text-center py-1.5 px-3">SMO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {types.map(ct => (
                <tr key={ct.id} className="border-b border-white/10 last:border-0 hover:bg-white/15 transition-colors">
                  <td className="py-1.5 px-3 font-medium text-slate-700">{ct.label}</td>
                  <td className="py-1.5 px-3">
                    <code className="text-[10px] bg-slate-500/10 px-1.5 py-0.5 rounded text-slate-500">{ct.key}</code>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={ct.for_designer}
                      onChange={e => handleToggle(ct.id, 'for_designer', e.target.checked)}
                      disabled={pending}
                      className="h-3.5 w-3.5 rounded accent-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={ct.for_smo}
                      onChange={e => handleToggle(ct.id, 'for_smo', e.target.checked)}
                      disabled={pending}
                      className="h-3.5 w-3.5 rounded accent-violet-500"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={() => handleDelete(ct.id, ct.label)}
                      disabled={pending}
                      className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40 ml-auto"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
              <AddTypeForm onAdd={handleAdd} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
