const PROFILE_VERSION = 2;
const SLOW_KEY_MS = 650;
const HISTORY_LIMIT = 100;

export function createEmptyProfile() {
  return {
    version: PROFILE_VERSION, sessions: 0, words: {}, patterns: {}, history: [], updatedAt: null,
  };
}

export function normalizeProfile(value) {
  if (!value || typeof value !== 'object') return createEmptyProfile();
  return {
    version: PROFILE_VERSION,
    sessions: Number.isFinite(value.sessions) ? Math.max(0, value.sessions) : 0,
    words: value.words && typeof value.words === 'object' ? value.words : {},
    patterns: value.patterns && typeof value.patterns === 'object' ? value.patterns : {},
    history: Array.isArray(value.history) ? value.history.slice(-HISTORY_LIMIT) : [],
    updatedAt: value.updatedAt || null,
  };
}

export function confidenceForAttempts(attempts) {
  return Number((1 - Math.exp(-Math.max(0, attempts) / 6)).toFixed(4));
}

function observation(value, indices, target, input, timingMap) {
  let challenge = 0;
  for (const index of indices) {
    if (target[index]?.toLowerCase() !== input[index]?.toLowerCase()) challenge += 1;
    else if ((timingMap.get(index) || 0) > SLOW_KEY_MS) challenge += 0.45;
  }
  return { value, difficulty: Math.min(1, challenge / indices.length) };
}

export function createSessionObservations(target, input, keyTimings = [], summary = null) {
  const timingMap = new Map(keyTimings.map((timing) => [timing.index, timing.delay]));
  const words = [];
  const patterns = [];

  for (const match of target.matchAll(/[a-zA-Z]+/g)) {
    const value = match[0].toLowerCase();
    const start = match.index;
    if (start >= input.length) break;
    const wordIndices = Array.from({ length: value.length }, (_, offset) => start + offset);
    words.push(observation(value, wordIndices, target, input, timingMap));

    for (const size of [2, 3]) {
      for (let offset = 0; offset <= value.length - size; offset += 1) {
        const pattern = value.slice(offset, offset + size);
        const indices = Array.from({ length: size }, (_, patternOffset) => start + offset + patternOffset);
        patterns.push(observation(pattern, indices, target, input, timingMap));
      }
    }
  }

  return { words, patterns, summary };
}

function updateBucket(bucket, observations) {
  const next = { ...bucket };
  for (const item of observations) {
    const previous = next[item.value] || { attempts: 0, errors: 0, score: 0.25 };
    const attempts = previous.attempts + 1;
    const learningRate = Math.max(0.1, 0.34 / Math.sqrt(attempts));
    next[item.value] = {
      attempts,
      errors: previous.errors + (item.difficulty >= 0.35 ? 1 : 0),
      score: Number((previous.score * (1 - learningRate) + item.difficulty * learningRate).toFixed(4)),
      confidence: confidenceForAttempts(attempts),
    };
  }
  return next;
}

export function updateProfile(profile, observations) {
  const current = normalizeProfile(profile);
  const history = observations.summary
    ? [...current.history, { ...observations.summary, recordedAt: new Date().toISOString() }].slice(-HISTORY_LIMIT)
    : current.history;
  return {
    ...current,
    sessions: current.sessions + 1,
    words: updateBucket(current.words, observations.words || []),
    patterns: updateBucket(current.patterns, observations.patterns || []),
    history,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeProfiles(first, second) {
  const left = normalizeProfile(first);
  const right = normalizeProfile(second);
  const mergeBucket = (a, b) => {
    const merged = { ...a };
    for (const [key, value] of Object.entries(b)) {
      const existing = merged[key];
      if (!existing || value.attempts > existing.attempts) merged[key] = value;
    }
    return merged;
  };
  return {
    version: PROFILE_VERSION,
    sessions: Math.max(left.sessions, right.sessions),
    words: mergeBucket(left.words, right.words),
    patterns: mergeBucket(left.patterns, right.patterns),
    history: [...left.history, ...right.history]
      .sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)))
      .slice(-HISTORY_LIMIT),
    updatedAt: [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) || null,
  };
}

export function getFocusAreas(profile, limit = 6) {
  const current = normalizeProfile(profile);
  const ranked = [
    ...Object.entries(current.words).map(([value, stats]) => ({ type: 'word', value, ...stats })),
    ...Object.entries(current.patterns).map(([value, stats]) => ({ type: 'pattern', value, ...stats })),
  ].filter((item) => item.attempts >= 2 && item.score >= 0.18)
    .map((item) => ({
      ...item,
      confidence: confidenceForAttempts(item.attempts),
      priority: item.score * (0.35 + confidenceForAttempts(item.attempts) * 0.65),
    }))
    .sort((a, b) => (b.priority * Math.log2(b.attempts + 1)) - (a.priority * Math.log2(a.attempts + 1)));

  const result = [];
  const seen = new Set();
  for (const item of ranked) {
    if (seen.has(item.value)) continue;
    result.push(item);
    seen.add(item.value);
    if (result.length >= limit) break;
  }
  return result;
}

function average(items, field) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0) / items.length;
}

export function getProgressSummary(profile) {
  const current = normalizeProfile(profile);
  const history = current.history;
  const recent = history.slice(-10);
  const segmentSize = Math.min(5, Math.floor(history.length / 2));
  const first = segmentSize ? history.slice(0, segmentSize) : [];
  const latest = segmentSize ? history.slice(-segmentSize) : [];
  const confidenceItems = Object.values(current.patterns);
  const establishedPatterns = confidenceItems.filter(
    (item) => confidenceForAttempts(item.attempts) >= 0.75,
  ).length;

  return {
    sessions: current.sessions,
    averageWpm: Math.round(average(recent, 'wpm')),
    averageAccuracy: Math.round(average(recent, 'accuracy')),
    wpmImprovement: segmentSize >= 2 ? Math.round(average(latest, 'wpm') - average(first, 'wpm')) : null,
    accuracyImprovement: segmentSize >= 2
      ? Math.round(average(latest, 'accuracy') - average(first, 'accuracy'))
      : null,
    establishedPatterns,
    totalPatterns: confidenceItems.length,
  };
}
