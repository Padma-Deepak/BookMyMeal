const BASE_URL = '/api';

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  localStorage.setItem('access_token', data.access);
  return data.access;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Attempt token refresh on 401
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await apiFetch(path, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`POST ${path} failed: ${res.status}`), { data: err });
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await apiFetch(path, {
    method: 'PATCH',
    body: isFormData ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`PATCH ${path} failed: ${res.status}`), { data: err });
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}
