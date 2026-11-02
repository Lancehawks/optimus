function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    code: error.code || undefined,
    stack: error.stack || undefined,
  };
}

function write(level, event, context = {}, error = null) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "optimus-web",
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || undefined,
    ...context,
    error: serializeError(error),
  });
  if (level === "error") console.error(payload);
  else console.info(payload);
}

export function logError(event, error, context) {
  write("error", event, context, error);
}

export function logInfo(event, context) {
  write("info", event, context);
}
