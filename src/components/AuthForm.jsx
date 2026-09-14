import { useState } from 'react';

export function AuthForm({ auth }) {
  const [mode, setMode] = useState(auth.resetToken ? 'reset' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (auth.currentUser) {
    return (
      <div className="signed-in-row">
        <div><small>Signed in as</small><strong>{auth.currentUser.name || auth.currentUser.email}</strong></div>
        <button className="text-button" onClick={auth.logout}>Sign out</button>
      </div>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    let success;
    if (mode === 'forgot') success = await auth.requestPasswordReset(email);
    else if (mode === 'reset') success = await auth.resetPassword(password);
    else if (mode === 'login') success = await auth.login({ email, password });
    else success = await auth.signup({ name, email, password });
    if (success) setPassword('');
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === 'signup' && (
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)}
          autoComplete="name" required maxLength={80} /></label>
      )}
      {mode !== 'reset' && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)}
        autoComplete="email" required maxLength={254} /></label>}
      {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} /></label>}
      {auth.error && <p className="inline-error" role="alert">{auth.error}</p>}
      {auth.notice && <p className="auth-notice" role="status">{auth.notice}</p>}
      <div className="auth-actions">
        <button className="primary-button" type="submit" disabled={auth.isLoading}>
          {auth.isLoading ? 'Please wait…' : mode === 'login' ? 'Sign in'
            : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
        </button>
        {mode === 'login' ? (
          <>
            <button className="text-button" type="button" onClick={() => {
              setMode('signup'); auth.clearMessages();
            }}>Create an account</button>
            <button className="text-button" type="button" onClick={() => {
              setMode('forgot'); auth.clearMessages();
            }}>Forgot password?</button>
            {auth.error?.startsWith('Verify') && (
              <button className="text-button" type="button" onClick={() => auth.requestVerification(email)}>
                Resend verification
              </button>
            )}
          </>
        ) : (
          <button className="text-button" type="button" onClick={() => {
            setMode('login'); auth.clearMessages();
          }}>Back to sign in</button>
        )}
      </div>
    </form>
  );
}
