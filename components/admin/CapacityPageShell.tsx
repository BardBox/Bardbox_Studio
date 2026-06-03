'use client';

import { useState } from 'react';
import { CapacityMatrix } from './CapacityMatrix';
import { ContentTypeManager, type ContentType } from './ContentTypeManager';

interface CapacityRow {
  id: number; user_id: string; content_type: string;
  task_type: string; daily_cap: number; notes: string | null; updated_at: string;
}

interface UserWithCapacity {
  id: string; full_name: string;
  role: 'designer' | 'smo'; is_active: boolean;
  rows: CapacityRow[];
}

interface Props {
  initialUsers: UserWithCapacity[];
  initialContentTypes: ContentType[];
}

export function CapacityPageShell({ initialUsers, initialContentTypes }: Props) {
  const [contentTypes, setContentTypes] = useState(initialContentTypes);

  function handleTypeAdded(ct: ContentType) {
    setContentTypes(prev => [...prev, ct]);
  }

  function handleTypeDeleted(id: number) {
    setContentTypes(prev => prev.filter(ct => ct.id !== id));
  }

  function handleTypeUpdated(updated: ContentType) {
    setContentTypes(prev => prev.map(ct => ct.id === updated.id ? updated : ct));
  }

  return (
    <div className="space-y-8">
      <ContentTypeManager
        initialTypes={initialContentTypes}
        onAdded={handleTypeAdded}
        onDeleted={handleTypeDeleted}
        onUpdated={handleTypeUpdated}
      />
      <CapacityMatrix initialUsers={initialUsers} contentTypes={contentTypes} />
    </div>
  );
}
