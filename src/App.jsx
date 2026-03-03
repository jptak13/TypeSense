import { useState, useRef, useEffect } from 'react';
import './App.css';
import { generateParagraph, generateParagraphExactWords } from './utils/generateSentence';

/*
  WHY:
  - testMode ('words' | 'time') drives two fundamentally different stop conditions:
      words → done when the full passage is typed correctly
      time  → done when the countdown hits zero
  - In time mode the passage is generated extra-long so it never runs out before time.
  - The timer always counts up internally; time mode just displays (limit - elapsed).
  - All mutable values used inside the setInterval callback are read via refs to avoid
    stale-closure bugs.
*/

const LENGTH_CONFIG = {
  xs:     { chars: 100,  words: 15  },
  short:  { chars: 250,  words: 40  },
  medium: { chars: 450,  words: 75  },
  long:   { chars: 900,  words: 150 },
  xl:     { chars: 1500, words: 250 },
};

const TIME_OPTIONS = [
  { seconds: 5,   value: '5',  unit: 'seconds'  },
  { seconds: 15,  value: '15', unit: 'seconds'  },
  { seconds: 30,  value: '30', unit: 'seconds'  },
  { seconds: 60,  value: '1',  unit: 'minute'   },
  { seconds: 120, value: '2',  unit: 'minutes'  },
];

// Long enough for ~150 WPM over 2 minutes (≈1800 chars)
const TIME_MODE_CHARS = 2200;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function App() {
  const [userInput, setUserInput]           = useState("");
  const [targetSentence, setTargetSentence] = useState(
    // Default words-mode passage: exact word count with a moderate max word length.
    () => generateParagraphExactWords(LENGTH_CONFIG.medium.words, 12)
  );
  const [timeElapsed, setTimeElapsed]       = useState(0);
  const [hasStarted, setHasStarted]         = useState(false);
  const [testMode, setTestMode]             = useState('words');
  const [length, setLength]                 = useState('medium');
  const [timeLimit, setTimeLimit]           = useState(60);
  const [themeOverride, setThemeOverride]   = useState(null);
  const [showSettings, setShowSettings]     = useState(false);
  const [hasMoreBelow, setHasMoreBelow]     = useState(false);
  const [useBarControls, setUseBarControls] = useState(false);
  const [customWordCount, setCustomWordCount] = useState(100);
  const [maxWordLength, setMaxWordLength]   = useState(12);
  const [passageMode, setPassageMode]       = useState('default'); // 'default' | 'create'
  const [promptText, setPromptText]         = useState('');
  const [isGenerating, setIsGenerating]     = useState(false);
  const [hasGeneratedInCreateMode, setHasGeneratedInCreateMode] = useState(false);

  const inputRef        = useRef(null);
  const timerRef        = useRef(null);
  const settingsRef     = useRef(null);
  const lastTypeTimeRef = useRef(0);
  const scrollRef       = useRef(null);
  const cursorRef       = useRef(null);

  useEffect(() => { inputRef.current.focus(); }, []);

  useEffect(() => {
    if (themeOverride) {
      document.documentElement.setAttribute('data-theme', themeOverride);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [themeOverride]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Words mode: stop when passage is finished
  useEffect(() => {
    if (testMode === 'words' && userInput === targetSentence && hasStarted) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [userInput, targetSentence, hasStarted, testMode]);

  // Time mode: stop when countdown reaches zero
  useEffect(() => {
    if (testMode === 'time' && hasStarted && timeElapsed >= timeLimit) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [timeElapsed, testMode, hasStarted, timeLimit]);

  /*
    Scroll behavior — mimic Monkeytype-style "locked" active line:
    - Text flows naturally and wraps by the browser; we don't pre-split into lines.
    - We track the DOM position of the active character span (.char-cursor).
    - Once that cursor visually reaches the 3rd line, we programmatically scroll
      the inner container so the active line stays on the 2nd line.
  */
  useEffect(() => {
    const container = scrollRef.current;
    const cursor    = cursorRef.current;

    if (!container) return;

    const updateHasMoreBelow = () => {
      // Avoid bottom-fade flicker when a new passage is loaded and typing
      // hasn't started yet — in that case, always show a solid block.
      if (!hasStarted && userInput.length === 0) {
        setHasMoreBelow(false);
        return;
      }

      const remaining =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      setHasMoreBelow(remaining > 1);
    };

    // When there's no active cursor (e.g., test finished), just update fade state
    if (!cursor) {
      updateHasMoreBelow();
      return;
    }

    const style       = window.getComputedStyle(container);
    const lineHeight  = parseFloat(style.lineHeight);
    if (!lineHeight || Number.isNaN(lineHeight)) return;

    const containerRect = container.getBoundingClientRect();
    const cursorRect    = cursor.getBoundingClientRect();

    // Cursor position in content coordinates (accounting for existing scroll)
    const offsetTop = (cursorRect.top - containerRect.top) + container.scrollTop;

    const secondLineTop = lineHeight * 1; // lock target (visual second line)
    // Start scrolling as soon as the cursor moves into the 3rd visual line,
    // so we trigger a bit before a full extra line has accumulated.
    const thirdLineTop  = lineHeight * 1.5;

    if (offsetTop >= thirdLineTop) {
      const desiredScrollTop = offsetTop - secondLineTop;
      container.scrollTop = desiredScrollTop;
    }

    updateHasMoreBelow();
  }, [userInput, targetSentence, testMode, timeLimit, hasStarted]);

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      if (Date.now() - lastTypeTimeRef.current > 5000) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
  };

  const applyNewPassage = (text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeElapsed(0);
    setHasStarted(false);
    setUserInput("");
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    setHasMoreBelow(false);
    setTargetSentence(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const resetPassage = ({ minChars, exactWords, maxLetters }) => {
    const effectiveMax = typeof maxLetters === 'number' ? maxLetters : maxWordLength;
    const text =
      typeof exactWords === 'number'
        ? generateParagraphExactWords(exactWords, effectiveMax)
        : generateParagraph(minChars, effectiveMax);
    applyNewPassage(text);
  };

  const handleTyping = (event) => {
    // In Generation Mode = Create (before the first generation), we reuse the
    // main textbox as the prompt input with no passage-length restriction.
    if (passageMode === 'create' && !hasGeneratedInCreateMode) {
      setPromptText(event.target.value);
      return;
    }

    // Block input when time mode is finished
    if (testMode === 'time' && hasStarted && timeElapsed >= timeLimit) return;

    const value = event.target.value;
    if (value.length <= targetSentence.length) {
      lastTypeTimeRef.current = Date.now();
      if (value.length > 0) {
        if (!hasStarted) setHasStarted(true);
        startTimer();
      }
      setUserInput(value);
    }
  };

  const handleModeChange = (newMode) => {
    if (newMode === testMode) return; // already on this mode; don't change passage
    setTestMode(newMode);
    // Changing between words/time should reset the create-mode generation cycle.
    setHasGeneratedInCreateMode(false);

    if (newMode === 'time') {
      if (passageMode === 'default') {
        resetPassage({ minChars: TIME_MODE_CHARS });
      }
    } else {
      if (passageMode === 'default') {
        if (useBarControls) {
          resetPassage({ exactWords: customWordCount });
        } else {
          resetPassage({ exactWords: LENGTH_CONFIG[length].words });
        }
      }
    }
  };

  const handleLengthChange = (newLength) => {
    if (newLength === length) return; // already on this preset; don't regenerate
    setLength(newLength);
    // Switching length resets the create-mode cycle.
    setHasGeneratedInCreateMode(false);

    // Length only applies in words mode; regenerate to hit exact word count.
    if (passageMode === 'default') {
      resetPassage({ exactWords: LENGTH_CONFIG[newLength].words });
    }
  };

  const handleTimeLimitChange = (newLimit) => {
    if (newLimit === timeLimit) return; // already on this duration; don't regenerate
    setTimeLimit(newLimit);
    // Switching duration resets the create-mode cycle.
    setHasGeneratedInCreateMode(false);

    if (passageMode === 'default') {
      resetPassage({ minChars: TIME_MODE_CHARS });
    }
  };

  const handleNewPassage = () => {
    if (testMode === 'time') {
      resetPassage({ minChars: TIME_MODE_CHARS });
    } else {
      resetPassage({
        exactWords: useBarControls
          ? customWordCount
          : LENGTH_CONFIG[length].words,
      });
    }
  };

  const generateFromPrompt = async () => {
    if (passageMode !== 'create') return;
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) return;

    const desiredWords =
      testMode === 'words'
        ? (useBarControls ? customWordCount : LENGTH_CONFIG[length].words)
        : LENGTH_CONFIG[length].words;

    try {
      setIsGenerating(true);
      const response = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          wordCount: desiredWords,
        }),
      });

      if (!response.ok) {
        console.error('Failed to generate passage', await response.text());
        return;
      }

      const data = await response.json();
      if (data && typeof data.text === 'string') {
        applyNewPassage(data.text);
      }
    } catch (err) {
      console.error('Error calling /api/generate:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateButtonClick = async () => {
    if (passageMode !== 'create') return;
    await generateFromPrompt();
    // After the *first* successful generation in create mode,
    // the button should flip to "New Passage" behavior.
    if (!hasGeneratedInCreateMode) {
      setHasGeneratedInCreateMode(true);
    }
  };

  const updateWordCount = (delta) => {
    setCustomWordCount((prev) => {
      const next = Math.min(500, Math.max(10, prev + delta));
      // If we're already at the min/max, ignore the click entirely so the
      // passage (and displayed number) do not change.
      if (next === prev) return prev;

      if (passageMode === 'default' && testMode === 'words' && useBarControls) {
        resetPassage({ exactWords: next });
      }
      return next;
    });
  };

  const updateTimeLimit = (delta) => {
    setTimeLimit((prev) => {
      const next = Math.min(600, Math.max(5, prev + delta));
      // If we're already at the min/max, ignore the click entirely so the
      // passage and timer stay as-is.
      if (next === prev) return prev;

      if (passageMode === 'default' && testMode === 'time') {
        // Regenerate a long passage for the new duration.
        resetPassage({ minChars: TIME_MODE_CHARS });
      }
      return next;
    });
  };

  const adjustMaxWordLength = (delta) => {
    setMaxWordLength((prev) => {
      // Max word length is clamped between 3 and 15 letters.
      const next = Math.min(15, Math.max(3, prev + delta));
      if (next === prev) return prev; // at min or max; don't regenerate
      // Regenerate the current passage using the new cap so the effect is immediate.
      if (passageMode === 'default' && testMode === 'words') {
        resetPassage({
          exactWords: useBarControls
            ? customWordCount
            : LENGTH_CONFIG[length].words,
          maxLetters: next,
        });
      } else if (passageMode === 'default') {
        resetPassage({ minChars: TIME_MODE_CHARS, maxLetters: next });
      }
      return next;
    });
  };

  const toggleTheme = () => {
    setThemeOverride((prev) => {
      if (prev) return prev === 'dark' ? 'light' : 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    });
  };

  const isDark = themeOverride === 'dark' ||
    (!themeOverride && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isTimeDone = testMode === 'time' && hasStarted && timeElapsed >= timeLimit;
  const isWordsDone = testMode === 'words' && userInput === targetSentence;

  // Words mode counts up; time mode counts down
  const displayTime = testMode === 'time'
    ? formatTime(Math.max(0, timeLimit - timeElapsed))
    : formatTime(timeElapsed);

  // Words progress (words mode): how many completed words vs total in passage.
  const totalWords = targetSentence.trim().split(/\s+/).filter(Boolean).length;
  // Only count a word as "completed" when it was typed correctly (userInput matches
  // targetSentence up to and including the space after that word). This prevents
  // WPM from going up when you just hit space without typing the word correctly.
  const completedWords = (() => {
    if (!userInput) return 0;
    let count = 0;
    for (let i = 0; i < targetSentence.length && i < userInput.length; i++) {
      if (userInput[i] !== targetSentence[i]) break;
      if (targetSentence[i] === ' ') count++;
    }
    return Math.min(count, totalWords);
  })();

  // For WPM we only count "committed" characters up to the last correctly completed word.
  const lastCorrectSpaceIndex = (() => {
    let last = -1;
    for (let i = 0; i < targetSentence.length && i < userInput.length; i++) {
      if (userInput[i] !== targetSentence[i]) break;
      if (targetSentence[i] === ' ') last = i;
    }
    return last;
  })();
  const committedChars = lastCorrectSpaceIndex >= 0 ? lastCorrectSpaceIndex + 1 : 0;

  /*
    WHY — WPM update cadence:
    - We only allow WPM to jump *up* when a full word is completed *correctly*
      (space typed and everything before it matches the passage).
    - Between word completions, WPM can drift downward as time elapses.
    - "Committed" characters = only up to the last correctly completed word.
  */
  const [wpm, setWpm] = useState(0);
  const prevCompletedWordsRef = useRef(0);

  useEffect(() => {
    if (timeElapsed === 0) {
      setWpm(0);
      prevCompletedWordsRef.current = completedWords;
      return;
    }

    if (committedChars === 0) {
      // No complete words yet: let WPM decay toward 0 as time passes.
      const raw = 0;
      setWpm((prev) => Math.min(prev, raw));
      prevCompletedWordsRef.current = completedWords;
      return;
    }

    const minutes = timeElapsed / 60;
    const raw = minutes > 0
      ? Math.round((committedChars / 5) / minutes)
      : 0;

    const prevCompleted = prevCompletedWordsRef.current;

    setWpm((prev) => {
      let next = prev;
      if (completedWords > prevCompleted) {
        // New word finished correctly: allow WPM to jump up to the latest value.
        next = raw;
        prevCompletedWordsRef.current = completedWords;
      } else {
        // No new correct word: WPM may only stay the same or decrease.
        next = Math.min(prev, raw);
      }
      if (!Number.isFinite(next) || next < 0) return 0;
      return next;
    });
  }, [timeElapsed, userInput, completedWords, committedChars]);

  return (
    <div className="app-container">
      <header className="app-header">
        <svg className="app-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="5" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
          <rect x="4" y="8.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="8" y="8.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="12" y="8.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="16" y="8.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="4" y="12.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="8" y="12.5" width="8" height="2" rx="0.4" fill="currentColor"/>
          <rect x="18" y="12.5" width="2" height="2" rx="0.4" fill="currentColor"/>
        </svg>
        <h1 className="app-title">TypeSense</h1>

        <div className="settings-container" ref={settingsRef}>
          <button className="settings-btn" onClick={() => setShowSettings((s) => !s)} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.8"/>
            </svg>
          </button>
          {showSettings && (
            <div className="settings-panel">
              <p className="settings-label">Appearance</p>
              <button className="settings-item" onClick={toggleTheme}>
                <span className="settings-item-icon">
                  {isDark ? '☀' : '☾'}
                </span>
                <span className="settings-item-text">
                  {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </span>
              </button>

              <p className="settings-label">Generation Mode</p>
              <button className="settings-item" type="button">
                <span className="settings-item-text">Mode</span>
                <div className="length-toggle">
                  <button
                    type="button"
                    className={`length-toggle-btn${passageMode === 'default' ? ' active' : ''}`}
                    onClick={() => {
                      setPassageMode('default');
                      setHasGeneratedInCreateMode(false);
                    }}
                  >
                    Default
                  </button>
                  <button
                    type="button"
                    className={`length-toggle-btn${passageMode === 'create' ? ' active' : ''}`}
                    onClick={() => {
                      setPassageMode('create');
                      setHasGeneratedInCreateMode(false);
                      // Seed the prompt with whatever the user last typed,
                      // so switching back and forth doesn't lose intent.
                      if (!promptText && userInput) {
                        setPromptText(userInput);
                      }
                    }}
                  >
                    Create
                  </button>
                </div>
              </button>

              <p className="settings-label">Length settings</p>
              <button className="settings-item" type="button">
                <span className="settings-item-text">Passage length</span>
                <div className="length-toggle">
                  <button
                    type="button"
                    className={`length-toggle-btn${!useBarControls ? ' active' : ''}`}
                    onClick={() => {
                      if (useBarControls) {
                        // Switching from custom back to presets.
                        if (testMode === 'words') {
                          resetPassage({ exactWords: LENGTH_CONFIG[length].words });
                        }
                        setUseBarControls(false);
                      }
                    }}
                  >
                    Preset
                  </button>
                  <button
                    type="button"
                    className={`length-toggle-btn${useBarControls ? ' active' : ''}`}
                    onClick={() => {
                      if (!useBarControls) {
                        // Switching from presets to custom bar controls.
                        if (testMode === 'words') {
                          resetPassage({ exactWords: customWordCount });
                        }
                        setUseBarControls(true);
                      }
                    }}
                  >
                    Custom
                  </button>
                </div>
              </button>

              <button className="settings-item">
                <span>Max word length (letters)</span>
                <span className="settings-max-word-length">
                  <button
                    type="button"
                    className="length-bar-btn"
                    onClick={() => adjustMaxWordLength(-1)}
                  >
                    −
                  </button>
                  <span className="length-bar-value small">
                    {maxWordLength} letters
                  </span>
                  <button
                    type="button"
                    className="length-bar-btn"
                    onClick={() => adjustMaxWordLength(1)}
                  >
                    +
                  </button>
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="toolbar">
        {/* Timer + WPM stats */}
        <div className="timer-group">
          {testMode === 'words' ? (
            <div className="timer-stat">
              <span className="timer-value">
                {completedWords} / {totalWords}
              </span>
              <span className="timer-label">WORDS</span>
            </div>
          ) : (
            <div className="timer-stat">
              <span className="timer-value">{displayTime}</span>
              <span className="timer-label">LEFT</span>
            </div>
          )}
          <div className="timer-divider" />
          <div className="timer-stat">
            <span className="timer-value">{wpm}</span>
            <span className="timer-label">WPM</span>
          </div>
        </div>

        {/* Mode + sub-options */}
        <div className="test-options-group">
          <div className="test-options">
            <div className="option-block">
              <div className="length-selector mode-selector">
                <button
                  className={`length-btn${testMode === 'words' ? ' active' : ''}`}
                  onClick={() => handleModeChange('words')}
                >
                  <span className="length-label">Words</span>
                </button>
                <button
                  className={`length-btn${testMode === 'time' ? ' active' : ''}`}
                  onClick={() => handleModeChange('time')}
                >
                  <span className="length-label">Time</span>
                </button>
              </div>
              <span className="option-label">MODE</span>
            </div>

            <div className="option-block">
              {testMode === 'words' ? (
                <>
                  {useBarControls ? (
                    <div className="length-bar">
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateWordCount(-50)}
                      >
                        −50
                      </button>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateWordCount(-10)}
                      >
                        −10
                      </button>
                      <span className="length-bar-value">
                        {customWordCount} words
                      </span>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateWordCount(10)}
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateWordCount(50)}
                      >
                        +50
                      </button>
                    </div>
                  ) : (
                    <div className="length-selector length-selector-words">
                      {Object.entries(LENGTH_CONFIG).map(([key, val]) => {
                        const label =
                          key === 'xs'
                            ? 'XS'
                            : key === 'xl'
                              ? 'XL'
                              : key.charAt(0).toUpperCase() + key.slice(1);
                        const wordsShown = val.words;
                        return (
                          <button
                            key={key}
                            className={`length-btn${length === key ? ' active' : ''}`}
                            onClick={() => handleLengthChange(key)}
                          >
                            <span className="length-label">
                              {label}
                            </span>
                            <span className="length-words">{wordsShown} words</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <span className="option-label option-label-length">LENGTH</span>
                </>
              ) : (
                <>
                  {useBarControls ? (
                    <div className="length-bar length-bar-duration">
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateTimeLimit(-30)}
                      >
                        −30s
                      </button>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateTimeLimit(-5)}
                      >
                        −5s
                      </button>
                      <span className="length-bar-value">
                        {formatTime(timeLimit)}
                      </span>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateTimeLimit(5)}
                      >
                        +5s
                      </button>
                      <button
                        type="button"
                        className="length-bar-btn"
                        onClick={() => updateTimeLimit(30)}
                      >
                        +30s
                      </button>
                    </div>
                  ) : (
                    <div className="length-selector">
                      {TIME_OPTIONS.map(({ seconds, value, unit }) => (
                        <button
                          key={seconds}
                          className={`length-btn${timeLimit === seconds ? ' active' : ''}`}
                          onClick={() => handleTimeLimitChange(seconds)}
                        >
                          <span className="length-label duration-label">
                            <span className="duration-number">{value}</span>{' '}
                            <span className="duration-unit">{unit}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="option-label option-label-duration">DURATION</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar-actions">
          {passageMode === 'create' && (
            <button
              className="new-passage-btn"
              onClick={hasGeneratedInCreateMode ? generateFromPrompt : handleGenerateButtonClick}
              disabled={isGenerating}
            >
              {isGenerating
                ? 'Generating...'
                : hasGeneratedInCreateMode
                  ? 'New Passage ↺'
                  : 'Generate'}
            </button>
          )}
          {passageMode === 'default' && (
            <button className="new-passage-btn" onClick={handleNewPassage}>
              New Passage ↺
            </button>
          )}
        </div>
      </div>
      <div className="typing-area-wrapper">
        {passageMode === 'create' && !hasGeneratedInCreateMode ? (
          <div className="typing-display prompt-mode">
            <textarea
              className="prompt-input"
              rows={2}
              placeholder="Type your prompt here, e.g. 'a story about a snail on Mars'."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </div>
        ) : (
          <div
            className={
              `typing-display${isTimeDone ? ' test-done' : ''}${
                hasMoreBelow ? ' show-bottom-fade' : ''
              }`
            }
            onClick={() => inputRef.current.focus()}
          >
            <input
              ref={inputRef}
              className="hidden-input"
              value={userInput}
              onChange={handleTyping}
            />
            <div className="typing-scroll" ref={scrollRef}>
              {targetSentence.split('').map((char, index) => {
                let className = 'char-untyped';
                if (index < userInput.length) {
                  className = userInput[index] === char ? 'char-correct' : 'char-wrong';
                } else if (index === userInput.length && !isTimeDone) {
                  className = 'char-cursor';
                }

                const isCursor = className === 'char-cursor';

                return (
                  <span
                    key={index}
                    className={className}
                    ref={isCursor ? cursorRef : null}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isWordsDone && <p className="success-message">Passage complete!</p>}
      {isTimeDone  && <p className="success-message">Time's up! — {wpm} WPM</p>}
    </div>
  );
}

export default App;
