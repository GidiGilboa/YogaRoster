const TIME_ZONE = "Asia/Jerusalem";

const wallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Converts a naive "YYYY-MM-DDTHH:mm" wall-clock string — assumed to be
 * local Israel time, e.g. from a datetime-local input — into the correct
 * UTC Date. `new Date(str)` would instead parse it as local time of the
 * *server process*, which is wrong whenever the server doesn't run in
 * Asia/Jerusalem (breaking DST correctly too, since it's derived from the
 * IANA tz database via Intl rather than a fixed offset).
 */
export function israeliWallTimeToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;

  const guess = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
  if (Number.isNaN(guess.getTime())) return null;

  const parts = wallClockFormatter.formatToParts(guess).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const guessAsJerusalemWallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const offsetMs = guessAsJerusalemWallClock - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}
