/**
 * The studio profile (name, timezone, contact details) is read on almost every
 * request and changes a few times a year, so it is kept in memory briefly instead
 * of costing a database round trip each time. Saving the settings clears it.
 * The app runs as a single server process, so one in-memory copy is enough; with
 * several instances the others would simply catch up within the TTL.
 */
const TTL_MS = 60 * 1000;

const entries = new Map<string, { value: unknown; expires: number }>();

export async function cachedStudio<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const value = await load();
  entries.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function clearStudioCache() {
  entries.clear();
}
