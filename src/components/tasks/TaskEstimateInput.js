"use client";

import { Input } from "@/components/ui";
import { cleanEstimateInput } from "@/lib/taskEstimate";

function EstimatePart({ label, unit, value, onChange }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-14">
        <Input
          size="sm"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(cleanEstimateInput(event.target.value))}
        />
      </span>
      <span className="text-xs text-muted">{unit}</span>
    </span>
  );
}

/** Optional hours and minutes. Parents keep the raw strings; see lib/taskEstimate. */
export default function TaskEstimateInput({ hours, minutes, onHoursChange, onMinutesChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <EstimatePart label="Estimated hours" unit="hrs" value={hours} onChange={onHoursChange} />
      <EstimatePart label="Estimated minutes" unit="mins" value={minutes} onChange={onMinutesChange} />
    </div>
  );
}
