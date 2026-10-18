const TIMEOUT_MS = 8_000;

// GET a JSON API with a timeout. Throws on network errors, bad status or a body that isn't JSON.
export async function fetchJson<T>(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
  return res.json() as Promise<T>;
}
