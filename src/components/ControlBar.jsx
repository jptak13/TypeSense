import { SegmentedControl } from './SegmentedControl';

function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function ControlBar({
  mode, onModeChange, length, lengths, onLengthChange, timeLimit, timeOptions,
  onTimeLimitChange, useCustomLength, customLength, onCustomLengthChange,
  session, onNewPassage, isGenerating, actionLabel = 'New passage',
}) {
  const modeOptions = [
    { value: 'words', label: 'Words' },
    { value: 'time', label: 'Time' },
  ];
  const lengthOptions = Object.entries(lengths).map(([value, words]) => ({
    value,
    label: value === 'xs' || value === 'xl' ? value.toUpperCase() : value[0].toUpperCase() + value.slice(1),
    detail: `${words} words`,
  }));
  const timeChoices = timeOptions.map((seconds) => ({
    value: seconds,
    label: seconds < 60 ? `${seconds}s` : `${seconds / 60}m`,
  }));

  return (
    <section className="control-deck" aria-label="Test controls">
      <div className="stats-row">
        <div className="stat">
          <strong>{mode === 'time' ? formatTime(session.remainingTime) : `${session.completedWords}/${session.totalWords}`}</strong>
          <span>{mode === 'time' ? 'time left' : 'words'}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat"><strong>{session.wpm}</strong><span>wpm</span></div>
      </div>

      <SegmentedControl label="Mode" options={modeOptions} value={mode}
        onChange={onModeChange} className="mode-control" />

      {mode === 'time' ? (
        <SegmentedControl label="Duration" options={timeChoices} value={timeLimit}
          onChange={onTimeLimitChange} className="length-control" />
      ) : useCustomLength ? (
        <div className="control-group length-control">
          <span className="control-label">Length</span>
          <div className="stepper">
            <button onClick={() => onCustomLengthChange(-10)} aria-label="Remove ten words">−10</button>
            <strong>{customLength} words</strong>
            <button onClick={() => onCustomLengthChange(10)} aria-label="Add ten words">+10</button>
          </div>
        </div>
      ) : (
        <SegmentedControl label="Length" options={lengthOptions} value={length}
          onChange={onLengthChange} className="length-control" />
      )}

      <button className="new-passage-button" onClick={onNewPassage} disabled={isGenerating}>
        <span>{isGenerating ? 'Generating…' : actionLabel}</span>
        {actionLabel !== 'Generate' && <span aria-hidden="true">↻</span>}
      </button>
    </section>
  );
}
