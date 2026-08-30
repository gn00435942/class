import { useEffect, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import type { CalendarEvent } from '@/types';

interface Props {
  open: boolean;
  dateLabel: string;
  dateKey: string;
  events: CalendarEvent[];
  onClose: () => void;
  onAdd: (title: string, color: string) => void;
  onDelete: (id: string) => void;
}

const COLORS: { key: string; label: string; cls: string }[] = [
  { key: 'red', label: '紅', cls: 'bg-red-500' },
  { key: 'amber', label: '橙', cls: 'bg-amber-500' },
  { key: 'emerald', label: '綠', cls: 'bg-emerald-500' },
  { key: 'sky', label: '藍', cls: 'bg-sky-500' },
  { key: 'violet', label: '紫', cls: 'bg-violet-500' },
];

const COLOR_BADGE: Record<string, string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
};

export default function CalendarEventEditor({
  open,
  dateLabel,
  events,
  onClose,
  onAdd,
  onDelete,
}: Props) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('sky');

  useEffect(() => {
    if (open) {
      setTitle('');
      setColor('sky');
    }
  }, [open]);

  if (!open) return null;

  const add = () => {
    const t = title.trim();
    if (!t) return;
    onAdd(t, color);
    setTitle('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">行事曆事件</h3>
            <p className="mt-0.5 text-xs text-slate-400">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing events */}
        {events.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${
                    COLOR_BADGE[ev.color] ?? COLOR_BADGE.sky
                  }`}
                >
                  {ev.title}
                </span>
                <button
                  onClick={() => onDelete(ev.id)}
                  className="text-slate-300 transition hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <label className="mb-1.5 block text-xs font-medium text-slate-500">新增事件</label>
        <input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="例如 放假、校慶、教師會議、國民體育日"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">顏色</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => setColor(c.key)}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  color === c.key ? 'border-slate-800' : 'border-transparent'
                } ${c.cls}`}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            關閉
          </button>
          <button
            onClick={add}
            disabled={!title.trim()}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            新增事件
          </button>
        </div>
      </div>
    </div>
  );
}
