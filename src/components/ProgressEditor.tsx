import { useEffect, useState } from 'react';
import { X, Trash2, Copy } from 'lucide-react';

interface Props {
  open: boolean;
  className: string;
  dateLabel: string;
  initialContent: string;
  recentContents: string[];
  onClose: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
}

export default function ProgressEditor({
  open,
  className,
  dateLabel,
  initialContent,
  recentContents,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

  if (!open) return null;

  const save = () => {
    if (!content.trim()) return;
    onSave(content.trim());
  };

  const copyLast = () => {
    if (recentContents.length > 0) setContent(recentContents[0]);
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
            <h3 className="text-base font-semibold text-slate-800">編輯教學進度</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {className}　{dateLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-slate-500">教學進度內容</label>
        <input
          type="text"
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="例如 體適能①、籃球②、游泳課"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        {/* Quick copy last */}
        {recentContents.length > 0 && (
          <button
            onClick={copyLast}
            className="mt-2 flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
          >
            <Copy className="h-3.5 w-3.5" />
            複製上一堂：{recentContents[0]}
          </button>
        )}

        {/* Quick select from existing */}
        {recentContents.length > 0 && (
          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">快速選擇既有進度</span>
            <div className="flex flex-wrap gap-1.5">
              {recentContents.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  onClick={() => setContent(c)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-sm text-red-500 transition hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            刪除進度
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={!content.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
