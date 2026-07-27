export function getWeekRange(weekOffset = 0, now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
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
