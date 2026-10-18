import { afterEach, describe, expect, it, vi } from 'vitest';
import { readItem, readJson, writeItem, writeJson } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('round-trips text and JSON', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    writeItem('a', '1');
    writeJson('b', { x: 2 });
    expect(readItem('a')).toBe('1');
    expect(readJson('b')).toEqual({ x: 2 });
  });

  it('treats corrupt JSON as absent', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{not json', setItem: () => undefined });
    expect(readJson('b')).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(readItem('a')).toBeNull();
    expect(() => writeJson('a', 1)).not.toThrow();
  });
});
