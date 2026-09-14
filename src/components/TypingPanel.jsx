import { useEffect, useRef, useState } from 'react';

export function TypingPanel({
  target, session, promptMode = false, prompt = '', onPromptChange, promptError = '',
}) {
  const inputRef = useRef(null);
  const passageRef = useRef(null);
  const cursorRef = useRef(null);
  const activeLineRef = useRef(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    activeLineRef.current = 0;
    const passage = passageRef.current;
    if (!passage) return undefined;
    passage.scrollTop = 0;
    const updateOverflow = () => setHasMore(passage.scrollHeight > passage.clientHeight + 1);
    const frame = window.requestAnimationFrame(updateOverflow);
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(passage);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [target, promptMode]);

  useEffect(() => {
    const passage = passageRef.current;
    const cursor = cursorRef.current;
    if (!passage || !cursor || session.isFinished) return undefined;
    const lineHeight = Number.parseFloat(window.getComputedStyle(passage).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return undefined;
    const activeLine = Math.round(cursor.offsetTop / lineHeight);
    if (activeLine >= 2 && activeLine !== activeLineRef.current) {
      passage.scrollTop = Math.max(0, (activeLine - 1) * lineHeight);
    }
    activeLineRef.current = activeLine;
    const frame = window.requestAnimationFrame(() => {
      setHasMore(passage.scrollTop + passage.clientHeight < passage.scrollHeight - 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session.input, session.isFinished]);

  return (
    <section className={`typing-card ${session.isFinished ? 'finished' : ''} ${promptMode ? 'prompt-mode' : ''} ${hasMore && !session.isFinished && !promptMode ? 'has-more' : ''}`}
      onClick={() => inputRef.current?.focus()} aria-label={promptMode ? 'Passage prompt' : 'Typing test'}>
      {promptMode ? (
        <>
          <textarea ref={inputRef} className="create-prompt-input" value={prompt}
            onChange={(event) => onPromptChange?.(event.target.value)} maxLength={600}
            placeholder="Describe the passage you want to practice…"
            aria-label="Describe the passage you want to generate" />
          {promptError && <p className="typing-prompt-error" role="alert">{promptError}</p>}
        </>
      ) : (
        <>
          <input ref={inputRef} className="typing-input" value={session.input}
            onChange={session.handleInput} onKeyDown={session.keepCaretAtEnd}
            onSelect={session.keepCaretAtEnd} autoCapitalize="off" autoCorrect="off"
            autoComplete="off" spellCheck="false" aria-label="Type the passage" />

          <div className="passage" ref={passageRef} aria-hidden="true">
            {target.split('').map((character, index) => {
              let state = 'untyped';
              if (index < session.input.length) {
                state = session.input[index] === character ? 'correct' : 'wrong';
              } else if (index === session.input.length && !session.isFinished) {
                state = 'cursor';
              }
              const visible = state === 'wrong' && character === ' ' ? '·' : character;
              return <span className={`character ${state}`} ref={state === 'cursor' ? cursorRef : null}
                key={index}>{visible}</span>;
            })}
          </div>
        </>
      )}

      {!promptMode && session.isFinished && (
        <div className="result-panel" role="status">
          <div><strong>{session.wpm}</strong><span>WPM</span></div>
          <div><strong>{session.accuracy}%</strong><span>Accuracy</span></div>
          <div><strong>{session.completedWords}</strong><span>Correct words</span></div>
          <button className="primary-button" onClick={(event) => {
            event.stopPropagation();
            session.reset();
          }}>Try this passage again</button>
        </div>
      )}
    </section>
  );
}
