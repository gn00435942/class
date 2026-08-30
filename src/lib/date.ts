export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthDays(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  return days;
}

export function getWeekDays(anchor: Date): Date[] {
  const day = anchor.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diff);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Split a month's days into weeks, each starting Sunday and ending Saturday. */
export function getMonthWeeks(year: number, month: number): Date[][] {
  const days = getMonthDays(year, month);
  if (days.length === 0) return [];
  const firstDow = days[0].getDay(); // 0=Sun
  const weeks: Date[][] = [];
  let week: Date[] = [];
  // Pad leading days so the first week starts on Sunday
  for (let i = 0; i < firstDow; i++) week.push(null as unknown as Date);
  for (const d of days) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null as unknown as Date);
    weeks.push(week);
  }
  return weeks;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function monthLabel(date: Date): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}
