const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAYS_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toIsoDate(date);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayIndex(iso: string): number {
  return parseIsoDate(iso).getDay();
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(iso)];
}

export function weekdayLong(iso: string): string {
  return WEEKDAYS_LONG[weekdayIndex(iso)];
}

/** 13.10. */
export function dayMonth(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}.`;
}

/** 13.10.2026 */
export function fullDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/** Di 13.10. */
export function shortDay(iso: string): string {
  return `${weekdayShort(iso)} ${dayMonth(iso)}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function addMonthKey(key: string, months: number): string {
  return monthKey(addMonths(`${key}-01`, months));
}

export function lastDayOfMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return toIsoDate(new Date(year, month, 0));
}

export function endTime(time: string, durationMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
