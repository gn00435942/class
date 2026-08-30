export interface ClassInfo {
  id: string;
  name: string;
}

export interface ProgressEntry {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD
  content: string;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color: string;
}

export type ViewMode = 'week' | 'month';
