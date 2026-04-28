import type { PressureLevel } from '@/lib/types';

const STYLES: Record<PressureLevel, string> = {
  overdue:     'bg-red-100 text-red-700 border border-red-200',
  critical:    'bg-orange-100 text-orange-700 border border-orange-200',
  approaching: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  comfortable: 'bg-green-100 text-green-700 border border-green-200',
  completed:   'bg-gray-100 text-gray-500 border border-gray-200',
};

const LABELS: Record<PressureLevel, string> = {
  overdue:     'Overdue',
  critical:    'Critical',
  approaching: 'Approaching',
  comfortable: 'On Track',
  completed:   'Done',
};

export function PressureBadge({ level }: { level: PressureLevel }) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[level]}`}>
      {LABELS[level]}
    </span>
  );
}
