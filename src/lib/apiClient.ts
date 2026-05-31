/**
 * Thin client for the IQBook LAN server (server/server.js).
 *
 * Mode is read from localStorage:
 *   - lan.mode      = 'standalone' | 'client'   (default 'standalone')
 *   - lan.serverUrl = 'http://192.168.1.50:4000'
 *
 * When mode === 'standalone' all calls return null and the app keeps
 * using localStorage as before, so this layer is fully optional.
 */

export type ConflictHandler = (collection: string, latest: any) => void;

let onConflict: ConflictHandler | null = null;
export function setConflictHandler(fn: ConflictHandler) {
  onConflict = fn;
}

export function getServerUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const mode = localStorage.getItem('lan.mode') || 'standalone';
  if (mode !== 'client') return null;
  const url = (localStorage.getItem('lan.serverUrl') || '').trim();
  return url ? url.replace(/\/+$/, '') : null;
}

export function isRemoteEnabled(): boolean {
  return !!getServerUrl();
}

async function request(method: string, path: string, body?: unknown): Promise<any> {
  const base = getServerUrl();
  if (!base) throw new Error('Remote disabled');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    if (onConflict) onConflict(path, data?.latest);
    throw Object.assign(new Error('Conflict'), { conflict: true, latest: data?.latest });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function pingServer(url: string): Promise<{ ok: true; time: number } | { ok: false; error: string }> {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    const res = await fetch(`${cleaned}/api/health`, { method: 'GET' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, time: data.time };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const api = {
  list: (collection: string) => request('GET', `/api/records/${collection}`),
  changes: (collection: string, since: number) =>
    request('GET', `/api/records/${collection}/changes?since=${since}`),
  upsert: (collection: string, item: any) =>
    request('POST', `/api/records/${collection}`, item),
  update: (collection: string, item: any) =>
    request('PUT', `/api/records/${collection}/${encodeURIComponent(item.id)}`, item),
  remove: (collection: string, id: string) =>
    request('DELETE', `/api/records/${collection}/${encodeURIComponent(id)}`),

  getSettings: (key: string) => request('GET', `/api/settings/${key}`),
  putSettings: (key: string, data: any) => request('PUT', `/api/settings/${key}`, data),
};

export default api;