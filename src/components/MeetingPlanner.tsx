"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CITIES,
  DEFAULT_CITY_IDS,
  DEFAULT_MASTER_CITY_ID,
  getCity,
  type City,
} from "@/lib/cities";
import {
  buildMeetingRows,
  formatLongDate,
  formatOffsetLabel,
  getCityDstInfo,
  shiftYmd,
  sortCitiesEastToWest,
  todayPartsInZone,
  zonedLocalToUtc,
  type HourBand,
  type LocalSlot,
} from "@/lib/meeting-time";

function Star() {
  return (
    <span aria-hidden className="inline-block text-[10px] leading-none text-warm-500">
      ✦
    </span>
  );
}

function bandClass(band: HourBand): string {
  if (band === "ideal") return "meet-band-ideal";
  if (band === "ok") return "meet-band-ok";
  return "meet-band-bad";
}

function hoursInRange(a: number, b: number): number[] {
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const hours: number[] = [];
  for (let h = start; h <= end; h += 1) hours.push(h);
  return hours;
}

function CellContent({ slot }: { slot: LocalSlot }) {
  return (
    <span className="meet-cell-text">
      <span className="meet-cell-day">
        {slot.weekday} {slot.day}/{slot.month}
      </span>
      <span className="meet-cell-time">
        {slot.hour === 0 && slot.minute === 0
          ? "midnight"
          : slot.hour === 12 && slot.minute === 0
            ? "noon"
            : `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`}
        {slot.isDst ? (
          <span className="meet-dst-mark" title="Daylight saving in effect">
            {" "}
            *
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function MeetingPlanner() {
  const sydney = getCity(DEFAULT_MASTER_CITY_ID)!;

  // Stable SSR defaults — sync to "today" in the master zone after mount
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);
  const [day, setDay] = useState(14);
  const [masterId, setMasterId] = useState(DEFAULT_MASTER_CITY_ID);
  const [selectedIds, setSelectedIds] = useState<string[]>([...DEFAULT_CITY_IDS]);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());

  const dragRef = useRef<{
    active: boolean;
    startHour: number;
    mode: "add" | "remove";
    baseline: Set<number>;
    moved: boolean;
  } | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const master = getCity(masterId) ?? sydney;

  const didSyncToday = useRef(false);
  useEffect(() => {
    if (didSyncToday.current) return;
    didSyncToday.current = true;
    const t = todayPartsInZone(master.timeZone);
    setYear(t.year);
    setMonth(t.month);
    setDay(t.day);
  }, [master.timeZone]);

  const sortAnchor = useMemo(
    () => zonedLocalToUtc(year, month, day, 12, 0, master.timeZone),
    [year, month, day, master.timeZone],
  );

  const orderedCities = useMemo(() => {
    const cities = selectedIds
      .map((id) => getCity(id))
      .filter((c): c is City => Boolean(c));
    if (!cities.some((c) => c.id === masterId)) {
      cities.push(master);
    }
    return sortCitiesEastToWest(cities, sortAnchor);
  }, [selectedIds, masterId, master, sortAnchor]);

  const rows = useMemo(
    () => buildMeetingRows(year, month, day, master, orderedCities),
    [year, month, day, master, orderedCities],
  );

  const anchorInstant = useMemo(
    () => new Date(Date.UTC(year, month - 1, day, 12)),
    [year, month, day],
  );

  const dstByCityId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCityDstInfo>>();
    for (const city of orderedCities) {
      map.set(city.id, getCityDstInfo(city, anchorInstant));
    }
    return map;
  }, [orderedCities, anchorInstant]);

  const dstInfos = useMemo(
    () =>
      orderedCities
        .map((city) => dstByCityId.get(city.id)!)
        .filter((info) => info.note),
    [orderedCities, dstByCityId],
  );

  useEffect(() => {
    function onPointerUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  function goToday() {
    const t = todayPartsInZone(master.timeZone);
    setYear(t.year);
    setMonth(t.month);
    setDay(t.day);
  }

  function shiftDay(delta: number) {
    const next = shiftYmd(year, month, day, delta);
    setYear(next.year);
    setMonth(next.month);
    setDay(next.day);
  }

  function toggleCity(id: string) {
    if (id === masterId) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function onMasterChange(nextId: string) {
    setMasterId(nextId);
    setSelectedIds((prev) =>
      prev.includes(nextId) ? prev : [nextId, ...prev],
    );
  }

  function applyDragToHour(hour: number) {
    const drag = dragRef.current;
    if (!drag?.active) return;

    if (hour !== drag.startHour) drag.moved = true;

    const range = hoursInRange(drag.startHour, hour);
    setSelectedHours(() => {
      const next = new Set(drag.baseline);
      for (const h of range) {
        if (drag.mode === "add") next.add(h);
        else next.delete(h);
      }
      return next;
    });
  }

  function onRowPointerDown(hour: number, event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();

    const baseline = new Set(selectedHours);
    const mode = baseline.has(hour) ? "remove" : "add";
    dragRef.current = {
      active: true,
      startHour: hour,
      mode,
      baseline,
      moved: false,
    };

    setSelectedHours(() => {
      const next = new Set(baseline);
      if (mode === "add") next.add(hour);
      else next.delete(hour);
      return next;
    });
  }

  function onRowPointerEnter(hour: number) {
    setHoveredHour(hour);
    applyDragToHour(hour);
  }

  function onOutsidePointerDown(event: ReactPointerEvent) {
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    if (wrap.contains(event.target as Node)) return;
    setSelectedHours(new Set());
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    <div
      className="labs-shell meet-shell"
      onPointerDown={onOutsidePointerDown}
    >
      <main className="mx-auto w-full max-w-[88rem] px-4 py-10 sm:px-6 sm:py-14">
        <header className="labs-enter meet-header">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href="https://labs.thequietachievr.com"
              className="text-sm text-warm-700 underline decoration-paper-200 underline-offset-4 transition-colors hover:text-ember hover:decoration-ember"
            >
              ← Labs
            </a>
            <div className="flex items-center gap-2">
              <Star />
              <p className="eyebrow text-warm-500">Quiet Achiever Labs</p>
              <Star />
            </div>
          </div>

          <h1 className="display-headline mt-6 text-[2.2rem] text-charcoal sm:text-[2.75rem]">
            Meeting Planner
          </h1>
          <p className="mt-3 max-w-2xl font-display text-lg italic leading-relaxed text-ink">
            Find an overlapping hour across cities — anchored to your master
            city, with daylight-saving changes called out.
          </p>
        </header>

        <section
          aria-label="Planner controls"
          className="labs-enter-delay meet-controls mt-8"
        >
          <div className="meet-control-row">
            <label className="meet-field">
              <span className="meet-label">Master city</span>
              <select
                value={masterId}
                onChange={(e) => onMasterChange(e.target.value)}
                className="meet-select"
              >
                {CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} ({city.country})
                  </option>
                ))}
              </select>
            </label>

            <label className="meet-field">
              <span className="meet-label">Day</span>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="meet-select"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="meet-field">
              <span className="meet-label">Month</span>
              <select
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  const max = new Date(Date.UTC(year, m, 0)).getUTCDate();
                  if (day > max) setDay(max);
                }}
                className="meet-select"
              >
                {[
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ].map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="meet-field">
              <span className="meet-label">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="meet-select"
              >
                {[2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="meet-nav-row">
            <button type="button" className="meet-nav-btn" onClick={() => shiftDay(-1)}>
              ← Previous day
            </button>
            <button type="button" className="meet-nav-btn" onClick={goToday}>
              Today
            </button>
            <button type="button" className="meet-nav-btn" onClick={() => shiftDay(1)}>
              Next day →
            </button>
            <p className="meet-date-label font-display">
              {formatLongDate(year, month, day)}
              <span className="text-warm-500"> · in {master.name}</span>
            </p>
          </div>
        </section>

        <section aria-label="Cities" className="labs-enter-delay mt-6">
          <p className="eyebrow text-warm-500">Cities in the grid</p>
          <ul className="meet-city-chips mt-3">
            {CITIES.map((city) => {
              const on = selectedIds.includes(city.id) || city.id === masterId;
              const isMaster = city.id === masterId;
              return (
                <li key={city.id}>
                  <button
                    type="button"
                    className={`meet-chip${on ? " is-on" : ""}${isMaster ? " is-master" : ""}`}
                    onClick={() => (isMaster ? undefined : toggleCity(city.id))}
                    disabled={isMaster}
                    title={
                      isMaster
                        ? "Master city — change via Master city select"
                        : on
                          ? `Remove ${city.name}`
                          : `Add ${city.name}`
                    }
                  >
                    {city.name}
                    {isMaster ? " · master" : ""}
                    {city.observesDst ? " *" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-warm-500">
            Columns sort east → west by time zone (master stays highlighted in
            place).
          </p>
        </section>

        <section
          aria-label="Meeting time grid"
          className="labs-enter-delay mt-8"
        >
          <p className="mb-3 text-sm text-warm-700">
            Hover to preview · click or drag to multi-select · click outside to
            clear. Colour = local hour comfort.{" "}
            <span className="text-warm-500">* = daylight saving in effect.</span>
          </p>

          <div ref={tableWrapRef} className="meet-table-wrap">
            <table className="meet-table">
              <thead>
                <tr>
                  {orderedCities.map((city, index) => {
                    const slot = rows[12]?.cells[index];
                    const offset = slot
                      ? formatOffsetLabel(slot.offsetMinutes)
                      : "";
                    const dst = dstByCityId.get(city.id);
                    return (
                      <th
                        key={city.id}
                        scope="col"
                        className={
                          city.id === masterId ? "meet-th is-master" : "meet-th"
                        }
                      >
                        <span className="meet-th-name">{city.name}</span>
                        <span className="meet-th-meta">
                          {offset}
                          {city.id === masterId ? " · master" : ""}
                        </span>
                        {dst?.shortLabel ? (
                          <span
                            className={`meet-th-dst${
                              dst.daysUntilTransition !== null &&
                              dst.daysUntilTransition <= 14
                                ? " is-soon"
                                : ""
                            }`}
                            title={dst.note ?? undefined}
                          >
                            {dst.shortLabel}
                          </span>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody onPointerLeave={() => setHoveredHour(null)}>
                {rows.map((row) => {
                  const isHovered = hoveredHour === row.masterHour;
                  const isSelected = selectedHours.has(row.masterHour);
                  return (
                    <tr
                      key={row.masterHour}
                      className={`meet-row${isHovered ? " is-hover" : ""}${isSelected ? " is-selected" : ""}`}
                      onPointerEnter={() => onRowPointerEnter(row.masterHour)}
                      onPointerDown={(e) =>
                        onRowPointerDown(row.masterHour, e)
                      }
                    >
                      {row.cells.map((cell, i) => (
                        <td
                          key={`${row.masterHour}-${orderedCities[i].id}`}
                          className={`meet-td ${bandClass(cell.band)}`}
                        >
                          <CellContent slot={cell} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="labs-enter-delay meet-legend mt-8">
          <p className="eyebrow text-warm-500">Legend</p>
          <ul className="mt-3 flex flex-wrap gap-4 text-sm text-warm-700">
            <li className="flex items-center gap-2">
              <span className="meet-swatch meet-band-ideal" /> Ideal (09:00–17:00)
            </li>
            <li className="flex items-center gap-2">
              <span className="meet-swatch meet-band-ok" /> Stretch (07–09, 17–22)
            </li>
            <li className="flex items-center gap-2">
              <span className="meet-swatch meet-band-bad" /> Unlikely (22:00–07:00)
            </li>
            <li className="flex items-center gap-2">
              <span className="meet-swatch meet-swatch-hover" /> Row hover
            </li>
            <li className="flex items-center gap-2">
              <span className="meet-swatch meet-swatch-selected" /> Row selected
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-charcoal">*</span> On daylight
              saving time that day
            </li>
          </ul>

          {dstInfos.length > 0 ? (
            <div className="mt-6">
              <p className="eyebrow text-warm-500">DST notes (from selected date)</p>
              <ul className="mt-2 space-y-1 text-sm text-warm-700">
                {dstInfos.map((info) => (
                  <li key={`note-${info.city.id}`}>
                    <span className="font-semibold text-charcoal">
                      {info.city.name}
                    </span>
                    {" — "}
                    {info.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-warm-500">
              No daylight-saving transitions ahead for the selected cities (or
              they do not observe DST).
            </p>
          )}
        </section>

        <footer className="labs-enter-delay mt-12 text-center text-sm text-warm-500">
          <p>
            Offsets via IANA time zones · DST from Oct 2026 onward ·{" "}
            <a
              href="https://www.thequietachievr.com"
              className="text-warm-700 underline decoration-paper-200 underline-offset-4 transition-colors hover:text-ember hover:decoration-ember"
            >
              The Quiet Achiever
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
