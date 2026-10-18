import { fetchJson } from './fetchJson';

// Reaction GIFs from Giphy. Needs a free key in VITE_GIPHY_API_KEY; without one, reactions stay off.
export type Reaction = { url: string; title: string; pageUrl: string };
export type Moment = 'blunder' | 'queen' | 'checkmate' | 'promotion';

const API = 'https://api.giphy.com/v1/gifs/search';
const API_KEY: string = import.meta.env.VITE_GIPHY_API_KEY ?? '';
const RESULTS = 25;

// A few searches per moment, so the same few GIFs don't come up every game.
const SEARCHES: Record<Moment, string[]> = {
  blunder: ['facepalm', 'oops', 'big mistake', 'oh no', 'awkward'],
  queen: ['shocked', 'jaw drop', 'stunned', 'no way'],
  checkmate: ['victory dance', 'mic drop', 'celebration', 'game over'],
  promotion: ['level up', 'glow up', 'transformation'],
};

type GiphyAnswer = { data: { title: string; url: string; images: { fixed_height: { webp?: string; url: string } } }[] };

export const reactionsEnabled = () => API_KEY !== '';

const randomOf = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length)];

// A family-friendly (rating G) GIF for the moment, or null when off or anything fails.
export async function findReaction(moment: Moment, fetcher: typeof fetch = fetch, random: () => number = Math.random, key = API_KEY): Promise<Reaction | null> {
  if (!key) return null;
  const params = new URLSearchParams({ api_key: key, q: randomOf(SEARCHES[moment], random), limit: String(RESULTS), rating: 'g' });
  try {
    const { data } = await fetchJson<GiphyAnswer>(`${API}?${params}`, {}, fetcher);
    if (data.length === 0) return null;
    const gif = randomOf(data, random);
    return { url: gif.images.fixed_height.webp ?? gif.images.fixed_height.url, title: gif.title, pageUrl: gif.url };
  } catch {
    return null;
  }
}
