import { readJson, writeJson } from '../storage';

// Finds a fun fact about an opening on Wikipedia. Pages are CC BY-SA, so every fact keeps a link to its article.
export type OpeningFact = { title: string; url: string; text: string };

const API = 'https://en.wikipedia.org/w/api.php';
const MAX_FACT_LENGTH = 240;
const USER_AGENT = 'Knightfall chess (https://github.com/Vraj-x2/Knightfall)';
const STORE_KEY = 'chess-opening-facts';
const cache = new Map<string, Promise<OpeningFact | null>>();

// Facts found earlier, kept across visits so a repeated opening never calls Wikipedia again.
const stored = () => readJson<Record<string, OpeningFact | null>>(STORE_KEY) ?? {};
const remember = (opening: string, fact: OpeningFact | null) => writeJson(STORE_KEY, { ...stored(), [opening]: fact });

class LookupFailed extends Error {}

// "Sicilian Defense: Najdorf Variation, English Attack" -> ["Sicilian Defence, Najdorf Variation", "Sicilian Defence"]:
// Wikipedia uses British spelling and "Family, Variation" titles. Most specific first.
export function candidateTitles(opening: string): string[] {
  const british = opening.replace(/Defense/g, 'Defence');
  const [family, rest] = british.split(': ');
  const variation = rest?.split(', ')[0];
  return variation ? [`${family}, ${variation}`, family] : [family];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// Redirects can land somewhere unrelated (the Borg Defence redirects to King's Pawn Game), so the page
// title must still contain the opening's first word.
function isSameOpening(requested: string, found: string): boolean {
  return normalize(found).includes(normalize(requested.split(/[\s,]/)[0]));
}

const TRIVIA_HINTS = /\b(1[5-9]\d\d|20\d\d|century|named|popular|champion|grandmaster|world|famous|first|oldest)\b/i;

// Picks the most trivia-like sentence of an article intro, skipping the move list and pronunciation guides.
export function pickFact(extract: string): string | null {
  const prose = extract
    .split('\n')
    .filter((line) => !/^\s*\d+\.(\.\.)?\s/.test(line) && !/:\s*$/.test(line))
    .join(' ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ');
  // A sentence ends at punctuation followed by a capital, so "followed by 2.d4" isn't cut at the move number.
  const sentences = prose
    .split(/(?<=[.!?])\s+(?=[A-Z"])/)
    .map((s) => s.trim())
    .filter((s) => /[.!?]$/.test(s) && s.length > 30 && s.length <= MAX_FACT_LENGTH && !/\bmoves?\b.*:/.test(s));
  return sentences.find((s) => TRIVIA_HINTS.test(s)) ?? sentences[0] ?? null;
}

async function fetchFact(title: string, fetcher: typeof fetch): Promise<OpeningFact | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: title,
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  // Wikimedia asks API clients to identify themselves; browsers can't set User-Agent, so this header stands in.
  const res = await fetcher(`${API}?${params}`, { headers: { 'Api-User-Agent': USER_AGENT } });
  if (!res.ok) throw new LookupFailed(`Wikipedia: ${res.status}`);
  // When rate limiting, Wikipedia can answer 200 with a plain-text notice instead of JSON.
  const body = await res.json().catch(() => {
    throw new LookupFailed('Wikipedia: unreadable answer');
  });
  const page = body?.query?.pages?.[0];
  if (!page || page.missing || !page.extract || !isSameOpening(title, page.title)) return null;
  const text = pickFact(page.extract);
  if (!text) return null;
  return { title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, text };
}

// Tries the variation's page, then the family's. A clear "no page" is remembered; a failed request
// (offline, blocked, rate limited) is not, so a later game tries again.
export function findOpeningFact(opening: string, fetcher: typeof fetch = fetch): Promise<OpeningFact | null> {
  const known = stored();
  if (opening in known) return Promise.resolve(known[opening]);
  let found = cache.get(opening);
  if (!found) {
    found = (async () => {
      for (const title of candidateTitles(opening)) {
        const fact = await fetchFact(title, fetcher);
        if (fact) return fact;
      }
      return null;
    })().then(
      (fact) => {
        remember(opening, fact);
        return fact;
      },
      () => {
        cache.delete(opening);
        return null;
      },
    );
    cache.set(opening, found);
  }
  return found;
}
