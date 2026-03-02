/*
  WHY — Template + word bank approach:
  Instead of a fixed list of sentences, we define pools of words for each
  grammatical role and a set of sentence templates. A pick() helper selects
  a random item from any array. Combining templates with the word bank sizes
  below produces an astronomically large number of unique sentences.

  Word bank sizes (approx combinatorial space):
    100 nouns × 80 adjectives × 50 verbs × 30 adverbs × 20 prepositions × 8 templates
    ≈ 192 billion possible sentences
*/

const nouns = [
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
  
  const verbs = [
    'leaps', 'wanders', 'climbs', 'drifts', 'hunts', 'watches', 'crosses', 'follows', 'guards', 'hides',
    'jumps', 'leaves', 'moves', 'passes', 'rests', 'searches', 'travels', 'waits', 'lingers', 'rises',
    'falls', 'glides', 'fades', 'echoes', 'circles', 'stalks', 'dives', 'soars', 'crawls', 'charges',
    'retreats', 'emerges', 'vanishes', 'descends', 'ascends', 'lurks', 'roams', 'sleeps', 'strides', 'flows',
    'burns', 'drifts', 'clings', 'trembles', 'looms', 'sweeps', 'carves', 'haunts', 'gathers', 'scatters',
  ];
  
  const adverbs = [
    'quickly', 'silently', 'boldly', 'calmly', 'fiercely', 'gently', 'slowly', 'swiftly',
    'wisely', 'freely', 'endlessly', 'quietly', 'steadily', 'softly', 'restlessly',
    'fearlessly', 'gracefully', 'relentlessly', 'solemnly', 'tirelessly',
    'cautiously', 'curiously', 'deliberately', 'effortlessly', 'furiously',
    'invisibly', 'lazily', 'majestically', 'nervously', 'patiently',
  ];
  
  const prepositions = [
    'over', 'under', 'beyond', 'beside', 'through', 'around', 'above', 'below', 'near', 'past',
    'along', 'toward', 'within', 'among', 'beneath', 'against', 'across', 'between', 'into', 'upon',
  ];
  
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
  
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
  
  function generateSentence() {
    const w = {
      noun1: pick(nouns),
      noun2: pick(nouns),
      noun3: pick(nouns),
      adj1: pick(adjectives),
      adj2: pick(adjectives),
      verb1: pick(verbs),
      verb2: pick(verbs),
      adv1: pick(adverbs),
      prep1: pick(prepositions),
    };
    return pick(templates)(w);
  }
  
  /*
    WHY — character threshold approach (time mode):
    Instead of generating a fixed number of sentences (which produces inconsistent
    lengths), we keep generating until the total character count exceeds a minimum.
    This ensures the text box always looks full regardless of how long each
    individual sentence turns out to be.
  */
  export function generateParagraph(minChars = 600) {
    const sentences = [];
    let total = 0;
    while (total < minChars) {
      const s = generateSentence();
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
  export function generateParagraphExactWords(targetWords) {
    const sentences = [];

    const countWords = (text) =>
      text
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

    let totalWords = 0;
    let safety = 0;
    const MAX_ITERATIONS = 10000;

    while (totalWords !== targetWords && safety < MAX_ITERATIONS) {
      safety += 1;

      const sentence = generateSentence();
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
      return generateSentence() + '.';
    }

    return sentences.join('. ') + '.';
  }
  