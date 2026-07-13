export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Shanghai';

export function getBusinessTimezone(): string {
  const configured = process.env.BUSINESS_TIMEZONE?.trim();

  return configured || DEFAULT_BUSINESS_TIMEZONE;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveBusinessTimezone(): string {
  const candidate = getBusinessTimezone();

  if (!isValidTimeZone(candidate)) {
    return DEFAULT_BUSINESS_TIMEZONE;
  }

  return candidate;
}

export function getBusinessDayRangeUtc(
  timeZone: string = resolveBusinessTimezone(),
  now: Date = new Date(),
): { start: Date; end: Date } {
  const zone = isValidTimeZone(timeZone)
    ? timeZone
    : DEFAULT_BUSINESS_TIMEZONE;

  const dateKey = formatDateKeyInTimeZone(now, zone);
  const start = zonedDateTimeToUtc(dateKey, 0, 0, 0, zone);
  const nextDateKey = addCalendarDays(dateKey, 1);
  const end = zonedDateTimeToUtc(nextDateKey, 0, 0, 0, zone);

  return { start, end };
}

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  const nextYear = utcDate.getUTCFullYear();
  const nextMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utcDate.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function zonedDateTimeToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);

  return new Date(utcGuess - offset);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const hour = Number(values.hour) % 24;
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    hour,
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}
