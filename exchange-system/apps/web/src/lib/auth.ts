import { UserSummary } from '@exchange/shared';

export function getStoredUser(): UserSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserSummary) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: UserSummary) {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function isAdmin(user: UserSummary | null): boolean {
  return user?.role === 'ADMIN';
}
