import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAdaptivePassage } from '../src/learn/generator.js';
import {
  confidenceForAttempts,
  createEmptyProfile,
  createSessionObservations,
  getProgressSummary,
  updateProfile,
} from '../src/learn/profile.js';

test('adaptive passages contain the requested number of words', () => {
  for (let run = 0; run < 25; run += 1) {
    for (const wordCount of [10, 15, 40, 75, 100]) {
      const passage = generateAdaptivePassage({ wordCount, maxWordLength: 12, profile: createEmptyProfile() });
      assert.equal(passage.trim().split(/\s+/).length, wordCount);
    }
  }
});

test('observations capture difficult words and letter patterns', () => {
  const observations = createSessionObservations('The quiet bird.', 'The quirt bird.', []);
  assert.equal(observations.words.find((item) => item.value === 'quiet').difficulty > 0, true);
  assert.equal(observations.patterns.find((item) => item.value === 'ie').difficulty > 0, true);
});

test('an interrupted session does not penalize words that were never attempted', () => {
  const observations = createSessionObservations('The quiet bird waits.', 'The qu', []);
  assert.deepEqual(observations.words.map((item) => item.value), ['the', 'quiet']);
});

test('successful practice gradually lowers a difficulty score', () => {
  const missed = { words: [{ value: 'quiet', difficulty: 1 }], patterns: [] };
  const correct = { words: [{ value: 'quiet', difficulty: 0 }], patterns: [] };
  let profile = updateProfile(createEmptyProfile(), missed);
  const difficultScore = profile.words.quiet.score;
  profile = updateProfile(profile, correct);
  assert.ok(profile.words.quiet.score < difficultScore);
});

test('confidence rises with repeated evidence', () => {
  assert.ok(confidenceForAttempts(9) >= 0.75);
  assert.ok(confidenceForAttempts(2) < confidenceForAttempts(9));
});

test('progress compares early and recent session performance', () => {
  let profile = createEmptyProfile();
  for (const wpm of [30, 32, 42, 45]) {
    profile = updateProfile(profile, {
      words: [], patterns: [], summary: { wpm, accuracy: 96, durationSeconds: 60 },
    });
  }
  const summary = getProgressSummary(profile);
  assert.equal(summary.averageWpm, 37);
  assert.equal(summary.wpmImprovement, 13);
});
