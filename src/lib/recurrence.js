/**
 * Expand recurring events into virtual instances within a date range.
 * Expansion-on-read strategy: master events store the recurrence rule,
 * and this utility generates virtual occurrences for display.
 */

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getOccurrenceDateKeyFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {Array} masterEvents - Recurring event rows from the database
 * @param {Date} rangeStart - Start of the visible range
 * @param {Date} rangeEnd - End of the visible range
 * @returns {Array} Virtual event instances with composite IDs
 */
export function expandRecurrences(masterEvents, rangeStart, rangeEnd) {
  const instances = [];

  for (const master of masterEvents) {
    const rule = master.recurrence_rule;
    if (!rule) continue;

    const masterStart = new Date(master.start_time);
    const masterEnd = new Date(master.end_time);
    const duration = masterEnd.getTime() - masterStart.getTime();

    // Parse custom weekday rules like "custom:Mon,Wed,Fri"
    let customDays = null;
    let ruleType = rule;
    if (rule.startsWith("custom:")) {
      ruleType = "custom";
      customDays = new Set(
        rule
          .slice(7)
          .split(",")
          .map((d) => DAY_MAP[d.trim()])
          .filter((d) => d !== undefined)
      );
    }

    // Generate occurrences by stepping through dates
    const cursor = new Date(masterStart);
    const maxIterations = 1000; // Safety limit
    let iterations = 0;

    while (cursor <= rangeEnd && iterations < maxIterations) {
      iterations++;

      if (cursor >= rangeStart) {
        const instanceStart = new Date(cursor);
        const instanceEnd = new Date(cursor.getTime() + duration);
        const dateKey = getOccurrenceDateKeyFromDate(instanceStart);

        // For custom rules, only emit if the day matches
        if (ruleType === "custom" && !customDays.has(cursor.getDay())) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        instances.push({
          ...master,
          id: `${master.id}___${dateKey}`,
          start_time: instanceStart.toISOString(),
          end_time: instanceEnd.toISOString(),
          _isRecurrenceInstance: true,
          _masterEventId: master.id,
          _occurrenceDate: dateKey,
        });
      }

      // Step forward based on rule type
      switch (ruleType) {
        case "daily":
          cursor.setDate(cursor.getDate() + 1);
          break;
        case "weekly":
          cursor.setDate(cursor.getDate() + 7);
          break;
        case "monthly":
          cursor.setMonth(cursor.getMonth() + 1);
          break;
        case "yearly":
          cursor.setFullYear(cursor.getFullYear() + 1);
          break;
        case "custom":
          cursor.setDate(cursor.getDate() + 1);
          break;
        default:
          iterations = maxIterations; // Unknown rule, stop
      }
    }
  }

  return instances;
}

/**
 * Extract the master event ID from a potentially composite instance ID.
 * @param {string} id - Event ID, possibly "masterId___2026-02-25"
 * @returns {string} The master event UUID
 */
export function getMasterEventId(id) {
  if (typeof id === "string" && id.includes("___")) {
    return id.split("___")[0];
  }
  return id;
}

export function isRecurrenceInstanceId(id) {
  return typeof id === "string" && id.includes("___");
}

export function getOccurrenceDateKey(id, fallbackDate) {
  if (isRecurrenceInstanceId(id)) {
    const [, dateKey] = id.split("___");
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
  }
  return fallbackDate ? getOccurrenceDateKeyFromDate(fallbackDate) : null;
}
