import { logError } from "@/lib/logger";

export async function register() {}

export function onRequestError(error, request, context) {
  logError("request.unhandled_error", error, {
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
}
