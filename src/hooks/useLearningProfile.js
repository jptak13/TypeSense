import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { createEmptyProfile, normalizeProfile, updateProfile } from '../learn/profile';

export function useLearningProfile(user, token) {
  const [profile, setProfile] = useState(createEmptyProfile);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const oldProfileKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('typesense_learning_')) oldProfileKeys.push(key);
    }
    oldProfileKeys.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => active && setProfile(createEmptyProfile()));
    if (!user || !token) return () => { active = false; };

    Promise.resolve().then(() => active && setIsSyncing(true));
    apiRequest('/api/profile', { token })
      .then(({ profile: remote }) => {
        if (!active) return;
        setProfile(normalizeProfile(remote));
      })
      .catch(() => {})
      .finally(() => active && setIsSyncing(false));
    return () => { active = false; };
  }, [user, token]);

  const recordSession = useCallback((observations) => {
    if (!user || !token) return;
    setProfile((current) => {
      const next = updateProfile(current, observations);
      setIsSyncing(true);
      apiRequest('/api/profile', { token, method: 'PUT', body: JSON.stringify({ profile: next }) })
        .catch(() => {})
        .finally(() => setIsSyncing(false));
      return next;
    });
  }, [token, user]);

  return useMemo(() => ({ profile, isSyncing, recordSession }), [profile, isSyncing, recordSession]);
}
