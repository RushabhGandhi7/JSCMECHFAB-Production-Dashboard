const MS_PER_DAY = 86_400_000;

/** Default production cycle in calendar/working days. */
export const PRODUCTION_WINDOW_DAYS = 28;

/**
 * Advance `base` by `days` working days.
 * When excludeSundays is true, Sundays (UTC day = 0) are not counted.
 * Default: false — preserves exact existing behaviour for legacy projects.
 */
export function addWorkingDays(base: Date, days: number, excludeSundays = false): Date {
  if (!excludeSundays || days <= 0) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  const d = new Date(base);
  let count = 0;
  while (count < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) count++; // 0 = Sunday
  }
  return d;
}

/**
 * Compute expected completion from drawing received date.
 * @param drawingReceived   Base date.
 * @param durationDays      Production window in days (default 28).
 * @param excludeSundays    Skip Sundays in day count (default false).
 */
export function expectedCompletionFromDrawingDate(
  drawingReceived: Date,
  durationDays = PRODUCTION_WINDOW_DAYS,
  excludeSundays = false
): Date {
  return addWorkingDays(drawingReceived, durationDays, excludeSundays);
}

/** Start of UTC day — used for stable day arithmetic. */
function utcDayStart(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Full days remaining from now until expected completion (UTC).
 * Negative = overdue.
 */
export function computeDaysRemaining(expectedCompletion: Date, now = new Date()): number {
  const diff = utcDayStart(expectedCompletion) - utcDayStart(now);
  return Math.floor(diff / MS_PER_DAY);
}
