import { getApiInternalUrl } from './apiUrl';

// Browser calls stay same-origin and go through the next.config.js rewrites.
const API_BASE = typeof window !== 'undefined' ? '' : getApiInternalUrl();

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  createdAt: string;
}

export async function apiRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export async function getCurrentUser(): Promise<UserDto | null> {
  try {
    const res = await apiRequest<{ user: UserDto }>('/api/v1/auth/me');
    return res.user;
  } catch (_err) {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await apiRequest('/api/v1/auth/logout', { method: 'POST' });
}

