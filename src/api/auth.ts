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
 * Upload a profile photo.
 */
export async function uploadProfilePhoto(formData: FormData): Promise<{ picture: string }> {
  const response = await api.post<{ picture: string }>('/auth/upload-photo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Request an email verification OTP for account deletion.
 */
export async function sendDeleteOtp(email: string): Promise<{ success: boolean; message: string; devOtp?: string }> {
  const response = await api.post('/auth/send-otp', { email, purpose: 'delete' });
  return response.data;
}

/**
 * Verify account deletion OTP.
 */
export async function verifyDeleteOtp(email: string, otp: string): Promise<{ success: boolean; valid: boolean }> {
  const response = await api.post('/auth/verify-otp', { email, otp, purpose: 'delete' });
  return response.data;
}

/**
 * Permanently delete current user account.
 */
export async function deleteAccount(otp: string): Promise<void> {
  await api.delete('/auth/me', { data: { otp } });
}

/**
 * Invalidate server-side session metadata on logout.
 */
export async function logoutBackend(): Promise<void> {
  await api.post('/auth/logout').catch(() => {
    // Best-effort logout on backend
  });
}
