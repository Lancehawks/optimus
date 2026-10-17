// Only locally changed fields may be sent back to an existing Google event.
export function buildGooglePatch(event, remote, { withStatus, recurrence, getStatus = () => null }) {
  const dirty = event.google_dirty_fields || {};
  const patch = {};
  if (dirty.title) patch.summary = event.title;
  if (dirty.location) patch.location = event.location || '';
  if (dirty.description || dirty.status) {
    const status = dirty.status ? event.status : getStatus(remote);
    const description = dirty.description ? event.description : remote.description;
    patch.description = status ? withStatus(description, status) : (description || '');
  }
  if (dirty.start_time || dirty.all_day) {
    patch.start = event.all_day ? { date: event.start_date, dateTime: null, timeZone: null }
      : { ...remote.start, date: null, dateTime: new Date(event.start_time).toISOString(), timeZone: remote.start?.timeZone || event.event_timezone || 'UTC' };
  }
  if (dirty.end_time || dirty.all_day) {
    patch.end = event.all_day ? { date: event.end_date, dateTime: null, timeZone: null }
      : { ...remote.end, date: null, dateTime: new Date(event.end_time).toISOString(), timeZone: remote.end?.timeZone || event.event_timezone || 'UTC' };
  }
  if (dirty.recurrence_rule) patch.recurrence = recurrence(event.recurrence_rule) || [];
  if (dirty.status || dirty.event_type) {
    patch.extendedProperties = {
      ...remote.extendedProperties,
      private: {
        ...remote.extendedProperties?.private,
        optimus_event_id: event.id,
        ...(dirty.status ? { optimus_status: event.status } : {}),
        ...(dirty.event_type ? { optimus_event_type: event.event_type } : {}),
      },
    };
  }
  return patch;
}

// Old installations did not record which fields changed. Only an exact comparison
// can clear that uncertainty; never infer that a difference should be pushed.
export function legacyEventMatches(event, remote, { stripStatus, getStatus, recurrence }) {
  const dirty = event.google_dirty_fields || {};
  const same = (field, left, right) => dirty[field] || (left ?? '') === (right ?? '');
  const allDay = Boolean(remote.start?.date);
  const instant = value => value ? new Date(value).getTime() : null;
  return remote.status !== 'cancelled'
    && same('title', event.title, remote.summary || '(No title)')
    && same('description', stripStatus(event.description), stripStatus(remote.description))
    && same('location', event.location, remote.location)
    && same('status', event.status || 'scheduled', getStatus(remote) || 'scheduled')
    && same('all_day', Boolean(event.all_day), allDay)
    && (dirty.all_day || (same('start_time', allDay ? event.start_date : instant(event.start_time), allDay ? remote.start?.date : instant(remote.start?.dateTime))
      && same('end_time', allDay ? event.end_date : instant(event.end_time), allDay ? remote.end?.date : instant(remote.end?.dateTime))))
    && same('recurrence_rule', event.recurrence_rule, recurrence(remote.recurrence));
}
