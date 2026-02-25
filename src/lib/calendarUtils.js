/**
 * Calendar date math utilities for the frontend.
 */

const HOUR_HEIGHT = 60; // pixels per hour slot
const DAY_START_HOUR = 0; // 12:00 AM
const DAY_END_HOUR = 24; // 11:59 PM
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;

export { HOUR_HEIGHT, DAY_START_HOUR, DAY_END_HOUR, TOTAL_HOURS };

/**
 * Get 42 Date objects filling a 6-week month grid (Sun start).
 */
export function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const days = [];

  // Previous month overflow
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  // Next month overflow to fill 42 cells
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }

  return days;
}

/**
 * Get 7 Date objects for the week containing the given date (Sunday start).
 */
export function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(sunday);
    dayDate.setDate(sunday.getDate() + i);
    days.push(dayDate);
  }
  return days;
}

/**
 * Get the visible date range for API queries based on view mode.
 */
export function getVisibleRange(currentDate, viewMode) {
  const d = new Date(currentDate);

  switch (viewMode) {
    case "month": {
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const start = new Date(year, month, 1 - firstDay);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 42);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "week": {
      const days = getWeekDates(d);
      const start = new Date(days[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(days[6]);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "day": {
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    default:
      return { start: d, end: d };
  }
}

/**
 * Calculate pixel position and height for an event block on the time grid.
 */
export function getEventPosition(event, dayDate) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  // Clamp to the day boundaries
  const dayStart = new Date(dayDate);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const clampedStart = start < dayStart ? dayStart : start;
  const clampedEnd = end > dayEnd ? dayEnd : end;

  const startMinutes =
    (clampedStart.getHours() - DAY_START_HOUR) * 60 + clampedStart.getMinutes();
  const endMinutes =
    (clampedEnd.getHours() - DAY_START_HOUR) * 60 + clampedEnd.getMinutes();

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20); // min 20px

  return { top, height };
}

/**
 * Group overlapping events and assign column indices for layout.
 * Returns events with added `columnIndex` and `totalColumns` properties.
 */
export function groupOverlappingEvents(events) {
  if (events.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.start_time) - new Date(b.start_time);
    if (diff !== 0) return diff;
    return (
      new Date(b.end_time) -
      new Date(b.start_time) -
      (new Date(a.end_time) - new Date(a.start_time))
    );
  });

  // Group into overlapping clusters
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const clusterEnd = Math.max(
      ...currentCluster.map((e) => new Date(e.end_time).getTime())
    );

    if (new Date(event.start_time).getTime() < clusterEnd) {
      currentCluster.push(event);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
  const result = [];
  for (const cluster of clusters) {
    const columns = [];

    for (const event of cluster) {
      const eventStart = new Date(event.start_time).getTime();

      // Find first available column
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col];
        if (new Date(lastInCol.end_time).getTime() <= eventStart) {
          columns[col] = event;
          result.push({ ...event, columnIndex: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push(event);
        result.push({
          ...event,
          columnIndex: columns.length - 1,
          totalColumns: 0,
        });
      }
    }

    // Set totalColumns for all events in this cluster
    const totalCols = columns.length;
    for (const r of result) {
      if (cluster.some((e) => e.id === r.id) && r.totalColumns === 0) {
        r.totalColumns = totalCols;
      }
    }
  }

  return result;
}

/**
 * Format time as "9:00 AM" style.
 */
export function formatTimeShort(date) {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Check if two dates are the same day.
 */
export function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Check if a date is today.
 */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/**
 * Get events for a specific day from a list.
 */
export function getEventsForDay(events, day) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return start <= dayEnd && end >= dayStart;
  });
}

/**
 * Get the display label for the current view header.
 */
export function getHeaderLabel(currentDate, viewMode) {
  const d = new Date(currentDate);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  switch (viewMode) {
    case "month":
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    case "week": {
      const week = getWeekDates(d);
      const start = week[0];
      const end = week[6];
      if (start.getMonth() === end.getMonth()) {
        return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    case "day":
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    default:
      return "";
  }
}

/**
 * Navigate to the previous period based on view mode.
 */
export function navigatePrev(currentDate, viewMode) {
  const d = new Date(currentDate);
  switch (viewMode) {
    case "month":
      d.setMonth(d.getMonth() - 1);
      break;
    case "week":
      d.setDate(d.getDate() - 7);
      break;
    case "day":
      d.setDate(d.getDate() - 1);
      break;
  }
  return d;
}

/**
 * Navigate to the next period based on view mode.
 */
export function navigateNext(currentDate, viewMode) {
  const d = new Date(currentDate);
  switch (viewMode) {
    case "month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "week":
      d.setDate(d.getDate() + 7);
      break;
    case "day":
      d.setDate(d.getDate() + 1);
      break;
  }
  return d;
}
