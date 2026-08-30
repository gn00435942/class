import { useMemo } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import type { ClassInfo, ProgressEntry, CalendarEvent, ViewMode } from '@/types';
import { WEEKDAY_LABELS, formatDateKey, isWeekend, isToday } from '@/lib/date';
import MonthView from '@/components/MonthView';

interface Props {
  days: Date[];
  weeks: (Date | null)[][];
  classes: ClassInfo[];
  entries: ProgressEntry[];
  events: CalendarEvent[];
  viewMode: ViewMode;
  onCellClick: (classId: string, dateKey: string) => void;
  onEventCellClick: (dateKey: string) => void;
}

const EVENT_COLORS: Record<string, string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
};

export default function ScheduleGrid({
  days,
  weeks,
  classes,
  entries,
  events,
  viewMode,
  onCellClick,
  onEventCellClick,
}: Props) {
  const entryMap = useMemo(() => {
    const map = new Map<string, ProgressEntry>();
    for (const e of entries) map.set(`${e.classId}|${e.date}`, e);
    return map;
  }, [entries]);

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  // Month view: vertical week-stacked layout
  if (viewMode === 'month') {
    return (
      <MonthView
        weeks={weeks}
        classes={classes}
        entries={entries}
        events={events}
        onCellClick={onCellClick}
        onEventCellClick={onEventCellClick}
      />
    );
  }

  // Week view: single wide row, detailed editing
  const colWidth = 168;
  const classColWidth = 96;
  const rowHeight = 56;

  return (
    <div className="h-full overflow-auto">
      <table className="border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          {/* Google Calendar row */}
          <tr className="bg-violet-50/80">
            <th
              className="sticky left-0 z-30 border-b border-slate-200 bg-violet-50/95 px-3 py-2 text-left backdrop-blur"
              style={{ width: classColWidth, minWidth: classColWidth }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <CalendarDays className="h-4 w-4" />
                行事曆
              </div>
            </th>
            {days.map((d) => {
              const key = formatDateKey(d);
              const evs = eventMap.get(key) ?? [];
              const weekend = isWeekend(d);
              return (
                <th
                  key={key}
                  className={`group cursor-pointer border-b border-l border-slate-200 bg-violet-50/95 px-1.5 py-1.5 align-top backdrop-blur transition hover:bg-violet-100/95 ${
                    weekend ? 'bg-violet-100/60' : ''
                  }`}
                  style={{ width: colWidth, minWidth: colWidth, height: 40 }}
                  onClick={() => onEventCellClick(key)}
                >
                  <div className="flex flex-wrap gap-1">
                    {evs.length === 0 ? (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 text-[11px] text-slate-300 opacity-0 transition group-hover:opacity-100">
                        <Plus className="h-3 w-3" />
                        新增
                      </span>
                    ) : (
                      evs.map((ev) => (
                        <span
                          key={ev.id}
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                            EVENT_COLORS[ev.color] ?? EVENT_COLORS.sky
                          }`}
                        >
                          {ev.title}
                        </span>
                      ))
                    )}
                  </div>
                </th>
              );
            })}
          </tr>

          {/* Date header row */}
          <tr className="bg-white">
            <th
              className="sticky left-0 z-30 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500"
              style={{ width: classColWidth, minWidth: classColWidth }}
            >
              班級
            </th>
            {days.map((d) => {
              const weekend = isWeekend(d);
              const today = isToday(d);
              return (
                <th
                  key={formatDateKey(d)}
                  className={`border-b border-l border-slate-200 bg-white px-2 py-2 text-center ${
                    weekend ? 'bg-red-50/40' : ''
                  }`}
                  style={{ width: colWidth, minWidth: colWidth }}
                >
                  <div
                    className={`flex items-center justify-center gap-1 text-sm font-semibold ${
                      today ? 'text-white' : weekend ? 'text-red-500' : 'text-slate-600'
                    }`}
                  >
                    {today && (
                      <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                        {d.getMonth() + 1}/{d.getDate()}
                      </span>
                    )}
                    {!today && <span>{d.getMonth() + 1}/{d.getDate()}</span>}
                    {today && (
                      <span className="rounded bg-blue-600 px-1 text-[10px] text-white">今天</span>
                    )}
                  </div>
                  <div
                    className={`text-[11px] ${
                      today ? 'text-blue-600' : weekend ? 'text-red-400' : 'text-slate-400'
                    }`}
                  >
                    星期{WEEKDAY_LABELS[d.getDay()]}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {classes.length === 0 ? (
            <tr>
              <td
                className="sticky left-0 z-10 bg-slate-50/80 px-3 py-8 text-center text-sm text-slate-400"
                style={{ width: classColWidth }}
              >
                尚無班級
              </td>
              <td
                colSpan={days.length}
                className="py-8 text-center text-sm text-slate-400"
              >
                請先在左側新增班級
              </td>
            </tr>
          ) : (
            classes.map((cls, rowIdx) => (
              <tr key={cls.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td
                  className="sticky left-0 z-10 border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  style={{
                    width: classColWidth,
                    minWidth: classColWidth,
                    backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  }}
                >
                  {cls.name}
                </td>
                {days.map((d) => {
                  const key = formatDateKey(d);
                  const entry = entryMap.get(`${cls.id}|${key}`);
                  const weekend = isWeekend(d);
                  const today = isToday(d);
                  return (
                    <td
                      key={key}
                      className={`group relative cursor-pointer border-b border-l border-slate-200 px-2 py-1.5 align-top transition hover:bg-blue-50/60 ${
                        weekend ? 'bg-red-50/30' : ''
                      } ${today ? 'bg-blue-50/30' : ''}`}
                      style={{ width: colWidth, minWidth: colWidth, height: rowHeight }}
                      onClick={() => onCellClick(cls.id, key)}
                      title={entry?.content}
                    >
                      {entry ? (
                        <span className="block rounded bg-blue-100 px-1.5 py-1 text-xs font-medium text-blue-700">
                          {entry.content}
                        </span>
                      ) : (
                        <span className="block px-1.5 py-1 text-xs text-slate-300 opacity-0 transition group-hover:opacity-100">
                          + 新增
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
