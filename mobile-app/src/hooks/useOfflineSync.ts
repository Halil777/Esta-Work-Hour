import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { queueGetAll, queueRemove } from '../offline';
import { BASE_URL, getToken } from '../api';

export function useOfflineSync() {
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inProgress = useRef(false);

  const refreshCount = useCallback(async () => {
    const q = await queueGetAll();
    setQueueCount(q.length);
  }, []);

  const sync = useCallback(async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setSyncing(true);
    try {
      const queue = await queueGetAll();
      if (queue.length === 0) return;
      const token = getToken();
      for (const item of queue) {
        try {
          const res = await fetch(`${BASE_URL}${item.path}`, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            ...(item.body ? { body: item.body } : {}),
          });
          if (res.ok) await queueRemove(item.id);
        } catch {
          // still offline — stop trying
          break;
        }
      }
      await refreshCount();
    } finally {
      setSyncing(false);
      inProgress.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    // Sync when app comes to foreground
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    // Periodic retry every 60 seconds
    const timer = setInterval(sync, 60_000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [sync, refreshCount]);

  return { queueCount, syncing, sync, refreshCount };
}
