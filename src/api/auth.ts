import { api } from './client';
import { User } from '@/types/auth';

/**
 * Fetch current user from PostgreSQL database via /api/auth/me.
 * Auto-provisions user if it is their first time logging in.
 */
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>('/auth/me');
  return response.data;
}

/**
 * Update current user profile display name.
 */
export async function updateProfile(data: { name: string }): Promise<User> {
  const response = await api.put<User>('/auth/me', data);
  return response.data;
}

/**
 * Invalidate server-side session metadata on logout.
 */
export async function logoutBackend(): Promise<void> {
  await api.post('/auth/logout').catch(() => {
    // Best-effort logout on backend
  });
}
