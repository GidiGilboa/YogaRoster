export function getWeekRange(weekOffset = 0, now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function formatWeekStartParam(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getWeekRangeFromStartParam(param: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param);
  if (!match) return null;

  const [, yyyy, mm, dd] = match;
  const start = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(start.getTime()) || start.getDay() !== 0) return null;

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function shiftWeekStart(start: Date, weeks: number): Date {
  const shifted = new Date(start);
  shifted.setDate(shifted.getDate() + weeks * 7);
  return shifted;
}

const monthFormatter = new Intl.DateTimeFormat("he-IL", { month: "long" });

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const lastDay = new Date(end);
  lastDay.setDate(end.getDate() - 1);

  const sameMonth = start.getMonth() === lastDay.getMonth() && start.getFullYear() === lastDay.getFullYear();

  if (sameMonth) {
    return `מ-${start.getDate()} עד ${lastDay.getDate()} ב${monthFormatter.format(start)} ${start.getFullYear()}`;
  }

  return `מ-${start.getDate()} ב${monthFormatter.format(start)} עד ${lastDay.getDate()} ב${monthFormatter.format(
    lastDay
  )} ${lastDay.getFullYear()}`;
}
