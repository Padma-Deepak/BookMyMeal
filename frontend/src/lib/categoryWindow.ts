// Meal categories can only be ordered within their time-of-day window
// (start_hour, end_hour), both in 24h clock, end exclusive. Categories not
// listed here (snacks, beverage) have no time restriction. Mirrors
// CATEGORY_TIME_WINDOWS in backend/core/models.py — keep in sync.
export const CATEGORY_TIME_WINDOWS: Record<string, [number, number]> = {
  breakfast: [7, 10],   // 7:00 AM – 10:00 AM
  lunch: [12, 15],      // 12:00 PM – 3:00 PM
  dinner: [19, 22],     // 7:00 PM – 10:00 PM
};

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
}

export function isWithinCategoryWindow(category: string, now: Date = new Date()): boolean {
  const window = CATEGORY_TIME_WINDOWS[category];
  if (!window) return true;
  const [startHour, endHour] = window;
  return now.getHours() >= startHour && now.getHours() < endHour;
}

export function formatCategoryWindow(category: string): string | null {
  const window = CATEGORY_TIME_WINDOWS[category];
  if (!window) return null;
  const [startHour, endHour] = window;
  return `${formatHour(startHour)} – ${formatHour(endHour)}`;
}
