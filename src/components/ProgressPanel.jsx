import { getFocusAreas, getProgressSummary } from '../learn/profile';

function signedChange(value, suffix = '') {
  if (value === null) return 'Building baseline';
  if (value === 0) return `No change${suffix}`;
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

export function ProgressPanel({ learning }) {
  const summary = getProgressSummary(learning.profile);
  const focusAreas = getFocusAreas(learning.profile, 8);

  if (!summary.sessions) {
    return (
      <div className="progress-empty">
        <strong>Your progress starts with the baseline</strong>
        <p>Complete the one-minute test, or finish any signed-in practice, to begin measuring speed, accuracy, and difficult patterns.</p>
      </div>
    );
  }

  return (
    <div className="progress-view">
      <div className="progress-metrics">
        <div><strong>{summary.averageWpm}</strong><span>Average WPM</span></div>
        <div><strong>{summary.averageAccuracy}%</strong><span>Accuracy</span></div>
        <div><strong>{summary.sessions}</strong><span>Sessions</span></div>
      </div>

      <div className="progress-card improvement-card">
        <div><span>Speed improvement</span><strong>{signedChange(summary.wpmImprovement, ' WPM')}</strong></div>
        <div><span>Accuracy improvement</span><strong>{signedChange(summary.accuracyImprovement, '%')}</strong></div>
      </div>

      <div className="progress-card">
        <div className="progress-card-heading">
          <div><strong>Difficult words and patterns</strong><span>Higher difficulty receives more practice.</span></div>
          {learning.isSyncing && <small>Syncing…</small>}
        </div>
        {focusAreas.length ? (
          <div className="focus-list">
            {focusAreas.map((item) => (
              <div className="focus-item" key={`${item.type}-${item.value}`}>
                <div className="focus-name"><strong>{item.value}</strong><span>{item.type}</span></div>
                <div className="focus-meter" aria-label={`${Math.round(item.score * 100)} percent difficulty`}>
                  <span style={{ width: `${Math.max(4, item.score * 100)}%` }} />
                </div>
                <div className="focus-evidence">
                  <strong>{Math.round(item.confidence * 100)}%</strong>
                  <span>confidence · {item.attempts} tries</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="progress-note">Keep practicing. A pattern appears here after at least two attempts provide useful evidence.</p>
        )}
      </div>

      <p className="progress-note">A pattern reaches “established” confidence at about nine attempts. You currently have {summary.establishedPatterns} of {summary.totalPatterns} observed patterns at that level.</p>
    </div>
  );
}
