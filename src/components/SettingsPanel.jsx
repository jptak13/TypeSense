import { useEffect, useRef, useState } from 'react';
import { AuthForm } from './AuthForm';
import { ProgressPanel } from './ProgressPanel';

export function SettingsPanel({
  isOpen, onClose, auth, theme, onThemeChange, passageSource,
  onPassageSourceChange, mode, useCustomLength, onUseCustomLengthChange,
  maxWordLength, onMaxWordLengthChange,
  learning,
}) {
  const panelRef = useRef(null);
  const [view, setView] = useState('settings');
  const activeView = auth.currentUser ? view : 'settings';

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" ref={panelRef} tabIndex={-1} aria-label="Settings">
        <div className="panel-header"><div><span className="eyebrow">TypeSense</span><h2>{activeView === 'progress' ? 'Progress' : 'Settings'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></div>

        {auth.currentUser && (
          <div className="panel-tabs" role="tablist" aria-label="Settings views">
            <button className={activeView === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button>
            <button className={activeView === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>Progress</button>
          </div>
        )}

        {activeView === 'progress' ? <ProgressPanel learning={learning} /> : (
          <div className="settings-groups">
            <section className="settings-section profile-section"><AuthForm auth={{
              ...auth,
              logout: () => {
                auth.logout();
                setView('settings');
                if (passageSource === 'learn') onPassageSourceChange('default');
              },
            }} />
              <p className="settings-note">Signed-in practice builds your adaptive Learn profile and syncs it to your account.</p></section>

            <section className="settings-section">
              <div className="setting-row"><div><strong>Theme</strong><small>Choose the app appearance.</small></div>
                <div className="settings-choice" role="group" aria-label="Theme">
                  {['system', 'light', 'dark'].map((choice) => (
                    <button key={choice} className={theme === choice ? 'active' : ''} onClick={() => onThemeChange(choice)}>
                      {choice[0].toUpperCase() + choice.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="setting-row source-row"><div><strong>Source</strong><small>Choose how practice passages are built.</small></div>
                <div className="settings-choice source-choice">
                  <button className={passageSource === 'default' ? 'active' : ''}
                    onClick={() => onPassageSourceChange('default')}>Default</button>
                  <button className={passageSource === 'create' ? 'active' : ''}
                    onClick={() => onPassageSourceChange('create')}>Create</button>
                  <button className={passageSource === 'learn' ? 'active' : ''}
                    onClick={() => onPassageSourceChange('learn')} disabled={!auth.currentUser}
                    title={auth.currentUser ? 'Adaptive practice' : 'Sign in to unlock Learn'}>Learn</button>
                </div>
              </div>
              {!auth.currentUser && (
                <p className="learn-lock-note">Sign in to unlock Learn and save an adaptive practice profile.</p>
              )}
              {passageSource === 'learn' && (
                <p className="learn-note">Adaptive test · targets slow or inaccurate patterns · {learning.profile.sessions} sessions
                  {learning.isSyncing ? ' · syncing' : ''}</p>
              )}
              {mode !== 'time' && <div className="setting-row"><div><strong>Length controls</strong><small>Use presets or a custom word count.</small></div>
                <div className="settings-choice">
                  <button className={!useCustomLength ? 'active' : ''} onClick={() => onUseCustomLengthChange(false)}>Preset</button>
                  <button className={useCustomLength ? 'active' : ''} onClick={() => onUseCustomLengthChange(true)}>Custom</button>
                </div></div>}
              <div className="setting-row"><div><strong>Maximum word length</strong><small>Applies to Default and Learn passages.</small></div>
                <div className="number-stepper"><button onClick={() => onMaxWordLengthChange(-1)}
                  disabled={maxWordLength <= 3} aria-label="Decrease maximum word length">−</button>
                  <span>{maxWordLength}</span><button onClick={() => onMaxWordLengthChange(1)}
                    disabled={maxWordLength >= 15} aria-label="Increase maximum word length">+</button></div></div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
