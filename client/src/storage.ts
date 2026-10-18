// Browser storage that never throws. Private windows, blocked site data or a full quota make localStorage
// fail; then reads return null and writes are dropped, so a setting lasts until the page closes.
export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // See above: storage unavailable.
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; // corrupt or from an older version: treat as absent
  }
}

export const writeJson = (key: string, value: unknown) => writeItem(key, JSON.stringify(value));
