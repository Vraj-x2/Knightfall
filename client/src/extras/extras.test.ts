import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSpacePicture } from './apod';
import { adviceSlip, dadJoke, kanyeQuote } from './funApis';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const NOW = new Date(2026, 9, 18, 0, 30); // just after midnight: today's picture may not be out yet

// Tests run in Node, which has no localStorage: give each test an empty in-memory one.
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
});

describe('NASA picture of the day', () => {
  it("falls back to yesterday's picture when today's isn't published", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      const date = new URL(url).searchParams.get('date')!;
      asked.push(date);
      return date === '2026-10-18'
        ? json({ code: 500 }, 500)
        : json({ date, title: 'Eagle Nebula', media_type: 'image', url: 'https://apod.nasa.gov/x.jpg' });
    }) as typeof fetch;
    const picture = await getSpacePicture(NOW, fetcher);
    expect(asked).toEqual(['2026-10-18', '2026-10-17']);
    expect(picture).toMatchObject({ title: 'Eagle Nebula', pageUrl: 'https://apod.nasa.gov/apod/ap261017.html' });
  });

  it('calls NASA once a day, then serves the saved picture', async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      return json({ date: '2026-10-18', title: 'Moon', media_type: 'image', url: 'https://apod.nasa.gov/m.jpg' });
    }) as typeof fetch;
    await getSpacePicture(NOW, fetcher);
    expect((await getSpacePicture(NOW, fetcher))?.title).toBe('Moon');
    expect(calls).toBe(1);
  });

  it("uses a video day's thumbnail, and gives up quietly when NASA is down", async () => {
    const video = (async () =>
      json({ date: '2026-10-18', title: 'Launch', media_type: 'video', url: 'https://youtube.com/x', thumbnail_url: 'https://img/t.jpg' })) as typeof fetch;
    expect((await getSpacePicture(NOW, video))?.imageUrl).toBe('https://img/t.jpg');
    localStorage.setItem('chess-apod', 'null');
    const down = (async () => json({ code: 500 }, 500)) as typeof fetch;
    expect(await getSpacePicture(NOW, down)).toBeNull();
  });
});

describe('fun APIs', () => {
  it('reads each service', async () => {
    expect(await dadJoke((async () => json({ joke: 'Aware wolf.' })) as typeof fetch)).toBe('Aware wolf.');
    expect(await kanyeQuote((async () => json({ quote: 'Build the future' })) as typeof fetch)).toBe('Build the future');
    expect(await adviceSlip((async () => json({ slip: { advice: 'Drink water.' } })) as typeof fetch)).toBe('Drink water.');
  });

  it('returns null instead of throwing when a service fails', async () => {
    const broken = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await dadJoke(broken)).toBeNull();
    expect(await kanyeQuote((async () => new Response('nope', { status: 503 })) as typeof fetch)).toBeNull();
    expect(await adviceSlip((async () => new Response('not json')) as typeof fetch)).toBeNull();
  });
});
