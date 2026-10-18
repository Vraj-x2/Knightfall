import { fetchJson } from './fetchJson';

// Free, keyless joke and quote APIs. Each returns null on any failure so the commentary just skips the bit.
const attempt = async <T,>(load: () => Promise<T>): Promise<T | null> => {
  try {
    return await load();
  } catch {
    return null;
  }
};

export const dadJoke = (fetcher?: typeof fetch) =>
  attempt(async () => (await fetchJson<{ joke: string }>('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } }, fetcher)).joke);

export const kanyeQuote = (fetcher?: typeof fetch) =>
  attempt(async () => (await fetchJson<{ quote: string }>('https://api.kanye.rest/', {}, fetcher)).quote);

// Advice Slip caches its answer for a couple of seconds; `cache: 'no-store'` keeps repeat calls fresh.
export const adviceSlip = (fetcher?: typeof fetch) =>
  attempt(async () => (await fetchJson<{ slip: { advice: string } }>('https://api.adviceslip.com/advice', { cache: 'no-store' }, fetcher)).slip.advice);
