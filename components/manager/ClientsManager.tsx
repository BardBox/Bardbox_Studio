'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { CldUploadWidget } from 'next-cloudinary';
import { Input } from '@/components/ui/input';
import { ImagePlus, IndianRupee, Users, TrendingUp, Pencil, Check, ToggleRight, ToggleLeft } from 'lucide-react';
import type { Client } from '@/lib/types';

const LS_KEY = 'bardbox_client_revenues';

function fmtINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [revenues, setRevenues] = useState<Record<number, number>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setRevenues(JSON.parse(stored) as Record<number, number>);
    } catch {}
  }, []);

  function startEdit(client: Client) {
    setEditingId(client.id);
    setEditValue(revenues[client.id]?.toString() ?? '');
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit(clientId: number) {
    const num = parseInt(editValue.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      const updated = { ...revenues, [clientId]: num };
      setRevenues(updated);
      try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch {}
      toast.success('Revenue updated');
    }
    setEditingId(null);
  }

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

  async function saveLogo(clientId: number, url: string) {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: url }),
    });
    if (res.ok) {
      setClients((prev) =>
        prev.map((c) => c.id === clientId ? { ...c, logo_url: url } : c)
      );
      toast.success('Logo updated.');
    } else {
      toast.error('Could not save logo.');
    }
  }

  const activeClients = clients.filter((c) => c.is_active);
  const totalMRR = activeClients.reduce((sum, c) => sum + (revenues[c.id] ?? 0), 0);
  const avgPerClient = activeClients.length > 0 ? totalMRR / activeClients.length : 0;

  return (
    <div className="space-y-4">
      {/* Revenue summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <IndianRupee className="size-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total MRR</p>
            <p className="text-lg font-black text-slate-800 leading-tight">{totalMRR > 0 ? fmtINR(totalMRR) : '—'}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="size-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Users className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Clients</p>
            <p className="text-lg font-black text-slate-800 leading-tight">{activeClients.length}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="size-10 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0">
            <TrendingUp className="size-5 text-violet-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg per Client</p>
            <p className="text-lg font-black text-slate-800 leading-tight">{avgPerClient > 0 ? fmtINR(avgPerClient) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Add client form */}
      <form onSubmit={addClient} className="flex gap-2 max-w-sm bg-white/40 backdrop-blur-sm border border-white/50 rounded-2xl px-4 py-2.5">
        <Input
          placeholder="New client name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-slate-700 placeholder:text-slate-400 text-sm h-8 px-0"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="shrink-0 px-4 h-8 rounded-xl bg-blue-500/80 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold backdrop-blur-sm transition-all"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {/* Client list */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        {/* Table header */}
        <div className="flex items-center px-5 py-2.5 border-b border-white/30 bg-white/20">
          <div className="w-12 shrink-0" />
          <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Client</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-44 text-right pr-4">Monthly Retainer</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-24 text-right">Status</span>
        </div>

        {clients.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">No clients yet</p>
        ) : (
          <div>
            {clients.map((client, idx) => (
              <div
                key={client.id}
                className={`flex items-center px-5 py-3 transition-colors hover:bg-white/20 ${idx < clients.length - 1 ? 'border-b border-white/30' : ''} ${!client.is_active ? 'opacity-50' : ''}`}
              >
                {/* Logo */}
                <CldUploadWidget
                  uploadPreset="bardbox_clients"
                  options={{ maxFiles: 1, resourceType: 'image', folder: 'bardbox/clients', sources: ['local', 'url', 'camera', 'dropbox', 'google_drive', 'unsplash'] }}
                  onSuccess={(result) => {
                    const info = result.info as { secure_url?: string };
                    if (info?.secure_url) saveLogo(client.id, info.secure_url);
                  }}
                >
                  {({ open }) => (
                    <button
                      onClick={() => open()}
                      title="Upload logo"
                      className="shrink-0 size-9 rounded-xl bg-white/40 border border-white/60 flex items-center justify-center overflow-hidden hover:bg-white/60 hover:border-blue-300/60 transition-all"
                    >
                      {client.logo_url ? (
                        <Image src={client.logo_url} alt={client.name} width={36} height={36} className="size-9 object-contain" />
                      ) : (
                        <ImagePlus className="size-4 text-slate-400" />
                      )}
                    </button>
                  )}
                </CldUploadWidget>

                {/* Name + inactive badge */}
                <div className="flex-1 flex items-center gap-2 min-w-0 ml-3">
                  <span className="font-semibold text-sm text-slate-700 truncate">{client.name}</span>
                  {!client.is_active && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 border border-slate-400/40 text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Revenue inline editor */}
                <div className="w-44 shrink-0 flex items-center justify-end gap-1 pr-4">
                  {editingId === client.id ? (
                    <>
                      <span className="text-slate-400 text-sm">₹</span>
                      <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(client.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(client.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-24 text-right text-sm font-semibold text-slate-700 bg-white/60 border border-blue-300/60 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400/50"
                      />
                      <button onClick={() => commitEdit(client.id)} className="size-6 rounded-lg bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center hover:bg-emerald-500/25 transition-all">
                        <Check className="size-3 text-emerald-600" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(client)}
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/40 transition-all"
                    >
                      <span className={`text-sm font-semibold ${revenues[client.id] ? 'text-slate-700' : 'text-slate-300'}`}>
                        {revenues[client.id] ? fmtINR(revenues[client.id]) : 'Set retainer'}
                      </span>
                      <Pencil className="size-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </button>
                  )}
                </div>

                {/* Toggle active */}
                <div className="w-24 shrink-0 flex justify-end">
                  <button
                    disabled={togglingId === client.id}
                    onClick={() => toggleActive(client)}
                    title={client.is_active ? 'Deactivate' : 'Reactivate'}
                    className="size-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:bg-white/40"
                  >
                    {togglingId === client.id
                      ? <span className="text-slate-400 text-sm">…</span>
                      : client.is_active
                        ? <ToggleRight className="size-6 text-emerald-500" />
                        : <ToggleLeft className="size-6 text-slate-300" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer total */}
        {totalMRR > 0 && (
          <div className="px-5 py-3 border-t border-white/30 bg-white/10 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Monthly Revenue</span>
            <span className="text-base font-black text-emerald-600">{fmtINR(totalMRR)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
