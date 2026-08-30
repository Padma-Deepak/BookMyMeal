export function isWithinNoticePeriod(noticePeriodMinutes: number): boolean {
  if (noticePeriodMinutes === 0) return false;
  const now = new Date();
  const minutesUntilMidnight = (23 - now.getHours()) * 60 + (59 - now.getMinutes());
  return noticePeriodMinutes > minutesUntilMidnight;
}

export function formatNotice(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
