const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export async function apiRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
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

