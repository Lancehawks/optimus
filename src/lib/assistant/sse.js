// Streams an async iterable of JSON events as Server-Sent Events. Each event is
// one `data:` line. Cancelling the response (the client went away) stops the
// iterable and calls onCancel so in-flight model calls can be aborted.
export function eventStreamResponse(events, { onCancel } = {}) {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
    },
    async cancel() {
      onCancel?.();
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
