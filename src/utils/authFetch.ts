export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const accessToken = localStorage.getItem('accessToken') || '';
  const refreshToken = localStorage.getItem('refreshToken') || '';

  const headers = new Headers(init.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(input, { ...init, headers });

  if (res.status === 401 && refreshToken) {
    // thử refresh
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
      body: JSON.stringify({ refreshToken })
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const newAccess = data.accessToken;
      if (newAccess) {
        localStorage.setItem('accessToken', newAccess);
        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newAccess}`);
        res = await fetch(input, { ...init, headers: retryHeaders });
      }
    }
  }

  return res;
}
