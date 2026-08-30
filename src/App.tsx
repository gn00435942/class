import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange, CalendarDays } from 'lucide-react';
import ClassPanel from '@/components/ClassPanel';
import ScheduleGrid from '@/components/ScheduleGrid';
import ProgressEditor from '@/components/ProgressEditor';
import CalendarEventEditor from '@/components/CalendarEventEditor';
import { useLocalStorage, uid } from '@/lib/storage';
import {
  formatDateKey,
  getMonthDays,
  getMonthWeeks,
  getWeekDays,
  addMonths,
  addWeeks,
  monthLabel,
} from '@/lib/date';
import type { ClassInfo, ProgressEntry, CalendarEvent, ViewMode } from '@/types';

const DEFAULT_CLASSES: ClassInfo[] = [
  { id: 'c1', name: '601' },
  { id: 'c2', name: '602' },
  { id: 'c3', name: '603' },
];

function buildDefaultEvents(year: number, month: number): CalendarEvent[] {
  const mk = (day: number, title: string, color: string) => ({
    id: uid(),
    date: formatDateKey(new Date(year, month, day)),
    title,
    color,
  });
  return [
    mk(1, '開學日', 'emerald'),
    mk(10, '教師會議', 'amber'),
    mk(15, '校慶', 'red'),
    mk(20, '放假', 'sky'),
    mk(25, '游泳課', 'violet'),
  ];
}

export default function App() {
  const [classes, setClasses] = useLocalStorage<ClassInfo[]>('tp.classes', DEFAULT_CLASSES);
  const [entries, setEntries] = useLocalStorage<ProgressEntry[]>('tp.entries', []);
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('tp.events', buildDefaultEvents(2026, 8));
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(new Date(2026, 8, 1));

  const [editor, setEditor] = useState<{ classId: string; dateKey: string } | null>(null);
  const [eventEditor, setEventEditor] = useState<string | null>(null);

  const days = useMemo(
    () => (viewMode === 'month' ? getMonthDays(anchor.getFullYear(), anchor.getMonth()) : getWeekDays(anchor)),
    [viewMode, anchor]
  );

  const weeks = useMemo(
    () => getMonthWeeks(anchor.getFullYear(), anchor.getMonth()),
    [anchor]
  );

  const editorClass = classes.find((c) => c.id === editor?.classId);
  const editorDate = editor ? new Date(editor.dateKey + 'T00:00:00') : null;
  const editorEntry = editor
    ? entries.find((e) => e.classId === editor.classId && e.date === editor.dateKey)
    : undefined;

  // Unique recent progress contents, most-recent-first, for quick copy/select
  const recentContents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      if (!seen.has(e.content)) {
        seen.add(e.content);
        out.push(e.content);
      }
    }
    return out.slice(0, 12);
  }, [entries]);

  const addClass = (name: string) => {
    setClasses((prev) => [...prev, { id: uid(), name }]);
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setEntries((prev) => prev.filter((e) => e.classId !== id));
  };

  const saveEntry = (content: string) => {
    if (!editor) return;
    const key = `${editor.classId}|${editor.dateKey}`;
    setEntries((prev) => {
      const exists = prev.some((e) => `${e.classId}|${e.date}` === key);
      if (exists) {
        return prev.map((e) =>
          `${e.classId}|${e.date}` === key ? { ...e, content } : e
        );
      }
      return [...prev, { id: uid(), classId: editor.classId, date: editor.dateKey, content }];
    });
    setEditor(null);
  };

  const deleteEntry = () => {
    if (!editor) return;
    const key = `${editor.classId}|${editor.dateKey}`;
    setEntries((prev) => prev.filter((e) => `${e.classId}|${e.date}` !== key));
    setEditor(null);
  };

  const addEvent = (title: string, color: string) => {
    if (!eventEditor) return;
    setEvents((prev) => [...prev, { id: uid(), date: eventEditor, title, color }]);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const prev = () => setAnchor((d) => (viewMode === 'month' ? addMonths(d, -1) : addWeeks(d, -1)));
  const next = () => setAnchor((d) => (viewMode === 'month' ? addMonths(d, 1) : addWeeks(d, 1)));
  const goToday = () => setAnchor(new Date());

  const dateLabel = editorDate
    ? `${editorDate.getMonth() + 1} 月 ${editorDate.getDate()} 日`
    : '';

  const eventDate = eventEditor ? new Date(eventEditor + 'T00:00:00') : null;
  const eventDateLabel = eventDate
    ? `${eventDate.getMonth() + 1} 月 ${eventDate.getDate()} 日`
    : '';
  const dayEvents = eventEditor ? events.filter((e) => e.date === eventEditor) : [];

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-800">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-slate-800">班級教學進度排程</h1>
            <p className="text-[11px] text-slate-400">Class Teaching Progress Scheduler</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-md border border-slate-200 p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'week' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              週檢視
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              月檢視
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
          <ClassPanel classes={classes} onAdd={addClass} onDelete={deleteClass} />
        </aside>

        {/* Right schedule */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[120px] text-center text-sm font-semibold text-slate-700">
                {viewMode === 'month' ? monthLabel(anchor) : `${monthLabel(anchor)} 第 ${Math.ceil(anchor.getDate() / 7)} 週`}
              </span>
              <button
                onClick={next}
                className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToday}
                className="ml-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50"
              >
                今天
              </button>
            </div>
            <div className="text-xs text-slate-400">
              {viewMode === 'month' ? '整月進度總覽' : '單週放大檢視'}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-hidden">
            <ScheduleGrid
              days={days}
              weeks={weeks}
              classes={classes}
              entries={entries}
              events={events}
              viewMode={viewMode}
              onCellClick={(classId, dateKey) => setEditor({ classId, dateKey })}
              onEventCellClick={(dateKey) => setEventEditor(dateKey)}
            />
          </div>
        </main>
      </div>

      <ProgressEditor
        open={!!editor}
        className={editorClass?.name ?? ''}
        dateLabel={dateLabel}
        initialContent={editorEntry?.content ?? ''}
        recentContents={recentContents}
        onClose={() => setEditor(null)}
        onSave={saveEntry}
        onDelete={deleteEntry}
      />

      <CalendarEventEditor
        open={!!eventEditor}
        dateLabel={eventDateLabel}
        dateKey={eventEditor ?? ''}
        events={dayEvents}
        onClose={() => setEventEditor(null)}
        onAdd={addEvent}
        onDelete={deleteEvent}
      />
    </div>
  );
}
