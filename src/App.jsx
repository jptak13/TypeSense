import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { ControlBar } from './components/ControlBar';
import { SettingsPanel } from './components/SettingsPanel';
import { TypingPanel } from './components/TypingPanel';
import { useAuth } from './hooks/useAuth';
import { useLearningProfile } from './hooks/useLearningProfile';
import { useTypingSession } from './hooks/useTypingSession';
import { generateAdaptivePassage } from './learn/generator';
import { createSessionObservations } from './learn/profile';
import { generateParagraph, generateParagraphExactWords } from './utils/generateSentence';
import './styles/app.css';

const LENGTHS = { xs: 15, short: 40, medium: 75, long: 150, xl: 250 };
const TIME_OPTIONS = [15, 30, 60, 120];

function passageFor({ mode, passageSource, length, customLength, useCustomLength, timeLimit, maxWordLength, profile }) {
  const words = mode === 'time'
    ? Math.max(150, Math.ceil(timeLimit * 2.8))
    : (useCustomLength ? customLength : LENGTHS[length]);
  if (passageSource === 'learn') {
    return generateAdaptivePassage({ wordCount: words, maxWordLength, profile });
  }
  if (mode === 'time') return generateParagraph(Math.max(2200, timeLimit * 24), maxWordLength);
  return generateParagraphExactWords(words, maxWordLength);
}

function summarizeSession(result, mode, passageSource) {
  const correctCharacters = result.input.split('').reduce(
    (total, character, index) => total + (character === result.target[index] ? 1 : 0), 0,
  );
  const elapsedMinutes = Math.max(result.elapsedMs / 60_000, 1 / 60_000);
  return {
    wpm: Math.round((correctCharacters / 5) / elapsedMinutes),
    accuracy: result.input.length ? Math.round((correctCharacters / result.input.length) * 100) : 100,
    durationSeconds: Math.round(result.elapsedMs / 1000),
    mode,
    source: passageSource,
  };
}

export default function App() {
  const auth = useAuth();
  const learning = useLearningProfile(auth.currentUser, auth.token);
  const [mode, setMode] = useState('words');
  const [length, setLength] = useState('medium');
  const [timeLimit, setTimeLimit] = useState(60);
  const [customLength, setCustomLength] = useState(100);
  const [useCustomLength, setUseCustomLength] = useState(false);
  const [maxWordLength, setMaxWordLength] = useState(12);
  const [passageSource, setPassageSource] = useState('default');
  const [prompt, setPrompt] = useState('');
  const [hasGeneratedCreate, setHasGeneratedCreate] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dismissedBaseline, setDismissedBaseline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('typesense_theme') || 'system');

  const passageOptions = useMemo(() => ({
    mode, passageSource, length, customLength, useCustomLength, timeLimit, maxWordLength,
    profile: learning.profile,
  }), [mode, passageSource, length, customLength, useCustomLength, timeLimit, maxWordLength, learning.profile]);

  const [target, setTarget] = useState(() => passageFor({
    mode: 'words', passageSource: 'default', length: 'medium', customLength: 100, useCustomLength: false,
    timeLimit: 60, maxWordLength: 12, profile: learning.profile,
  }));

  const handleFinish = useCallback((result) => {
    if (!auth.currentUser) return;
    learning.recordSession(createSessionObservations(
      result.target,
      result.input,
      result.keyTimings,
      summarizeSession(result, mode, passageSource),
    ));
  }, [auth.currentUser, learning, mode, passageSource]);

  const session = useTypingSession({ target, timeLimit, mode, onFinish: handleFinish });

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('typesense_theme', theme);
  }, [theme]);

  const loadPassage = useCallback((nextTarget) => {
    setTarget(nextTarget);
    setGenerationError('');
    session.reset();
  }, [session]);

  const buildLocalPassage = useCallback((overrides = {}) => {
    loadPassage(passageFor({ ...passageOptions, ...overrides }));
  }, [loadPassage, passageOptions]);

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (passageSource === 'create') {
      setHasGeneratedCreate(false);
      session.reset();
    }
    else buildLocalPassage({ mode: nextMode });
  };

  const changePassageSource = (nextSource) => {
    if (nextSource === passageSource) return;
    if (nextSource === 'learn' && !auth.currentUser) return;
    setPassageSource(nextSource);
    setHasGeneratedCreate(false);
    if (nextSource === 'create') {
      setGenerationError('');
      session.reset();
    } else if (nextSource === 'learn' && learning.profile.sessions === 0) {
      setMode('time');
      setTimeLimit(60);
      setUseCustomLength(false);
      buildLocalPassage({
        mode: 'time', passageSource: 'learn', timeLimit: 60, useCustomLength: false,
      });
    } else {
      buildLocalPassage({ passageSource: nextSource });
    }
  };

  const changeLength = (nextLength) => {
    if (nextLength === length) return;
    setLength(nextLength);
    buildLocalPassage({ length: nextLength });
  };

  const changeTimeLimit = (seconds) => {
    if (seconds === timeLimit) return;
    setTimeLimit(seconds);
    buildLocalPassage({ timeLimit: seconds });
  };

  const changeCustomLength = (delta) => {
    const next = Math.min(500, Math.max(10, customLength + delta));
    if (next === customLength) return;
    setCustomLength(next);
    buildLocalPassage({ customLength: next });
  };

  const changeMaxWordLength = (delta) => {
    const next = Math.min(15, Math.max(3, maxWordLength + delta));
    if (next === maxWordLength) return;
    setMaxWordLength(next);
    if (passageSource !== 'create') buildLocalPassage({ maxWordLength: next });
  };

  const toggleCustomLength = (enabled) => {
    if (enabled === useCustomLength) return;
    setUseCustomLength(enabled);
    buildLocalPassage({ useCustomLength: enabled });
  };

  const generateFromPrompt = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setGenerationError('Add a short topic or style prompt first.');
      return;
    }

    const wordCount = mode === 'time'
      ? Math.max(150, Math.ceil(timeLimit * 2.8))
      : (useCustomLength ? customLength : LENGTHS[length]);

    setIsGenerating(true);
    setGenerationError('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleanPrompt, wordCount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.text) throw new Error(data?.error || 'Passage generation failed.');
      loadPassage(data.text);
      setHasGeneratedCreate(true);
    } catch (error) {
      setGenerationError(error.message || 'Passage generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const newPassage = () => {
    if (passageSource === 'create') generateFromPrompt();
    else buildLocalPassage();
  };

  const startBaseline = () => {
    setDismissedBaseline(true);
    setMode('time');
    setTimeLimit(60);
    setUseCustomLength(false);
    setPassageSource('learn');
    setHasGeneratedCreate(false);
    buildLocalPassage({
      mode: 'time', passageSource: 'learn', timeLimit: 60, useCustomLength: false,
    });
  };

  const actionLabel = passageSource === 'create'
    ? 'Generate'
    : passageSource === 'learn'
      ? (learning.profile.sessions === 0 ? 'Start test' : 'Generate')
      : (session.isFinished ? 'Next passage' : 'New passage');
  const showBaselinePrompt = Boolean(
    auth.currentUser && !learning.isSyncing && learning.profile.sessions === 0
    && !dismissedBaseline && passageSource !== 'learn',
  );
  const createPromptMode = passageSource === 'create' && !hasGeneratedCreate;

  return (
    <div className="app-shell">
      <AppHeader onOpenSettings={() => setShowSettings(true)} />
      <main className="app-main">
        <ControlBar
          mode={mode} onModeChange={changeMode} length={length} lengths={LENGTHS}
          onLengthChange={changeLength} timeLimit={timeLimit} timeOptions={TIME_OPTIONS}
          onTimeLimitChange={changeTimeLimit} useCustomLength={useCustomLength}
          customLength={customLength} onCustomLengthChange={changeCustomLength}
          session={session} onNewPassage={newPassage} isGenerating={isGenerating}
          actionLabel={actionLabel}
        />

        {showBaselinePrompt && (
          <section className="baseline-prompt" aria-label="Set up adaptive practice">
            <div>
              <strong>Set up Learn</strong>
              <span>Take a one-minute baseline test to start your typing profile.</span>
            </div>
            <div className="baseline-actions">
              <button className="text-button" onClick={() => setDismissedBaseline(true)}>Later</button>
              <button className="primary-button" onClick={startBaseline}>Start one-minute test</button>
            </div>
          </section>
        )}

        <TypingPanel target={target} session={session} promptMode={createPromptMode}
          prompt={prompt} onPromptChange={setPrompt} promptError={generationError} />
      </main>

      <SettingsPanel
        isOpen={showSettings} onClose={() => setShowSettings(false)} auth={auth}
        theme={theme} onThemeChange={setTheme} passageSource={passageSource}
        onPassageSourceChange={changePassageSource} mode={mode}
        useCustomLength={useCustomLength} onUseCustomLengthChange={toggleCustomLength}
        maxWordLength={maxWordLength} onMaxWordLengthChange={changeMaxWordLength}
        learning={learning}
      />
    </div>
  );
}
