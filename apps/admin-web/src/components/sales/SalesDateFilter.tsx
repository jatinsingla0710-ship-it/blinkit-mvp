import type { SalesDatePreset } from '@/data/sales-fiscal';
import './SalesDateFilter.css';

const PRESETS: { id: SalesDatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'current_fy', label: 'Current FY' },
  { id: 'previous_fy', label: 'Previous FY' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

type Props = {
  preset: SalesDatePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: SalesDatePreset) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
};

export function SalesDateFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: Props) {
  return (
    <div className="ga-sales-filter">
      <label>
        Period
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as SalesDatePreset)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {preset === 'custom' ? (
        <>
          <label>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
