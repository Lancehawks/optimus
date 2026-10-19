import { datetimeInput, zonedInputToDate } from './calendarTime.js';

export function editedTimedInstant(input, original, timeZone) {
  // A minute-precision input cannot represent seconds or which repeated DST hour
  // was selected. Preserve the original instant when the input was not changed.
  return original && input === datetimeInput(original, timeZone)
    ? new Date(original).toISOString()
    : zonedInputToDate(input, timeZone).toISOString();
}

export function changedEventFields(event, data) {
  const patch = { ...data };
  for (const key of Object.keys(patch)) {
    let before = event[key === 'projectId' ? 'project_id' : key];
    let after = patch[key];
    if (key === 'task_ids') {
      before = (event.linked_tasks || []).map(task => task.id).sort().join(',');
      after = [...after].sort().join(',');
    } else if (key === 'start_time' || key === 'end_time') {
      before = new Date(before).getTime();
      after = new Date(after).getTime();
    }
    if ((before ?? '') === (after ?? '')) delete patch[key];
  }
  return patch;
}
