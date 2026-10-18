import { readJson, writeJson } from '../storage';
import { fetchJson } from './fetchJson';

// NASA's Astronomy Picture of the Day. The shared DEMO_KEY allows only a few calls an hour per address,
// so the picture is fetched at most once a day and kept in the browser. Set VITE_NASA_API_KEY for a real key.
export type SpacePicture = { date: string; title: string; imageUrl: string; pageUrl: string; copyright?: string };

const API = 'https://api.nasa.gov/planetary/apod';
const API_KEY: string = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
const STORE_KEY = 'chess-apod';

type ApodAnswer = { date: string; title: string; media_type: string; url: string; thumbnail_url?: string; copyright?: string };

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function cached(today: string): SpacePicture | null {
  const saved = readJson<{ fetchedOn: string; picture: SpacePicture }>(STORE_KEY);
  return saved?.fetchedOn === today ? saved.picture : null;
}

const save = (today: string, picture: SpacePicture) => writeJson(STORE_KEY, { fetchedOn: today, picture });

function toPicture(a: ApodAnswer): SpacePicture | null {
  // Some days are videos; their thumbnail still makes a good background.
  const imageUrl = a.media_type === 'image' ? a.url : a.thumbnail_url;
  if (!imageUrl) return null;
  const compact = a.date.replace(/-/g, '').slice(2);
  return { date: a.date, title: a.title, imageUrl, pageUrl: `https://apod.nasa.gov/apod/ap${compact}.html`, copyright: a.copyright?.trim() };
}

// Today's picture, or yesterday's if today's isn't published yet (NASA posts on US Eastern time).
export async function getSpacePicture(now = new Date(), fetcher: typeof fetch = fetch): Promise<SpacePicture | null> {
  const today = localDate(now);
  const hit = cached(today);
  if (hit) return hit;
  const yesterday = localDate(new Date(now.getTime() - 86_400_000));
  for (const date of [today, yesterday]) {
    try {
      const picture = toPicture(await fetchJson<ApodAnswer>(`${API}?api_key=${API_KEY}&thumbs=true&date=${date}`, {}, fetcher));
      if (picture) {
        save(today, picture);
        return picture;
      }
    } catch {
      // Try the previous day, then give up quietly: the plain background stays.
    }
  }
  return null;
}
