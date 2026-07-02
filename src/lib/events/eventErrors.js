export class EventRouteError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "EventRouteError";
    this.status = status;
  }
}

export function failEventRequest(message, status = 400) {
  throw new EventRouteError(message, status);
}
