import { auth } from '../lib/firebase';

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Ignore token refresh errors for public routes
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Erro na requisição (${res.status})`);
  }

  return (await res.json()) as T;
}
