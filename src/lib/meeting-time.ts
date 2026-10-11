import type { City } from "./cities";

export type HourBand = "ideal" | "ok" | "bad";

export type LocalSlot = {
  instant: Date;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
  offsetMinutes: number;
  isDst: boolean;
  band: HourBand;
  label: string;
};

export type DstTransition = {
  at: Date;
  fromOffsetMinutes: number;
  toOffsetMinutes: number;
  /** true when clocks spring forward */
  springForward: boolean;
};

export type CityDstInfo = {
  city: City;
  isDstOnDate: boolean;
  nextTransition: DstTransition | null;
  daysUntilTransition: number | null;
  /** Clock shift at next transition in hours, e.g. +1 or -1 */
  shiftHours: number | null;
  note: string | null;
  /** Compact column label, e.g. "DST in 13 days · −1h" */
  shortLabel: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Offset of `instant` in `timeZone`, in minutes east of UTC. */
export function getOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "numeric",
  }).formatToParts(instant);

  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (tz === "GMT" || tz === "UTC") return 0;

  const match = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function partsInZone(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });

  const map = Object.fromEntries(
    dtf
      .formatToParts(instant)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday,
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Handles DST edges by re-resolving the offset twice.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = asUtc;

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getOffsetMinutes(new Date(guess), timeZone) * 60_000;
    const next = asUtc - offsetMs;
    if (next === guess) break;
    guess = next;
  }

  return new Date(guess);
}

/** DST is in effect when the current offset is the larger of Jan/Jul offsets. */
export function isDstAt(instant: Date, timeZone: string): boolean {
  const year = partsInZone(instant, timeZone).year;
  const jan = getOffsetMinutes(new Date(Date.UTC(year, 0, 1, 12)), timeZone);
  const jul = getOffsetMinutes(new Date(Date.UTC(year, 6, 1, 12)), timeZone);
  if (jan === jul) return false;
  const current = getOffsetMinutes(instant, timeZone);
  return current === Math.max(jan, jul);
}

export function hourBand(hour: number): HourBand {
  if (hour >= 9 && hour < 17) return "ideal";
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 22)) return "ok";
  return "bad";
}

function formatHourLabel(hour: number, minute: number): string {
  if (hour === 0 && minute === 0) return "12:00 midnight";
  if (hour === 12 && minute === 0) return "12:00 noon";
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function describeLocalSlot(
  instant: Date,
  timeZone: string,
): LocalSlot {
  const parts = partsInZone(instant, timeZone);
  const offsetMinutes = getOffsetMinutes(instant, timeZone);
  const dst = isDstAt(instant, timeZone);

  return {
    instant,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    weekday: parts.weekday,
    offsetMinutes,
    isDst: dst,
    band: hourBand(parts.hour),
    label: `${parts.weekday} ${formatHourLabel(parts.hour, parts.minute)}${dst ? " *" : ""}`,
  };
}

/**
 * Scan hourly from `from` for the next offset change in `timeZone`.
 * Covers a full year ahead so southern + northern DST both show up.
 */
export function findNextDstTransition(
  from: Date,
  timeZone: string,
  horizonDays = 400,
): DstTransition | null {
  let prevOffset = getOffsetMinutes(from, timeZone);
  const start = from.getTime();
  const end = start + horizonDays * 24 * 60 * 60 * 1000;

  for (let t = start + 60 * 60 * 1000; t <= end; t += 60 * 60 * 1000) {
    const instant = new Date(t);
    const offset = getOffsetMinutes(instant, timeZone);
    if (offset !== prevOffset) {
      return {
        at: instant,
        fromOffsetMinutes: prevOffset,
        toOffsetMinutes: offset,
        springForward: offset > prevOffset,
      };
    }
    prevOffset = offset;
  }

  return null;
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${pad2(m)}`;
}

function formatTransitionDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatShortTransitionDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatShiftHours(hours: number): string {
  if (hours > 0) return `+${hours}h`;
  return `${hours}h`;
}

export function getCityDstInfo(city: City, onDate: Date): CityDstInfo {
  if (!city.observesDst) {
    return {
      city,
      isDstOnDate: false,
      nextTransition: null,
      daysUntilTransition: null,
      shiftHours: null,
      note: null,
      shortLabel: null,
    };
  }

  // Use the planner's calendar Y-M-D (UTC noon anchor) as the wall date probe basis
  const year = onDate.getUTCFullYear();
  const month = onDate.getUTCMonth() + 1;
  const day = onDate.getUTCDate();
  const localNoon = zonedLocalToUtc(year, month, day, 12, 0, city.timeZone);

  const isDstOnDate = isDstAt(localNoon, city.timeZone);
  const nextTransition = findNextDstTransition(localNoon, city.timeZone);
  const daysUntilTransition = nextTransition
    ? Math.ceil(
        (nextTransition.at.getTime() - localNoon.getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  const shiftHours = nextTransition
    ? (nextTransition.toOffsetMinutes - nextTransition.fromOffsetMinutes) / 60
    : null;

  let note: string | null = null;
  let shortLabel: string | null = null;

  if (nextTransition && daysUntilTransition !== null && shiftHours !== null) {
    const direction = nextTransition.springForward
      ? "clocks spring forward"
      : "clocks fall back";
    const when = formatTransitionDate(nextTransition.at, city.timeZone);
    const offsets = `${formatOffset(nextTransition.fromOffsetMinutes)} → ${formatOffset(nextTransition.toOffsetMinutes)}`;
    const shift = formatShiftHours(shiftHours);

    if (daysUntilTransition <= 0) {
      note = `DST change around now (${direction}): ${offsets}`;
      shortLabel = `DST now · ${shift}`;
    } else if (daysUntilTransition <= 14) {
      note = `DST soon — in ${daysUntilTransition} day${daysUntilTransition === 1 ? "" : "s"} (${when}): ${direction}, ${offsets}`;
      shortLabel = `DST in ${daysUntilTransition} day${daysUntilTransition === 1 ? "" : "s"} · ${shift}`;
    } else if (daysUntilTransition <= 90) {
      note = `Upcoming DST — ${when}: ${direction}, ${offsets}`;
      shortLabel = `DST ${formatShortTransitionDay(nextTransition.at, city.timeZone)} · ${shift}`;
    } else {
      note = `Next DST — ${when}: ${direction}, ${offsets}`;
      shortLabel = `DST ${formatShortTransitionDay(nextTransition.at, city.timeZone)} · ${shift}`;
    }
  }

  return {
    city,
    isDstOnDate,
    nextTransition,
    daysUntilTransition,
    shiftHours,
    note,
    shortLabel,
  };
}

/**
 * East → west columns: higher UTC offset first, then further-east longitude.
 * Keeps Auckland left of Sydney, Berlin beside Paris, HK near Singapore, etc.
 */
export function sortCitiesEastToWest(
  cities: City[],
  atInstant: Date,
): City[] {
  return [...cities].sort((a, b) => {
    const offsetDiff =
      getOffsetMinutes(atInstant, b.timeZone) -
      getOffsetMinutes(atInstant, a.timeZone);
    if (offsetDiff !== 0) return offsetDiff;
    return b.longitude - a.longitude;
  });
}

export type MeetingRow = {
  masterHour: number;
  masterSlot: LocalSlot;
  cells: LocalSlot[];
};

/** Build 24 hourly rows for a calendar day in the master city's timezone. */
export function buildMeetingRows(
  year: number,
  month: number,
  day: number,
  master: City,
  cities: City[],
): MeetingRow[] {
  const rows: MeetingRow[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const instant = zonedLocalToUtc(year, month, day, hour, 0, master.timeZone);
    const masterSlot = describeLocalSlot(instant, master.timeZone);
    const cells = cities.map((city) =>
      describeLocalSlot(instant, city.timeZone),
    );
    rows.push({ masterHour: hour, masterSlot, cells });
  }

  return rows;
}

export function formatOffsetLabel(minutes: number): string {
  return formatOffset(minutes);
}

export function todayPartsInZone(timeZone: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = partsInZone(new Date(), timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function shiftYmd(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function formatLongDate(
  year: number,
  month: number,
  day: number,
): string {
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export { WEEKDAYS };
