import type { CommentEvent, CommentFacts } from './events';
import { LINES } from './lines';

type Kind = CommentEvent['kind'];

function shuffled(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function fill(template: string, facts: CommentFacts): string {
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => facts[key as keyof CommentFacts] ?? '');
  // Capitalise each sentence, since a blank like {piece} can start one ("Calm. Pawn to d4.").
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

// A shuffle bag per event kind: every template is used once before any repeats,
// and a fresh round never starts with the line that ended the previous one.
export function createLinePicker(lines: Record<Kind, string[]> = LINES, random: () => number = Math.random) {
  const bags = new Map<Kind, number[]>();
  const last = new Map<Kind, number>();

  return function pick(event: CommentEvent): string {
    const templates = lines[event.kind];
    let bag = bags.get(event.kind);
    if (!bag || bag.length === 0) {
      bag = shuffled(templates.length, random);
      if (bag.length > 1 && bag[bag.length - 1] === last.get(event.kind)) bag.unshift(bag.pop()!);
      bags.set(event.kind, bag);
    }
    const index = bag.pop()!;
    last.set(event.kind, index);
    return fill(templates[index], event.facts);
  };
}
