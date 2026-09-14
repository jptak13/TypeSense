import { useCallback, useEffect, useState } from 'react';
import { apiRequest, clearSession, readStoredSession, storeSession } from '../lib/api';

export function useAuth() {
  const initial = readStoredSession();
  const initialParams = new URLSearchParams(window.location.search);
  const [currentUser, setCurrentUser] = useState(initial.user);
  const [token, setToken] = useState(initial.token);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState(() => initialParams.get('reset'));
  const [verificationToken] = useState(() => initialParams.get('verify'));

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setToken(null);
    setError('');
  }, []);

  useEffect(() => {
    if (!token) return;
    apiRequest('/api/session', { token })
      .then(({ user }) => setCurrentUser(user))
      .catch((requestError) => {
        if (requestError.status === 401) logout();
      });
  }, [token, logout]);

  useEffect(() => {
    if (!verificationToken) return;
    apiRequest('/api/verify-email', {
      method: 'POST', body: JSON.stringify({ token: verificationToken }),
    })
      .then(({ message }) => setNotice(message))
      .catch((requestError) => setError(requestError.message))
      .finally(() => window.history.replaceState({}, '', window.location.pathname));
  }, [verificationToken]);

  const authenticate = async (path, fields) => {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const session = await apiRequest(path, { method: 'POST', body: JSON.stringify(fields) });
      if (session.verificationRequired) {
        setNotice(session.message);
        return true;
      }
      storeSession(session);
      setCurrentUser(session.user);
      setToken(session.token);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email) => {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await apiRequest('/api/request-password-reset', {
        method: 'POST', body: JSON.stringify({ email }),
      });
      setNotice(response.message);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestVerification = async (email) => {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await apiRequest('/api/request-verification', {
        method: 'POST', body: JSON.stringify({ email }),
      });
      setNotice(response.message);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (password) => {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await apiRequest('/api/reset-password', {
        method: 'POST', body: JSON.stringify({ token: resetToken, password }),
      });
      setNotice(response.message);
      setResetToken(null);
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentUser, token, isLoading, error, notice, resetToken, logout,
    login: (fields) => authenticate('/api/login', fields),
    signup: (fields) => authenticate('/api/signup', fields),
    requestPasswordReset,
    requestVerification,
    resetPassword,
    clearMessages: () => { setError(''); setNotice(''); },
  };
}
