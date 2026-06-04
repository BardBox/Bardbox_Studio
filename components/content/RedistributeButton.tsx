'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Shuffle } from 'lucide-react';

interface RedistributeButtonProps {
  month: string; // 'YYYY-MM'
}

export function RedistributeButton({ month }: RedistributeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRedistribute() {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/redistribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      toast.success(`Re-assigned ${json.reassigned} of ${json.total} tasks`);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Redistribution failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRedistribute}
      disabled={loading}
      className="h-8 text-xs gap-1.5"
    >
      <Shuffle className="h-3.5 w-3.5" />
      {loading ? 'Redistributing…' : 'Redistribute'}
    </Button>
  );
}
