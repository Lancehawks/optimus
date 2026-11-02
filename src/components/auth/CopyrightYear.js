import { cacheLife } from "next/cache";

// Rendered into the cached page shell and refreshed daily, so the clock isn't
// read on every request.
export default async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
