import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@wh_cache:';
const QUEUE_KEY = '@wh_queue';

// ─── Response Cache ───────────────────────────────────────────────────────────

export async function cacheSet(key: string, data: any, maxAgeMs = 3_600_000) {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now(), maxAgeMs }),
    );
  } catch {}
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts, maxAgeMs } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null;
    return data as T;
  } catch {
    return null;
  }
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

export type QueuedItem = {
  id: string;
  path: string;
  method: string;
  body?: string;
  label: string;
  enqueuedAt: number;
};

export async function queueAdd(path: string, method: string, body: any, label: string) {
  const queue = await queueGetAll();
  const item: QueuedItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    path,
    method,
    body: JSON.stringify(body),
    label,
    enqueuedAt: Date.now(),
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item.id;
}

export async function queueGetAll(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function queueRemove(id: string) {
  const queue = await queueGetAll();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter(q => q.id !== id)));
}

export async function queueClear() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
