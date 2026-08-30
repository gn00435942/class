import { useMemo } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import type { ClassInfo, ProgressEntry, CalendarEvent } from '@/types';
import { WEEKDAY_LABELS, formatDateKey, isWeekend, isToday } from '@/lib/date';

interface Props {
  weeks: (Date | null)[][];
  classes: ClassInfo[];
  entries: ProgressEntry[];
  events: CalendarEvent[];
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

function abbreviate(content: string): string {
  const symbols = content.match(/[①②③④⑤⑥⑦⑧⑨⑩]+$/);
  const firstChar = content[0] ?? '';
  if (symbols) return firstChar + symbols[0];
  return content.slice(0, 2);
}

const COL_WIDTH = 'min-w-[3.5rem] flex-1';
const CLASS_COL = 'w-16 min-w-[4rem]';

export default function MonthView({
  weeks,
  classes,
  entries,
  events,
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

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-4 py-4">
      <div className="mx-auto max-w-5xl space-y-5">
        {weeks.map((week, weekIdx) => {
          const realDays = week.filter((d): d is Date => d !== null);
          const firstDay = realDays[0];
          const lastDay = realDays[realDays.length - 1];
          const rangeLabel =
            firstDay && lastDay
              ? `第 ${weekIdx + 1} 週　${firstDay.getMonth() + 1}/${firstDay.getDate()}～${lastDay.getMonth() + 1}/${lastDay.getDate()}`
              : `第 ${weekIdx + 1} 週`;

          return (
            <div
              key={weekIdx}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              {/* Week label */}
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="text-xs font-semibold text-slate-600">{rangeLabel}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  {/* Calendar event row */}
                  <thead>
                    <tr className="bg-violet-50/80">
                      <th
                        className={`sticky left-0 z-10 border-b border-slate-200 bg-violet-50/95 px-2 py-1.5 text-left ${CLASS_COL}`}
                      >
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                          <CalendarDays className="h-3.5 w-3.5" />
                          行事曆
                        </div>
                      </th>
                      {week.map((d, i) => {
                        if (!d) {
                          return (
                            <th
                              key={`pad-ev-${i}`}
                              className={`border-b border-l border-slate-200 bg-slate-50/50 ${COL_WIDTH}`}
                              style={{ height: 28 }}
                            />
                          );
                        }
                        const key = formatDateKey(d);
                        const evs = eventMap.get(key) ?? [];
                        const weekend = isWeekend(d);
                        return (
                          <th
                            key={key}
                            className={`group cursor-pointer border-b border-l border-slate-200 bg-violet-50/95 px-1 py-1 align-top transition hover:bg-violet-100/95 ${COL_WIDTH} ${
                              weekend ? 'bg-violet-100/60' : ''
                            }`}
                            style={{ height: 28 }}
                            onClick={() => onEventCellClick(key)}
                            title={evs.map((e) => e.title).join('、')}
                          >
                            <div className="flex flex-wrap justify-center gap-0.5">
                              {evs.length === 0 ? (
                                <span className="opacity-0 transition group-hover:opacity-100">
                                  <Plus className="h-2.5 w-2.5 text-slate-300" />
                                </span>
                              ) : (
                                evs.map((ev) => (
                                  <span
                                    key={ev.id}
                                    className={`rounded border px-1 py-0 text-[9px] font-medium ${
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
                        className={`sticky left-0 z-10 border-b border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-semibold text-slate-500 ${CLASS_COL}`}
                      >
                        班級
                      </th>
                      {week.map((d, i) => {
                        if (!d) {
                          return (
                            <th
                              key={`pad-hd-${i}`}
                              className={`border-b border-l border-slate-200 bg-slate-50/50 ${COL_WIDTH}`}
                            />
                          );
                        }
                        const weekend = isWeekend(d);
                        const today = isToday(d);
                        return (
                          <th
                            key={formatDateKey(d)}
                            className={`border-b border-l border-slate-200 bg-white px-1 py-1 text-center ${COL_WIDTH} ${
                              weekend ? 'bg-red-50/40' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-xs font-semibold ${
                                  today
                                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white'
                                    : weekend
                                    ? 'text-red-500'
                                    : 'text-slate-600'
                                }`}
                              >
                                {d.getDate()}
                              </span>
                              <span
                                className={`text-[9px] ${
                                  weekend ? 'text-red-300' : 'text-slate-300'
                                }`}
                              >
                                {WEEKDAY_LABELS[d.getDay()]}
                              </span>
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
                          colSpan={8}
                          className="py-6 text-center text-sm text-slate-400"
                        >
                          請先在左側新增班級
                        </td>
                      </tr>
                    ) : (
                      classes.map((cls, rowIdx) => (
                        <tr
                          key={cls.id}
                          className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                        >
                          <td
                            className={`sticky left-0 z-10 border-b border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 ${CLASS_COL}`}
                            style={{
                              backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            }}
                          >
                            {cls.name}
                          </td>
                          {week.map((d, i) => {
                            if (!d) {
                              return (
                                <td
                                  key={`pad-${i}`}
                                  className={`border-b border-l border-slate-200 bg-slate-50/50 ${COL_WIDTH}`}
                                  style={{ height: 30 }}
                                />
                              );
                            }
                            const key = formatDateKey(d);
                            const entry = entryMap.get(`${cls.id}|${key}`);
                            const weekend = isWeekend(d);
                            const today = isToday(d);
                            return (
                              <td
                                key={key}
                                className={`group relative cursor-pointer border-b border-l border-slate-200 px-0.5 py-0 align-middle transition hover:bg-blue-50/60 ${COL_WIDTH} ${
                                  weekend ? 'bg-red-50/30' : ''
                                } ${today ? 'bg-blue-50/30' : ''}`}
                                style={{ height: 30 }}
                                onClick={() => onCellClick(cls.id, key)}
                                title={entry?.content}
                              >
                                {entry ? (
                                  <span className="block truncate rounded bg-blue-100 px-0.5 text-center text-[10px] font-medium leading-tight text-blue-700">
                                    {abbreviate(entry.content)}
                                  </span>
                                ) : (
                                  <span className="block text-[10px] text-slate-300 opacity-0 transition group-hover:opacity-100">
                                    +
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
