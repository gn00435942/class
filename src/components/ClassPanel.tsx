import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import type { ClassInfo } from '@/types';

interface Props {
  classes: ClassInfo[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function ClassPanel({ classes, onAdd, onDelete }: Props) {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold">班級管理</h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">新增或刪除班級，排程表會同步更新</p>
      </div>

      <div className="border-b border-slate-200 px-5 py-4">
        <label className="mb-1.5 block text-xs font-medium text-slate-500">班級名稱</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="例如 601"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            新增
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {classes.length === 0 ? (
          <div className="mt-10 text-center text-sm text-slate-400">
            尚無班級，請先新增班級
          </div>
        ) : (
          <ul className="space-y-1.5">
            {classes.map((c) => (
              <li
                key={c.id}
                className="group flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="text-sm font-medium text-slate-700">{c.name}</span>
                <button
                  onClick={() => onDelete(c.id)}
                  className="text-slate-300 transition hover:text-red-500 group-hover:text-slate-400"
                  title="刪除班級"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">
        共 {classes.length} 個班級
      </div>
    </div>
  );
}
