/*
  WHY — Template + (expanded) word bank approach:
  Instead of a fixed list of sentences, we define pools of words for each
  grammatical role and a set of sentence templates. A pick() helper selects
  a random item from any array. We also support a "max word length" setting:
  the generator can filter these banks so only words up to N letters long
  are used.

  Rough combinatorics (conservative lower-bound):
    100 nouns × 80 adjectives × 50 verbs × 30 adverbs × 20 prepositions × 8 templates
    ≈ 192 billion distinct base sentences.

  The banks were roughly doubled so that even with a strict max-length cap
  there is still plenty of variety.
*/

const baseNouns = [
    // animals
    'cat', 'dog', 'bird', 'fox', 'wolf', 'bear', 'deer', 'hawk', 'frog', 'crow',
    'eagle', 'rabbit', 'snake', 'horse', 'whale', 'shark', 'raven', 'lynx', 'owl', 'crane',
    'tiger', 'panther', 'falcon', 'salmon', 'heron', 'beetle', 'sparrow', 'tortoise', 'viper', 'moth',
    // nature
    'river', 'mountain', 'forest', 'ocean', 'desert', 'valley', 'cliff', 'meadow', 'canyon', 'island',
    'glacier', 'volcano', 'cavern', 'swamp', 'tundra', 'lagoon', 'dune', 'ridge', 'marsh', 'delta',
    // people
    'wizard', 'knight', 'sailor', 'farmer', 'hunter', 'painter', 'dancer', 'scholar', 'merchant', 'pilgrim',
    'archer', 'scribe', 'ranger', 'hermit', 'weaver', 'blacksmith', 'herald', 'wanderer', 'poet', 'sentinel',
    // objects / abstract
    'storm', 'flame', 'shadow', 'stone', 'breeze', 'frost', 'thunder', 'spark', 'tide', 'dust',
    'lantern', 'compass', 'anchor', 'feather', 'crystal', 'torch', 'arrow', 'mirror', 'bridge', 'tower',
  ];
  
  const extraNouns = [
    'lion', 'otter', 'badger', 'cougar', 'ferret', 'heron', 'ibis', 'lemur', 'moose', 'newt',
    'pine', 'sequoia', 'rainfall', 'headland', 'harbor', 'waterfall', 'geyser', 'moor', 'plateau', 'grove',
    'scholarship', 'captain', 'carpenter', 'healer', 'bard', 'seer', 'warden', 'ruler', 'student', 'teacher',
    'ember', 'emberstorm', 'moonlight', 'sunrise', 'twilight', 'echo', 'whisper', 'beacon', 'signal', 'portal',
    // short nouns to support very small max word lengths
    'sun', 'sky', 'sea', 'map', 'cup', 'rod', 'log', 'ant', 'bee', 'oak',
  ];
  
  const adjectives = [
    // character
    'quick', 'silent', 'ancient', 'bold', 'clever', 'dark', 'elegant', 'fierce', 'gentle', 'hollow',
    'keen', 'mighty', 'noble', 'restless', 'swift', 'vivid', 'wild', 'broken', 'proud', 'weary',
    'cunning', 'fearless', 'humble', 'resolute', 'stubborn', 'graceful', 'wicked', 'serene', 'reckless', 'solemn',
    // physical
    'icy', 'jagged', 'luminous', 'pale', 'sharp', 'tall', 'calm', 'distant', 'empty', 'golden',
    'heavy', 'lost', 'narrow', 'open', 'rough', 'soft', 'tangled', 'vast', 'frozen', 'endless',
    'crimson', 'silver', 'sunken', 'towering', 'crumbling', 'weathered', 'gleaming', 'murky', 'barren', 'verdant',
    // mood / quality
    'forgotten', 'hidden', 'sacred', 'cursed', 'ancient', 'timeless', 'faded', 'radiant', 'hollow', 'iron',
  ];
  
  const extraAdjectives = [
    'shimmering', 'gloomy', 'radiant', 'stormy', 'windy', 'misty', 'spiraled', 'layered',
    'fragile', 'sturdy', 'glorious', 'ominous', 'rusted', 'polished', 'brilliant',
    'shadowy', 'glittering', 'feathered', 'stone-carved', 'moonlit',
    // short adjectives to support very small max word lengths
    'big', 'red', 'sad', 'hot', 'wet', 'dry', 'old', 'new',
  ];
  
  const verbs = [
    'leaps', 'wanders', 'climbs', 'drifts', 'hunts', 'watches', 'crosses', 'follows', 'guards', 'hides',
    'jumps', 'leaves', 'moves', 'passes', 'rests', 'searches', 'travels', 'waits', 'lingers', 'rises',
    'falls', 'glides', 'fades', 'echoes', 'circles', 'stalks', 'dives', 'soars', 'crawls', 'charges',
    'retreats', 'emerges', 'vanishes', 'descends', 'ascends', 'lurks', 'roams', 'sleeps', 'strides', 'flows',
    'burns', 'drifts', 'clings', 'trembles', 'looms', 'sweeps', 'carves', 'haunts', 'gathers', 'scatters',
  ];
  
  const extraVerbs = [
    'shimmers', 'rattles', 'pulses', 'sways', 'shifts', 'shivers', 'sparkles', 'clashes',
    'whispers', 'sings', 'glitters', 'burrows', 'wanders', 'spirals', 'surges',
    'rolls', 'flows onward', 'lingers on', 'leans', 'tilts',
    // short verbs to support very small max word lengths
    'run', 'sit', 'fly', 'dig', 'cut', 'mix',
  ];
  
  const adverbs = [
    'quickly', 'silently', 'boldly', 'calmly', 'fiercely', 'gently', 'slowly', 'swiftly',
    'wisely', 'freely', 'endlessly', 'quietly', 'steadily', 'softly', 'restlessly',
    'fearlessly', 'gracefully', 'relentlessly', 'solemnly', 'tirelessly',
    'cautiously', 'curiously', 'deliberately', 'effortlessly', 'furiously',
    'invisibly', 'lazily', 'majestically', 'nervously', 'patiently',
  ];
  
  const extraAdverbs = [
    'brightly', 'dimly', 'wildly', 'smoothly', 'noiselessly', 'boldly', 'warily',
    'patiently', 'suddenly', 'urgently', 'haltingly', 'warmly', 'coldly',
    // short adverbs to support very small max word lengths
    'low', 'far', 'deep',
  ];
  
  const prepositions = [
    'over', 'under', 'beyond', 'beside', 'through', 'around', 'above', 'below', 'near', 'past',
    'along', 'toward', 'within', 'among', 'beneath', 'against', 'across', 'between', 'into', 'upon',
  ];
  
  const extraPrepositions = [
    'outside', 'inside', 'nearby', 'ashore', 'upstream', 'downstream',
    'underneath', 'amid', 'opposite', 'alongside',
    // very short prepositions so a 3-letter cap still has options
    'by', 'in', 'on', 'at', 'to', 'up',
  ];

  const allNouns        = [...baseNouns, ...extraNouns];
  const allAdjectives   = [...adjectives, ...extraAdjectives];
  const allVerbs        = [...verbs, ...extraVerbs];
  const allAdverbs      = [...adverbs, ...extraAdverbs];
  const allPrepositions = [...prepositions, ...extraPrepositions];
  
  const templates = [
    (w) => `The ${w.adj1} ${w.noun1} ${w.verb1} ${w.prep1} the ${w.adj2} ${w.noun2}`,
    (w) => `${article(w.adj1, true)} ${w.adj1} ${w.noun1} ${w.adv1} ${w.verb1} ${w.prep1} the ${w.noun2}`,
    (w) => `The ${w.noun1} and the ${w.noun2} ${w.verb1} ${w.adv1} ${w.prep1} the ${w.adj1} ${w.noun3}`,
    (w) => `${article(w.adj1, true)} ${w.adj1} ${w.noun1} ${w.verb1} ${w.prep1} every ${w.adj2} ${w.noun2}`,
    (w) => `The ${w.adj1} ${w.noun1} ${w.verb1} ${w.adv1} while ${article(w.adj2)} ${w.adj2} ${w.noun2} ${w.verb2} ${w.prep1} the ${w.noun3}`,
    (w) => `The ${w.noun1} ${w.verb1} ${w.adv1} ${w.prep1} ${article(w.adj1)} ${w.adj1} ${w.noun2} and ${article(w.adj2)} ${w.adj2} ${w.noun3}`,
    (w) => `${article(w.adj1, true)} ${w.adj1} ${w.noun1} ${w.verb1} ${w.adv1} as the ${w.noun2} ${w.verb2} ${w.prep1} ${article(w.adj2)} ${w.adj2} ${w.noun3}`,
    (w) => `The ${w.adj1} ${w.noun1} ${w.verb1} ${w.prep1} the ${w.noun2} where ${article(w.adj2)} ${w.adj2} ${w.noun3} ${w.verb2} ${w.adv1}`,
  ];

  // Dedicated 10-word structure to improve reliability for very short passages.
  // Tokens (10):
  // 1 The  2 adj1  3 noun1  4 verb1  5 prep1  6 the  7 noun2  8 and  9 noun3  10 verb2
  function generateTenWordSentence(maxWordLength) {
    const nounsBank        = filterByLength(allNouns, maxWordLength);
    const adjectivesBank   = filterByLength(allAdjectives, maxWordLength);
    const verbsBank        = filterByLength(allVerbs, maxWordLength);
    const prepositionsBank = filterByLength(allPrepositions, maxWordLength);

    const w = {
      noun1: pick(nounsBank),
      noun2: pick(nounsBank),
      noun3: pick(nounsBank),
      adj1: pick(adjectivesBank),
      verb1: pick(verbsBank),
      verb2: pick(verbsBank),
      prep1: pick(prepositionsBank),
    };

    return `The ${w.adj1} ${w.noun1} ${w.verb1} ${w.prep1} the ${w.noun2} and ${w.noun3} ${w.verb2}`;
  }
  
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function filterByLength(arr, maxWordLength) {
    if (!maxWordLength) return arr;
    const filtered = arr.filter((word) => word.length <= maxWordLength);
    // Safety: if the filter removes everything (e.g. cap is too small),
    // fall back to the original array so generation never fails.
    return filtered.length > 0 ? filtered : arr;
  }
  
  /*
    WHY: /^[aeiou]/i is a regular expression that tests whether the first
    character of a word is a vowel (case-insensitive). If it is, we return
    "an"; otherwise "a". The capitalize flag handles sentence-starting articles.
  */
  function article(word, capitalize = false) {
    const base = /^[aeiou]/i.test(word) ? 'an' : 'a';
    return capitalize ? base[0].toUpperCase() + base.slice(1) : base;
  }
  
  function generateSentence(maxWordLength) {
    const nounsBank        = filterByLength(allNouns, maxWordLength);
    const adjectivesBank   = filterByLength(allAdjectives, maxWordLength);
    const verbsBank        = filterByLength(allVerbs, maxWordLength);
    const adverbsBank      = filterByLength(allAdverbs, maxWordLength);
    const prepositionsBank = filterByLength(allPrepositions, maxWordLength);

    const w = {
      noun1: pick(nounsBank),
      noun2: pick(nounsBank),
      noun3: pick(nounsBank),
      adj1: pick(adjectivesBank),
      adj2: pick(adjectivesBank),
      verb1: pick(verbsBank),
      verb2: pick(verbsBank),
      adv1: pick(adverbsBank),
      prep1: pick(prepositionsBank),
    };
    return pick(templates)(w);
  }
  
  /*
    WHY — character threshold approach (time mode):
    Instead of generating a fixed number of sentences (which produces inconsistent
    lengths), we keep generating until the total character count exceeds a minimum.
    This ensures the text box always looks full regardless of how long each
    individual sentence turns out to be. When a max word length is set, we still
    use this same character-based threshold; we just pull from filtered banks.
  */
  export function generateParagraph(minChars = 600, maxWordLength) {
    const sentences = [];
    let total = 0;
    while (total < minChars) {
      const s = generateSentence(maxWordLength);
      sentences.push(s);
      total += s.length + 2;
    }
    return sentences.join('. ') + '.';
  }

  /*
    WHY — exact word-count approach (words mode):
    For word-based tests we want the passage to contain *exactly* N words.
    We:
      - Keep adding whole sentences while we are under or exactly at the target.
      - If the *next* sentence would push us over the target, we roll back the
        last 3 sentences and try generating new ones.
    This random search with backtracking usually finds an exact fit quickly while
    still giving very natural sentence boundaries.
  */
  export function generateParagraphExactWords(targetWords, maxWordLength) {
    const sentences = [];

    const countWords = (text) =>
      text
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

    let totalWords = 0;
    let safety = 0;
    const MAX_ITERATIONS = 10000;

    // Special-case small passages: try to hit them with a single sentence.
    if (targetWords === 10) {
      // Use the dedicated 10-word template for better reliability.
      return generateTenWordSentence(maxWordLength) + '.';
    } else if (targetWords <= 15) {
      while (safety < MAX_ITERATIONS) {
        safety += 1;
        const s = generateSentence(maxWordLength);
        if (countWords(s) === targetWords) {
          return s + '.';
        }
      }
      // Fall through to the general multi-sentence search if we somehow didn't hit.
      safety = 0;
    }

    while (totalWords !== targetWords && safety < MAX_ITERATIONS) {
      safety += 1;

      const sentence = generateSentence(maxWordLength);
      const sentenceWords = countWords(sentence);

      // If adding this sentence would overshoot, roll back last 3 sentences
      // and try a different combination.
      if (totalWords + sentenceWords > targetWords) {
        for (let i = 0; i < 3 && sentences.length > 0; i++) {
          const removed = sentences.pop();
          totalWords -= countWords(removed);
        }
        continue;
      }

      sentences.push(sentence);
      totalWords += sentenceWords;
    }

    // Fallback: if we somehow couldn't hit the exact target, just join whatever we have.
    if (sentences.length === 0) {
      return generateSentence(maxWordLength) + '.';
    }

    return sentences.join('. ') + '.';
  }
  