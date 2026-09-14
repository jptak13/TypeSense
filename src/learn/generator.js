import { getFocusAreas, normalizeProfile } from './profile.js';

const vocabulary = {
  nouns: ['artist', 'bird', 'bridge', 'camera', 'captain', 'cloud', 'comet', 'crow', 'desert', 'dream', 'engine', 'falcon', 'field', 'forest', 'garden', 'harbor', 'island', 'journey', 'lantern', 'market', 'meadow', 'mirror', 'mountain', 'ocean', 'painter', 'path', 'rabbit', 'river', 'scholar', 'shadow', 'signal', 'sparrow', 'storm', 'student', 'teacher', 'thunder', 'tower', 'traveler', 'valley', 'village', 'waterfall', 'whisper', 'window', 'writer'],
  adjectives: ['ancient', 'bold', 'bright', 'calm', 'clever', 'distant', 'eager', 'gentle', 'golden', 'hidden', 'hollow', 'lively', 'misty', 'narrow', 'patient', 'quiet', 'rapid', 'restless', 'silver', 'steady', 'stormy', 'swift', 'tall', 'vivid', 'warm', 'weathered', 'wild'],
  verbs: ['appears', 'climbs', 'crosses', 'drifts', 'follows', 'gathers', 'glides', 'greets', 'guides', 'listens', 'moves', 'notices', 'passes', 'rests', 'returns', 'searches', 'shines', 'travels', 'waits', 'wanders', 'watches'],
  adverbs: ['boldly', 'calmly', 'carefully', 'gently', 'patiently', 'quietly', 'slowly', 'softly', 'steadily', 'swiftly', 'warmly'],
  places: ['above', 'across', 'along', 'around', 'behind', 'below', 'beside', 'beyond', 'inside', 'near', 'over', 'past', 'through', 'toward', 'under', 'within'],
};

const templates = {
  6: (word) => ['The', word('adjectives'), word('nouns'), word('verbs'), 'near', word('nouns')],
  7: (word) => ['A', word('adjectives'), word('nouns'), word('verbs'), word('adverbs'), 'beyond', word('nouns')],
  8: (word) => ['The', word('nouns'), 'and', 'the', word('nouns'), word('verbs'), 'near', word('nouns')],
  9: (word) => ['While', 'the', word('nouns'), word('verbs'), 'the', word('adjectives'), word('nouns'), 'waits', 'nearby'],
  10: (word) => ['A', word('adjectives'), word('nouns'), word('verbs'), word('places'), 'the', word('adjectives'), word('nouns'), 'and', 'rests'],
};

function weightedPick(items, scorer) {
  const weighted = items.map((item) => ({ item, weight: Math.max(0.05, scorer(item)) }));
  let cursor = Math.random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted.at(-1).item;
}

function sentenceSizes(total) {
  const sizesAvailable = Object.keys(templates).map(Number);
  const canCompose = (value) => {
    const reachable = Array(value + 1).fill(false);
    reachable[0] = true;
    for (let amount = 1; amount <= value; amount += 1) {
      reachable[amount] = sizesAvailable.some((size) => amount >= size && reachable[amount - size]);
    }
    return reachable[value];
  };
  const sizes = [];
  let remaining = total;
  while (remaining > 0) {
    const candidates = sizesAvailable.filter((size) => {
      const rest = remaining - size;
      return rest === 0 || (rest > 0 && canCompose(rest));
    });
    if (!candidates.length) throw new Error(`Cannot compose an adaptive passage with ${total} words.`);
    const size = candidates[Math.floor(Math.random() * candidates.length)];
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

export function generateAdaptivePassage({ wordCount = 75, maxWordLength = 12, profile }) {
  const current = normalizeProfile(profile);
  const focus = getFocusAreas(current, 14);
  const difficultWords = new Map(focus.filter((item) => item.type === 'word').map(
    (item) => [item.value, item.score * (0.35 + item.confidence * 0.65)],
  ));
  const difficultPatterns = focus.filter((item) => item.type === 'pattern');

  const selectWord = (category) => {
    const filtered = vocabulary[category].filter((word) => word.length <= maxWordLength);
    const pool = filtered.length ? filtered : vocabulary[category];
    if (Math.random() < 0.28 || !focus.length) return pool[Math.floor(Math.random() * pool.length)];
    return weightedPick(pool, (candidate) => {
      let score = 1;
      score += (difficultWords.get(candidate) || 0) * 10;
      for (const pattern of difficultPatterns) {
        if (candidate.includes(pattern.value)) {
          score += pattern.score * (0.35 + pattern.confidence * 0.65) * 5;
        }
      }
      return score;
    });
  };

  const sentences = sentenceSizes(Math.max(10, wordCount)).map((size) => {
    const words = templates[size](selectWord);
    const sentence = words.join(' ');
    return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
  });
  return sentences.join(' ');
}
