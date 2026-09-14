import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const IDLE_LIMIT_MS = 5000;

function wordScore(target, input) {
  const targetWords = target.trim().split(/\s+/);
  const inputWords = input.trim().split(/\s+/);
  return targetWords.reduce((score, word, index) => score + (inputWords[index] === word ? 1 : 0), 0);
}

export function useTypingSession({ target, timeLimit, mode, onFinish }) {
  const [input, setInput] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishReason, setFinishReason] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const startedAtRef = useRef(null);
  const elapsedRef = useRef(0);
  const lastKeyAtRef = useRef(null);
  const keyTimingsRef = useRef([]);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const inputRef = useRef('');
  const targetRef = useRef(target);

  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { targetRef.current = target; }, [target]);

  const finish = useCallback((reason, finalInput = inputRef.current) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : elapsedRef.current;
    elapsedRef.current = elapsed;
    setElapsedMs(elapsed);
    setFinishReason(reason);
    onFinishRef.current?.({ target: targetRef.current, input: finalInput, elapsedMs: elapsed, keyTimings: keyTimingsRef.current });
  }, []);

  useEffect(() => {
    if (!hasStarted || finishReason) return undefined;
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - startedAtRef.current;
      elapsedRef.current = elapsed;
      setElapsedMs(elapsed);
      if (mode === 'time' && elapsed >= timeLimit * 1000) finish('time');
      else if (lastKeyAtRef.current && now - lastKeyAtRef.current >= IDLE_LIMIT_MS) finish('idle');
    }, 200);
    return () => window.clearInterval(interval);
  }, [finishReason, finish, hasStarted, mode, timeLimit]);

  const handleInput = useCallback((event) => {
    if (finishedRef.current) return;
    let next = event.target.value;
    if (next.length > target.length) next = next.slice(0, target.length);
    const now = Date.now();
    if (!startedAtRef.current && next.length) {
      startedAtRef.current = now;
      setHasStarted(true);
    }

    if (next.length > input.length) {
      for (let index = input.length; index < next.length; index += 1) {
        keyTimingsRef.current.push({
          index,
          delay: lastKeyAtRef.current ? now - lastKeyAtRef.current : 0,
          correct: next[index] === target[index],
        });
      }
      lastKeyAtRef.current = now;
    }

    inputRef.current = next;
    setInput(next);
    if (next.length >= target.length) finish('complete', next);
  }, [finish, input, target]);

  const reset = useCallback(() => {
    setInput('');
    inputRef.current = '';
    setElapsedMs(0);
    elapsedRef.current = 0;
    setFinishReason(null);
    setHasStarted(false);
    startedAtRef.current = null;
    lastKeyAtRef.current = null;
    keyTimingsRef.current = [];
    finishedRef.current = false;
  }, []);

  const correctCharacters = useMemo(() => input.split('').reduce(
    (total, character, index) => total + (character === target[index] ? 1 : 0), 0,
  ), [input, target]);
  const elapsedMinutes = Math.max(elapsedMs / 60000, 1 / 60000);
  const totalWords = target.trim().split(/\s+/).filter(Boolean).length;

  return {
    input,
    handleInput,
    reset,
    keepCaretAtEnd: (event) => {
      const element = event.currentTarget;
      window.requestAnimationFrame(() => element.setSelectionRange(element.value.length, element.value.length));
    },
    hasStarted,
    isFinished: Boolean(finishReason),
    finishReason,
    elapsedMs,
    remainingTime: Math.max(0, timeLimit - elapsedMs / 1000),
    wpm: hasStarted ? Math.round((correctCharacters / 5) / elapsedMinutes) : 0,
    accuracy: input.length ? Math.round((correctCharacters / input.length) * 100) : 100,
    completedWords: wordScore(target, input),
    totalWords,
  };
}
