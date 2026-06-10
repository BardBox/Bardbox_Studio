'use client';

export default function TeamPageError({ error }: { error: Error }) {
  return (
    <div className="glass-panel rounded-xl px-5 py-8 text-center space-y-2">
      <p className="text-sm font-semibold text-red-600">Failed to load Team page</p>
      <p className="text-xs text-slate-400">{error.message}</p>
    </div>
  );
}
